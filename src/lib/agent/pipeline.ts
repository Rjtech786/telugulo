import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getFeatures,
  getGeneral,
  getAgentInstructions,
  getResearchSettings,
  getQualityRules,
} from "@/lib/settings";
import { getSkillNoteTexts } from "./skills";
import { runStep, runImage } from "@/lib/ai";
import { uploadArticleImage } from "@/lib/storage";
import { discoverCandidates, fetchArticleText, gatherResearch } from "./sources";
import { sanitizeSlug, ensureUniqueSlug } from "./slug";
import {
  SYSTEM_EDITOR,
  selectionPrompt,
  anglePrompt,
  writingPrompt,
  selfCheckPrompt,
  revisePrompt,
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
    const rules = await getAgentInstructions();
    const skillNotes = await getSkillNoteTexts();
    const researchSettings = await getResearchSettings();
    const qualityRules = await getQualityRules();
    const lengthWords = Math.round((qualityRules.min_words + qualityRules.max_words) / 2);

    // STEP 1 — DISCOVERY
    const candidates = await discoverCandidates();
    log.push(`Discovery: ${candidates.length} candidate topics from RSS`);
    if (candidates.length === 0) {
      return { status: "skipped", drafts, log, reason: "No candidate topics found today" };
    }

    // Recently published titles — so the editor avoids repeating a story.
    const { data: recentRows } = await supabase
      .from("articles")
      .select("title")
      .order("created_at", { ascending: false })
      .limit(30);
    const recentTitles = (recentRows ?? []).map((r) => r.title as string);

    // STEP 2 — SELECTION
    const sel = await runStep("chunaav", {
      system: SYSTEM_EDITOR,
      prompt: selectionPrompt(candidates, count, recentTitles),
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

      // STEP 3 — RESEARCH (primary source + corroborating sources)
      const primary = await fetchArticleText(
        cand.link,
        researchSettings.depth === "basic" ? 2500 : 6000,
      );
      const extra = await gatherResearch(cand.title, {
        minSources: researchSettings.min_sources,
        depth: researchSettings.depth,
        seed: cand,
      });
      const researchText =
        [
          primary ? `SOURCE — ${cand.source}: ${cand.title}\n${primary}` : "",
          extra.text,
        ]
          .filter(Boolean)
          .join("\n\n---\n\n") || cand.title;
      const sources = extra.sources.length
        ? extra.sources
        : [{ title: cand.title, link: cand.link, source: cand.source }];
      log.push(`  Research: ${sources.length} source(s), ${researchText.length} chars`);

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
          lengthWords,
          tone: general.tone,
          rules,
          skillNotes,
          quality: qualityRules,
        }),
        maxTokens: 4000,
        temperature: 0.8,
      });
      const article = parseArticleFields(written.text);
      if (!article.headline || !article.body) {
        throw new Error("Writing step returned an unparseable article");
      }
      log.push(`  Write: "${article.headline}"`);

      // STEP 7 (early) — SELF-CRITIQUE on the body (if enabled)
      let finalBody = article.body;
      if (qualityRules.self_check) {
        try {
          const checked = await runStep("self_check", {
            system: SYSTEM_EDITOR,
            prompt: selfCheckPrompt(article.body, rules, qualityRules),
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
          source_urls: sources.map((s) => ({ title: s.title, url: s.link, source: s.source })),
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

const VALID_CATEGORIES = ["ai", "mobile", "apps", "gadgets", "internet", "tech"];

export type OnDemandOptions = {
  category?: string;
  lengthWords?: number;
  forceLocalAngle?: boolean;
};

/**
 * On-demand generation for a specific owner-given topic (MCP / "write an
 * article on X"). Skips discovery/selection; researches the topic from real
 * news sources first, then writes. Always saves a DRAFT for review.
 */
export async function generateArticleForTopic(
  topic: string,
  options: OnDemandOptions = {},
): Promise<{ id: string; title: string; slug: string }> {
  const supabase = createAdminClient();
  const general = await getGeneral();
  const features = await getFeatures();
  const rules = await getAgentInstructions();
  const skillNotes = await getSkillNoteTexts();
  const researchSettings = await getResearchSettings();
  const quality = await getQualityRules();
  const authorId = await getDefaultAuthorId();

  const lengthWords =
    options.lengthWords != null
      ? Math.min(1500, Math.max(400, options.lengthWords))
      : Math.round((quality.min_words + quality.max_words) / 2);

  // STEP — RESEARCH the topic across real sources first.
  const research = await gatherResearch(topic, {
    minSources: researchSettings.min_sources,
    depth: researchSettings.depth,
  });
  const hasResearch = research.text.length > 200;
  const researchText = hasResearch
    ? research.text +
      (options.forceLocalAngle
        ? "\n\n(Add a GENUINE Telugu / AP / Telangana / India angle if the facts support one.)"
        : "")
    : `No reliable sources found for "${topic}". Use accurate general knowledge ONLY; do NOT invent specific stats, dates or quotes. The owner will review.`;

  const angle = await runStep("angle", {
    system: SYSTEM_EDITOR,
    prompt: anglePrompt(topic, researchText),
    maxTokens: 400,
    temperature: 0.7,
  });

  const written = await runStep("writing", {
    system: SYSTEM_EDITOR,
    prompt: writingPrompt({
      title: topic,
      research: researchText,
      angle: angle.text,
      lengthWords,
      tone: general.tone,
      rules,
      skillNotes,
      quality,
    }),
    maxTokens: 4000,
    temperature: 0.8,
  });
  const article = parseArticleFields(written.text);
  if (!article.headline || !article.body) {
    throw new Error("Writing step returned an unparseable article");
  }

  let finalBody = article.body;
  if (quality.self_check) {
    try {
      const checked = await runStep("self_check", {
        system: SYSTEM_EDITOR,
        prompt: selfCheckPrompt(article.body, rules, quality),
        maxTokens: 4000,
        temperature: 0.4,
      });
      const cleaned = stripFences(checked.text);
      if (cleaned.length > article.body.length * 0.5) finalBody = cleaned;
    } catch {
      // keep original
    }
  }

  const category =
    options.category && VALID_CATEGORIES.includes(options.category.toLowerCase())
      ? options.category.toLowerCase()
      : (article.category || "tech").toLowerCase();

  const slug = await ensureUniqueSlug(sanitizeSlug(article.slug || article.headline));

  let imageUrl: string | null = null;
  if (features.image_generation) {
    try {
      const img = await runImage(imagePrompt(article.headline, category));
      imageUrl = await uploadArticleImage(img.bytes, img.contentType, slug);
    } catch {
      // image is optional
    }
  }

  const { data: draft, error } = await supabase
    .from("articles")
    .insert({
      slug,
      title: article.headline,
      title_meta: article.title_meta,
      meta_description: article.meta_description,
      summary: article.summary,
      body: finalBody,
      category,
      image_url: imageUrl,
      author_id: authorId,
      source_urls: research.sources.length
        ? research.sources.map((s) => ({ title: s.title, url: s.link, source: s.source }))
        : [{ title: `On-demand: ${topic}`, source: "owner" }],
      status: "draft",
      published_at: null,
    })
    .select("id, title, slug")
    .single();
  if (error) throw error;
  return { id: draft.id, title: draft.title, slug: draft.slug };
}

/** Revise an existing draft/article body per an owner instruction (AI edit). */
export async function reviseDraft(
  id: string,
  instruction: string,
): Promise<{ id: string; title: string; slug: string }> {
  const supabase = createAdminClient();
  const { data: row, error: readErr } = await supabase
    .from("articles")
    .select("id, title, slug, body")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) throw new Error(`Article ${id} not found`);

  const rules = await getAgentInstructions();
  const revised = await runStep("writing", {
    system: SYSTEM_EDITOR,
    prompt: revisePrompt(row.body || "", instruction, rules),
    maxTokens: 4000,
    temperature: 0.6,
  });
  const newBody = stripFences(revised.text);
  if (newBody.length < 50) throw new Error("Revision produced too little text");

  const { error: updErr } = await supabase
    .from("articles")
    .update({ body: newBody })
    .eq("id", id);
  if (updErr) throw updErr;

  return { id: row.id, title: row.title, slug: row.slug };
}
