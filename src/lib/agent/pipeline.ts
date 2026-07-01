import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StepKey } from "@/lib/config";
import {
  getFeatures,
  getGeneral,
  getAgentInstructions,
  getResearchSettings,
  getQualityRules,
} from "@/lib/settings";
import { getSkillNoteTexts } from "./skills";
import { runStep, runStepWithFallback, runImage } from "@/lib/ai";
import { uploadArticleImage } from "@/lib/storage";
import { discoverCandidates, fetchArticleText } from "./sources";
import { researchTopic } from "./research";
import { sanitizeSlug, ensureUniqueSlug } from "./slug";
import {
  SYSTEM_EDITOR,
  selectionPrompt,
  anglePrompt,
  writingPrompt,
  qualityHumanizePrompt,
  seoAuditPrompt,
  ceoVerdictPrompt,
  revisePrompt,
  imagePrompt,
} from "./prompts";
import { notifyDraft } from "./telegram";
import { createRun, logMessage, finishRun, type RunTrigger, type AgentId } from "./agentLog";

export type PipelineResult = {
  status: "created" | "skipped" | "error";
  drafts: { id: string; title: string; slug: string }[];
  log: string[];
  reason?: string;
  runId?: string;
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

/** Parse the Quality & Humanizer agent's VERDICT + BODY output. */
function parseQualityOutput(raw: string): { verdict: string; body: string } {
  const s = stripFences(raw);
  const verdictMatch = s.match(/^VERDICT:[ \t]*(.*)$/im);
  const bodyMatch = s.match(/^BODY:[ \t]*\n?([\s\S]*)$/im);
  return {
    verdict: verdictMatch ? verdictMatch[1].trim() : "OK",
    body: bodyMatch ? bodyMatch[1].trim() : "",
  };
}

/** Parse the SEO agent's VERDICT + fixed fields (+ headline + linked body) output. */
function parseSeoOutput(raw: string): {
  verdict: string;
  headline: string;
  title_meta: string;
  meta_description: string;
  slug: string;
  body: string;
} {
  const s = stripFences(raw);
  const field = (label: string) => {
    const m = s.match(new RegExp(`^${label}:[ \\t]*(.*)$`, "mi"));
    return m ? m[1].trim() : "";
  };
  const bodyMatch = s.match(/^BODY:[ \t]*\n?([\s\S]*)$/im);
  return {
    verdict: field("VERDICT") || "OK",
    headline: field("HEADLINE"),
    title_meta: field("TITLE_META"),
    meta_description: field("META_DESCRIPTION"),
    slug: field("SLUG"),
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
 * The daily agent — run by the CEO multi-agent system. A CEO orchestrator
 * assigns work to specialist agents in order (Topic Scout → Researcher →
 * Writer → Quality & Humanizer → SEO → Image), each reports back, and the CEO
 * gives a final verdict before publish/save. Every assignment + report is
 * logged to `agent_runs` / `agent_messages` (see ./agentLog) so Admin -> AI
 * Agent can show it live (animated master/slave view).
 */
export async function runPipeline(
  existingRunId?: string,
  trigger: RunTrigger = "cron",
): Promise<PipelineResult> {
  const log: string[] = [];
  const drafts: PipelineResult["drafts"] = [];
  const supabase = createAdminClient();
  const runId = existingRunId ?? (await createRun(trigger));

  const note = (
    agent: AgentId,
    direction: "ceo_to_agent" | "agent_to_ceo",
    status: "working" | "done" | "fixed" | "failed",
    message: string,
    detail?: string,
  ) => {
    log.push(`[${agent}] ${message}`);
    return logMessage({ runId, agent, direction, status, message, detail });
  };

  // Reliability: run a step with provider fallback (Phase D) and, if the
  // fallback fired, tell the CEO feed so it's visible in the dashboard.
  const step = async (
    agent: AgentId,
    key: StepKey,
    params: Parameters<typeof runStepWithFallback>[1],
  ) => {
    const res = await runStepWithFallback(key, params);
    if (res.usedFallback) {
      await note(
        "ceo",
        "ceo_to_agent",
        "fixed",
        `${agent} step me ${res.primaryProvider} fail hua (${res.primaryError ?? "error"}) — ${res.usedFallback} par retry kiya, safal raha.`,
      );
    }
    return res;
  };

  try {
    const features = await getFeatures();
    if (!features.article_generation) {
      await note("ceo", "ceo_to_agent", "done", "Article generation OFF hai — is run ko skip kar raha hoon.");
      await finishRun(runId, "skipped", { reason: "Article generation is OFF" });
      return { status: "skipped", drafts, log, reason: "Article generation is OFF", runId };
    }
    const general = await getGeneral();
    const count = general.articles_per_day;
    const rules = await getAgentInstructions();
    const skillNotes = await getSkillNoteTexts();
    const researchSettings = await getResearchSettings();
    const qualityRules = await getQualityRules();
    const lengthWords = Math.round((qualityRules.min_words + qualityRules.max_words) / 2);

    await note("topic_scout", "ceo_to_agent", "working", "Naya run start — Topic Scout ko trending topics dhoondne bhej raha hoon.");

    // STEP 1 — TOPIC SCOUT: discovery
    const candidates = await discoverCandidates();
    if (candidates.length === 0) {
      await note("topic_scout", "agent_to_ceo", "failed", "Aaj koi candidate topic nahi mila (RSS empty).");
      await note("ceo", "ceo_to_agent", "done", "Topic Scout ko kuch nahi mila — aaj ke liye run band kar raha hoon.");
      await finishRun(runId, "skipped", { reason: "No candidate topics found today" });
      return { status: "skipped", drafts, log, reason: "No candidate topics found today", runId };
    }
    await note("topic_scout", "agent_to_ceo", "done", `${candidates.length} candidate topics RSS se mile.`);

    // Recently published titles — so the editor avoids repeating a story.
    const { data: recentRows } = await supabase
      .from("articles")
      .select("title")
      .order("created_at", { ascending: false })
      .limit(30);
    const recentTitles = (recentRows ?? []).map((r) => r.title as string);

    // STEP 1b — TOPIC SCOUT: selection
    const sel = await step("topic_scout", "chunaav", {
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
      const reason = selection.skipReason || "Editor skipped — no strong topic today";
      await note("topic_scout", "agent_to_ceo", "failed", `Koi topic itna strong nahi laga: ${reason}`);
      await note("ceo", "ceo_to_agent", "done", "Topic Scout ki salah maan kar aaj skip kar raha hoon.");
      await finishRun(runId, "skipped", { reason });
      return { status: "skipped", drafts, log, reason, runId };
    }
    await note(
      "topic_scout",
      "agent_to_ceo",
      "done",
      `${selection.choices.length} topic chun liya: "${candidates[selection.choices[0].index - 1]?.title ?? ""}"`,
    );

    const authorId = await getDefaultAuthorId();

    for (const choice of selection.choices.slice(0, count)) {
      const cand = candidates[choice.index - 1];
      if (!cand) continue;

      // STEP 2 — RESEARCHER: live web facts (Gemini grounding) + the primary source.
      await note("researcher", "ceo_to_agent", "working", `Researcher ko bhej raha hoon: "${cand.title}"`);
      const primary = await fetchArticleText(
        cand.link,
        researchSettings.depth === "basic" ? 2500 : 6000,
      );
      const web = await researchTopic(cand.title, researchSettings.min_sources);
      const researchText =
        [
          web.text ? `RESEARCHED FACTS (from live web search — use these):\n${web.text}` : "",
          primary ? `PRIMARY SOURCE — ${cand.source}: ${cand.title}\n${primary}` : "",
        ]
          .filter(Boolean)
          .join("\n\n---\n\n") || cand.title;
      const sources = web.sources.length
        ? web.sources
        : [{ title: cand.title, link: cand.link, source: cand.source }];
      await note(
        "researcher",
        "agent_to_ceo",
        "done",
        `${web.sources.length} web source(s) mile, ${web.text.length} chars facts` + (primary ? " + primary source" : ""),
      );

      // STEP 3 — WRITER: angle + write
      await note("writer", "ceo_to_agent", "working", "Writer ko angle + article likhne bhej raha hoon.");
      const angle = await step("writer", "angle", {
        system: SYSTEM_EDITOR,
        prompt: anglePrompt(cand.title, researchText),
        maxTokens: 400,
        temperature: 0.7,
      });

      const written = await step("writer", "writing", {
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
        await note("writer", "agent_to_ceo", "failed", "Article likhne me format error aaya.");
        throw new Error("Writing step returned an unparseable article");
      }
      await note("writer", "agent_to_ceo", "done", `"${article.headline}" likh diya (~${article.body.split(/\s+/).length} words).`);

      // STEP 4 — QUALITY & HUMANIZER (auto-fixes inline)
      let finalBody = article.body;
      let qualityNote = "Quality check off hai (settings me disabled).";
      if (qualityRules.self_check) {
        await note("quality", "ceo_to_agent", "working", "Quality & Humanizer ko bhej raha hoon — meaning, human-tone, aur hard Telugu check karne.");
        try {
          const checked = await step("quality", "quality_check", {
            system: SYSTEM_EDITOR,
            prompt: qualityHumanizePrompt(article.body, rules, qualityRules),
            maxTokens: 4000,
            temperature: 0.4,
          });
          const { verdict, body: fixedBody } = parseQualityOutput(checked.text);
          qualityNote = verdict;
          if (fixedBody.length > article.body.length * 0.5) {
            finalBody = fixedBody;
            await note("quality", "agent_to_ceo", "fixed", verdict);
          } else {
            await note("quality", "agent_to_ceo", "done", `${verdict} (original rakha — output bahut chhota tha)`);
          }
        } catch (e) {
          qualityNote = "Skipped (error) — original body rakha.";
          await note("quality", "agent_to_ceo", "failed", `Error aaya, original body rakh raha hoon: ${e instanceof Error ? e.message : "unknown"}`);
        }
      }

      // Draft headline/SEO fields (pre-fix); slug gets sanitized before the
      // uniqueness check.
      let headline = article.headline;
      let titleMeta = article.title_meta;
      let metaDescription = article.meta_description;
      let slugCandidate = article.slug || article.headline;

      // Candidate past articles (same category) for the internal-linking task.
      const { data: relatedRows } = await supabase
        .from("articles")
        .select("title, slug")
        .eq("status", "published")
        .eq("category", (article.category || "tech").toLowerCase())
        .order("published_at", { ascending: false })
        .limit(8);
      const relatedArticles = (relatedRows ?? []) as { title: string; slug: string }[];

      // STEP 5 — SEO AGENT (auto-fixes inline: headline-body alignment,
      // title/meta/slug, + inserts 2-3 internal links to related articles)
      await note("seo", "ceo_to_agent", "working", "SEO agent ko bhej raha hoon — headline alignment, title/meta/slug, internal links check karne.");
      let seoNote = "OK";
      try {
        const seoRes = await step("seo", "seo_check", {
          system: SYSTEM_EDITOR,
          prompt: seoAuditPrompt({
            headline,
            title_meta: titleMeta,
            meta_description: metaDescription,
            slug: slugCandidate,
            body: finalBody,
            relatedArticles,
          }),
          maxTokens: 4000,
          temperature: 0.3,
        });
        const seo = parseSeoOutput(seoRes.text);
        seoNote = seo.verdict;
        if (seo.headline && seo.headline.trim() && seo.headline.trim() !== headline.trim()) {
          await note("seo", "agent_to_ceo", "fixed", `headline_mismatch fix: "${headline}" -> "${seo.headline.trim()}"`);
          headline = seo.headline.trim();
        }
        if (seo.title_meta) titleMeta = seo.title_meta;
        if (seo.meta_description) metaDescription = seo.meta_description;
        if (seo.slug) slugCandidate = seo.slug;
        if (seo.body && seo.body.length > finalBody.length * 0.7) finalBody = seo.body;
        const changed = !/^ok/i.test(seo.verdict);
        await note("seo", "agent_to_ceo", changed ? "fixed" : "done", seo.verdict);
      } catch (e) {
        seoNote = "Skipped (error) — original SEO fields rakhe.";
        await note("seo", "agent_to_ceo", "failed", `Error aaya, original SEO fields rakh raha hoon: ${e instanceof Error ? e.message : "unknown"}`);
      }

      const slug = await ensureUniqueSlug(sanitizeSlug(slugCandidate));

      // STEP 6 — IMAGE AGENT
      let imageUrl: string | null = null;
      if (features.image_generation) {
        await note("image", "ceo_to_agent", "working", "Image agent ko header image banane bhej raha hoon.");
        try {
          const img = await runImage(imagePrompt(headline, article.category));
          imageUrl = await uploadArticleImage(img.bytes, img.contentType, slug);
          await note("image", "agent_to_ceo", "done", "Header image ban gaya + upload ho gaya.");
        } catch (e) {
          await note("image", "agent_to_ceo", "failed", `Image generation fail hui: ${e instanceof Error ? e.message : "error"}`);
        }
      }

      // SAVE — auto-publish goes live immediately; otherwise stays a draft
      // for human review (spec default).
      const publishNow = general.auto_publish;
      const { data: draft, error } = await supabase
        .from("articles")
        .insert({
          slug,
          title: headline,
          title_meta: titleMeta,
          meta_description: metaDescription,
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

      // STEP 7 — CEO FINAL VERDICT
      try {
        const verdict = await step("ceo", "ceo", {
          system: SYSTEM_EDITOR,
          prompt: ceoVerdictPrompt({
            title: headline,
            wordCount: finalBody.split(/\s+/).length,
            qualityNote,
            seoNote,
            willPublish: publishNow,
          }),
          maxTokens: 150,
          temperature: 0.6,
        });
        await note("ceo", "ceo_to_agent", "done", stripFences(verdict.text));
      } catch {
        await note(
          "ceo",
          "ceo_to_agent",
          "done",
          `Team ne kaam pura kiya — "${headline}" ${publishNow ? "publish ho gaya" : "draft me ready hai"}.`,
        );
      }

      // Telegram notification (non-fatal)
      if (features.telegram_notifications) {
        try {
          await notifyDraft({ id: draft.id, title: headline, summary: article.summary });
          log.push("  Telegram: notified");
        } catch (e) {
          log.push(`  Telegram: failed (${e instanceof Error ? e.message : "error"})`);
        }
      }
    }

    const finalStatus = drafts.length ? "created" : "skipped";
    await finishRun(runId, finalStatus, {
      articleId: drafts[0]?.id,
      articleTitle: drafts[0]?.title,
    });
    return { status: finalStatus, drafts, log, runId };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    log.push(`ERROR: ${reason}`);
    await note("ceo", "ceo_to_agent", "failed", `Run me error aaya: ${reason}`);
    await finishRun(runId, "error", { reason });
    return { status: "error", drafts, log, reason, runId };
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

  // STEP — RESEARCH the topic with live web search first (real facts).
  const research = await researchTopic(topic, researchSettings.min_sources);
  const hasResearch = research.text.length > 120;
  const researchText = hasResearch
    ? `RESEARCHED FACTS (from live web search — use ONLY these):\n${research.text}` +
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
      const checked = await runStep("quality_check", {
        system: SYSTEM_EDITOR,
        prompt: qualityHumanizePrompt(article.body, rules, quality),
        maxTokens: 4000,
        temperature: 0.4,
      });
      const { body: fixedBody } = parseQualityOutput(checked.text);
      if (fixedBody.length > article.body.length * 0.5) finalBody = fixedBody;
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
