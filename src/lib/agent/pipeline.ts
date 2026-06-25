import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatures, getGeneral } from "@/lib/settings";
import { runStep, runImage } from "@/lib/ai";
import { uploadArticleImage } from "@/lib/storage";
import { discoverCandidates, fetchArticleText } from "./sources";
import { sanitizeSlug, ensureUniqueSlug } from "./slug";
import {
  SYSTEM_EDITOR,
  selectionPrompt,
  anglePrompt,
  writingPrompt,
  selfCheckPrompt,
  imagePrompt,
} from "./prompts";
import { notifyDraft } from "./telegram";

export type PipelineResult = {
  status: "created" | "skipped" | "error";
  drafts: { id: string; title: string; slug: string }[];
  log: string[];
  reason?: string;
};

/** Extract a JSON object from a model response (tolerates ``` fences / prose). */
function parseJson<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return JSON.parse(s) as T;
}

/** Strip ``` fences from a plain-text response. */
function stripFences(raw: string): string {
  const s = raw.trim();
  const fence = s.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  return (fence ? fence[1] : s).trim();
}

type ArticleFields = {
  headline: string;
  title_meta: string;
  meta_description: string;
  summary: string;
  slug: string;
  category: string;
  body: string;
};

/**
 * Parse the writing step's delimited output. Robust to long multi-line bodies
 * (avoids the JSON control-character problem with article text).
 */
function parseArticleFields(raw: string): ArticleFields {
  const s = stripFences(raw);
  const field = (label: string) => {
    const m = s.match(new RegExp(`^${label}:[ \\t]*(.*)$`, "mi"));
    return m ? m[1].trim() : "";
  };
  const bodyMatch = s.match(/^BODY:[ \t]*\n?([\s\S]*)$/im);
  return {
    headline: field("HEADLINE"),
    title_meta: field("TITLE_META"),
    meta_description: field("META_DESCRIPTION"),
    summary: field("SUMMARY"),
    slug: field("SLUG"),
    category: field("CATEGORY") || "tech",
    body: bodyMatch ? bodyMatch[1].trim() : "",
  };
}

async function getDefaultAuthorId(): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("authors").select("id").limit(1).maybeSingle();
  if (data?.id) return data.id;
  const { data: created, error } = await supabase
    .from("authors")
    .insert({
      name: "Telugulo Desk",
      slug: "telugulo-desk",
      bio: "telugulo.in టీమ్ — AI-assisted, human-reviewed Telugu tech & AI news.",
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

/**
 * The daily 7-step agent (spec §4). Discovery → Selection → Research → Angle →
 * Write → Image → Self-critique → save as draft (never auto-publish).
 */
export async function runPipeline(): Promise<PipelineResult> {
  const log: string[] = [];
  const drafts: PipelineResult["drafts"] = [];
  const supabase = createAdminClient();

  try {
    const features = await getFeatures();
    if (!features.article_generation) {
      return { status: "skipped", drafts, log, reason: "Article generation is OFF" };
    }
    const general = await getGeneral();
    const count = general.articles_per_day;

    // STEP 1 — DISCOVERY
    const candidates = await discoverCandidates();
    log.push(`Discovery: ${candidates.length} candidate topics from RSS`);
    if (candidates.length === 0) {
      return { status: "skipped", drafts, log, reason: "No candidate topics found today" };
    }

    // STEP 2 — SELECTION
    const sel = await runStep("chunaav", {
      system: SYSTEM_EDITOR,
      prompt: selectionPrompt(candidates, count),
      maxTokens: 600,
      temperature: 0.4,
    });
    const selection = parseJson<{
      skip: boolean;
      skipReason?: string;
      choices: { index: number; reason: string }[];
    }>(sel.text);
    if (selection.skip || !selection.choices?.length) {
      return {
        status: "skipped",
        drafts,
        log,
        reason: selection.skipReason || "Editor skipped — no strong topic today",
      };
    }
    log.push(`Selection: chose ${selection.choices.length} topic(s)`);

    const authorId = await getDefaultAuthorId();

    for (const choice of selection.choices.slice(0, count)) {
      const cand = candidates[choice.index - 1];
      if (!cand) continue;
      log.push(`→ "${cand.title}" (${cand.source})`);

      // STEP 3 — RESEARCH
      const research = await fetchArticleText(cand.link);
      log.push(`  Research: ${research.length} chars extracted`);
      const researchText = research || cand.title;

      // STEP 4 — ANGLE
      const angle = await runStep("angle", {
        system: SYSTEM_EDITOR,
        prompt: anglePrompt(cand.title, researchText),
        maxTokens: 400,
        temperature: 0.7,
      });
      log.push("  Angle: done");

      // STEP 5 — WRITE
      const written = await runStep("writing", {
        system: SYSTEM_EDITOR,
        prompt: writingPrompt({
          title: cand.title,
          research: researchText,
          angle: angle.text,
          lengthWords: general.article_length,
          tone: general.tone,
        }),
        maxTokens: 4000,
        temperature: 0.8,
      });
      const article = parseArticleFields(written.text);
      if (!article.headline || !article.body) {
        throw new Error("Writing step returned an unparseable article");
      }
      log.push(`  Write: "${article.headline}"`);

      // STEP 7 (early) — SELF-CRITIQUE on the body
      let finalBody = article.body;
      try {
        const checked = await runStep("self_check", {
          system: SYSTEM_EDITOR,
          prompt: selfCheckPrompt(article.body),
          maxTokens: 4000,
          temperature: 0.4,
        });
        const cleaned = stripFences(checked.text);
        // Guard against a model that returns junk/too-short output.
        if (cleaned.length > article.body.length * 0.5) {
          finalBody = cleaned;
          log.push("  Self-critique: cleaned");
        } else {
          log.push("  Self-critique: kept original (output too short)");
        }
      } catch {
        log.push("  Self-critique: skipped (kept original)");
      }

      // Slug
      const slug = await ensureUniqueSlug(sanitizeSlug(article.slug || article.headline));

      // STEP 6 — IMAGE
      let imageUrl: string | null = null;
      if (features.image_generation) {
        try {
          const img = await runImage(imagePrompt(article.headline, article.category));
          imageUrl = await uploadArticleImage(img.bytes, img.contentType, slug);
          log.push("  Image: generated + uploaded");
        } catch (e) {
          log.push(`  Image: failed (${e instanceof Error ? e.message : "error"})`);
        }
      }

      // SAVE — auto-publish goes live immediately; otherwise stays a draft
      // for human review (spec default).
      const publishNow = general.auto_publish;
      const { data: draft, error } = await supabase
        .from("articles")
        .insert({
          slug,
          title: article.headline,
          title_meta: article.title_meta,
          meta_description: article.meta_description,
          summary: article.summary,
          body: finalBody,
          category: (article.category || "tech").toLowerCase(),
          image_url: imageUrl,
          author_id: authorId,
          source_urls: [{ title: cand.title, url: cand.link, source: cand.source }],
          status: publishNow ? "published" : "draft",
          published_at: publishNow ? new Date().toISOString() : null,
        })
        .select("id, title, slug")
        .single();
      if (error) throw error;

      drafts.push({ id: draft.id, title: draft.title, slug: draft.slug });
      log.push(`  Saved ${publishNow ? "+ PUBLISHED" : "draft"} ${draft.id}`);

      // Telegram notification (non-fatal)
      if (features.telegram_notifications) {
        try {
          await notifyDraft({ id: draft.id, title: article.headline, summary: article.summary });
          log.push("  Telegram: notified");
        } catch (e) {
          log.push(`  Telegram: failed (${e instanceof Error ? e.message : "error"})`);
        }
      }
    }

    return { status: drafts.length ? "created" : "skipped", drafts, log };
  } catch (e) {
    log.push(`ERROR: ${e instanceof Error ? e.message : "unknown"}`);
    return { status: "error", drafts, log, reason: e instanceof Error ? e.message : "unknown" };
  }
}
