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
import { discoverCandidates } from "./sources";
import { researchTopic } from "./research";
import { sanitizeSlug, ensureUniqueSlug } from "./slug";
import {
  SYSTEM_EDITOR,
  selectionPrompt,
  anglePrompt,
  writingPrompt,
  qualityHumanizePrompt,
  ceoVerdictPrompt,
  revisePrompt,
  imagePrompt,
  nicheFilterPrompt,
  dupSemanticPrompt,
  writerV3Prompt,
  expandPrompt,
} from "./prompts";
import { notifyDraft } from "./telegram";
import { createRun, logMessage, finishRun, type RunTrigger, type AgentId } from "./agentLog";
import { buildFactsTable, renderFactsForPrompt, factEntities, type FactsTable } from "./factsTable";
import { runVerifyMode, insertInternalLinks } from "./verify";
import { runHardValidators, checkDuplicate } from "./validators";
import { createPipelineRun, updatePipelineRun, type StageLog, type FinalStatus } from "./pipelineRuns";
import { getAgentConfig, getAgentSkillNotes, assembleAgentSystem, runAgentStep } from "./agentConfigs";
import { notifyPipelineFailure } from "./notify";

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
  ending_sentence?: string;
  flag_short?: boolean;
};

/**
 * Parse the writing step's delimited output. Robust to long multi-line bodies
 * (avoids the JSON control-character problem with article text).
 */
function parseArticleFields(raw: string): ArticleFields {
  const s = stripFences(raw);
  // Tolerant: models sometimes decorate labels ("**HEADLINE:**", "## HEADLINE:").
  const field = (label: string) => {
    const m = s.match(new RegExp(`^[ \\t>#]*\\**${label}\\**[ \\t]*:[ \\t]*(.*)$`, "mi"));
    return m ? m[1].trim().replace(/^\*+|\*+$/g, "").trim() : "";
  };
  const bodyMatch = s.match(/^[ \t>#]*\**BODY\**[ \t]*:[ \t]*\n?([\s\S]*)$/im);
  return {
    headline: field("HEADLINE"),
    title_meta: field("TITLE_META"),
    meta_description: field("META_DESCRIPTION"),
    summary: field("SUMMARY"),
    slug: field("SLUG"),
    category: field("CATEGORY") || "tech",
    body: bodyMatch ? bodyMatch[1].trim() : "",
    ending_sentence: field("ENDING_SENTENCE"),
    flag_short: /^true$/i.test(field("FLAG_SHORT")),
  };
}

/** Parse the Quality & Humanizer agent's VERDICT + BODY output. */
function parseQualityOutput(raw: string): { verdict: string; body: string } {
  const s = stripFences(raw);
  const verdictMatch = s.match(/^[ \t>#]*\**VERDICT\**[ \t]*:[ \t]*(.*)$/im);
  const bodyMatch = s.match(/^[ \t>#]*\**BODY\**[ \t]*:[ \t]*\n?([\s\S]*)$/im);
  return {
    verdict: verdictMatch ? verdictMatch[1].trim() : "OK",
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

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** House style: standard digits only — convert Telugu numerals (౨౦౨౬ → 2026). */
const normalizeDigits = (s: string) =>
  s.replace(/[౦-౯]/g, (d) => String(d.charCodeAt(0) - 0x0c66));

/**
 * V3 daily newsroom pipeline ("Verify Mode", NEWSROOM_V3_SPEC):
 *   Stage 1 Topic Scout + Duplicate Guard → Stage 2 Researcher (facts table)
 *   → Stage 3 Writer (outline-first, facts-only) → Stage 4 Verify Mode
 *   (Fact Checker + Language Editor + Discover Checker + Fixer, max 3 loops)
 *   → Stage 5 Publish Gate (hard code validators — the final word).
 * An article publishes ONLY if hard validators pass AND Verify Mode passed
 * with avg score >= 8. Everything else stays a draft with a failure report.
 */
export async function runPipeline(
  existingRunId?: string,
  trigger: RunTrigger = "cron",
): Promise<PipelineResult> {
  const log: string[] = [];
  const drafts: PipelineResult["drafts"] = [];
  const supabase = createAdminClient();
  const runId = existingRunId ?? (await createRun(trigger));
  const pipeId = await createPipelineRun(trigger).catch(() => null);
  const stageLogs: StageLog[] = [];

  const stage = (s: string, summary: string, extra?: Partial<StageLog>) => {
    stageLogs.push({ stage: s, summary, ...extra });
    if (pipeId) void updatePipelineRun(pipeId, { stage_logs: stageLogs });
  };

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

  // Provider-fallback step runner that reports fallbacks to the CEO feed.
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

  const finishAs = async (
    finalStatus: FinalStatus,
    reason: string,
    extra: { articleId?: string; articleTitle?: string; failure?: unknown } = {},
  ): Promise<PipelineResult> => {
    if (pipeId) {
      // Never clobber an already-written failure_report with null (the
      // publish gate writes its detailed report before finishAs runs).
      await updatePipelineRun(pipeId, {
        final_status: finalStatus,
        ...(extra.failure !== undefined
          ? { failure_report: extra.failure }
          : finalStatus.startsWith("skipped")
            ? { failure_report: { reason } }
            : {}),
        article_id: extra.articleId ?? null,
        stage_logs: stageLogs,
      });
    }
    const runStatus =
      finalStatus === "published"
        ? "created"
        : finalStatus === "error"
          ? "error"
          : finalStatus === "draft_failed"
            ? "draft" // article bana lekin gate fail — "Skip" se alag dikhna chahiye
            : "skipped";
    await finishRun(runId, runStatus, {
      articleId: extra.articleId,
      articleTitle: extra.articleTitle,
      reason: finalStatus === "published" ? undefined : reason,
    });
    return {
      status: runStatus === "created" ? "created" : runStatus === "error" ? "error" : "skipped",
      drafts,
      log,
      reason: finalStatus === "published" ? undefined : reason,
      runId,
    };
  };

  try {
    const features = await getFeatures();
    if (!features.article_generation) {
      await note("ceo", "ceo_to_agent", "done", "Article generation OFF hai — is run ko skip kar raha hoon.");
      return finishAs("skipped", "Article generation is OFF");
    }
    const general = await getGeneral();
    const rules = await getAgentInstructions();
    const researchSettings = await getResearchSettings();
    const qualityRules = await getQualityRules();
    const minWords = qualityRules.min_words;
    const maxWords = qualityRules.max_words;

    // ── STAGE 1 — TOPIC SCOUT + DUPLICATE GUARD ──
    await note("topic_scout", "ceo_to_agent", "working", "Naya V3 run start — Topic Scout ko topics dhoondne bhej raha hoon.");
    const t1 = Date.now();
    const candidates = await discoverCandidates();
    if (candidates.length === 0) {
      await note("topic_scout", "agent_to_ceo", "failed", "Aaj koi candidate topic nahi mila (RSS empty).");
      stage("topic_scout", "0 candidates");
      return finishAs("skipped", "No candidate topics found today");
    }
    await note("topic_scout", "agent_to_ceo", "done", `${candidates.length} candidate topics RSS se mile.`);

    const { data: recentRows } = await supabase
      .from("articles")
      .select("title")
      .order("created_at", { ascending: false })
      .limit(20);
    const recentTitles = (recentRows ?? []).map((r) => r.title as string);

    const sel = await step("topic_scout", "chunaav", {
      system: SYSTEM_EDITOR,
      prompt: selectionPrompt(candidates, Math.min(4, candidates.length), recentTitles),
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
      stage("topic_scout", `skipped: ${reason}`, { ms: Date.now() - t1 });
      return finishAs("skipped", reason);
    }

    // Walk ranked choices: niche filter (hard) + duplicate guard (hard).
    const scoutCfg = await getAgentConfig("topic_scout");
    const dupCfg = await getAgentConfig("dup_guard");
    let cand: (typeof candidates)[number] | null = null;
    let lastSkip: { status: FinalStatus; reason: string } = { status: "skipped", reason: "No eligible topic" };

    for (const choice of selection.choices) {
      const c = candidates[choice.index - 1];
      if (!c) continue;

      // Niche filter (spec §2) — tech/AI only.
      if (scoutCfg?.enabled !== false) {
        try {
          const nf = parseJson<{ on_niche: boolean; reason: string }>(
            (await runAgentStep("topic_scout", "niche_filter", {
              system: assembleAgentSystem(SYSTEM_EDITOR, scoutCfg, []),
              prompt: nicheFilterPrompt(c.title),
              maxTokens: 200,
              temperature: 0,
            }, scoutCfg)).text,
          );
          if (!nf.on_niche) {
            await note("topic_scout", "agent_to_ceo", "failed", `Off-niche skip: "${c.title}" (${nf.reason})`);
            lastSkip = { status: "skipped_off_niche", reason: `Off-niche: ${c.title} — ${nf.reason}` };
            continue;
          }
        } catch { /* classification failed — allow through */ }
      }

      // Duplicate Guard (spec §2): trigram + semantic.
      const trg = await checkDuplicate(c.title);
      let isDup = !trg.pass;
      let dupReason = trg.detail;
      if (!isDup && dupCfg?.enabled !== false) {
        try {
          const sem = parseJson<{ is_duplicate: boolean; matching_title?: string; reason?: string }>(
            (await runAgentStep("dup_guard", "dup_check", {
              system: assembleAgentSystem(SYSTEM_EDITOR, dupCfg, []),
              prompt: dupSemanticPrompt(c.title, recentTitles),
              maxTokens: 250,
              temperature: 0,
            }, dupCfg)).text,
          );
          if (sem.is_duplicate) {
            isDup = true;
            dupReason = `duplicate of "${sem.matching_title}" — ${sem.reason ?? ""}`;
          }
        } catch { /* semantic check failed — trigram already passed */ }
      }
      if (isDup) {
        await note("topic_scout", "agent_to_ceo", "failed", `Duplicate skip: "${c.title}" (${dupReason})`);
        lastSkip = { status: "skipped_duplicate", reason: `Duplicate: ${c.title} — ${dupReason}` };
        continue;
      }

      cand = c;
      break;
    }

    if (!cand) {
      stage("topic_scout", lastSkip.reason, { ms: Date.now() - t1 });
      await note("ceo", "ceo_to_agent", "done", `Aaj koi eligible topic nahi bacha (${lastSkip.reason}).`);
      return finishAs(lastSkip.status, lastSkip.reason);
    }
    stage("topic_scout", `picked "${cand.title}"`, { ms: Date.now() - t1 });
    await note("topic_scout", "agent_to_ceo", "done", `Topic final: "${cand.title}" (niche + duplicate check pass)`);

    // ── STAGE 2 — RESEARCHER (facts table) ──
    await note("researcher", "ceo_to_agent", "working", `Researcher ko facts table banane bhej raha hoon: "${cand.title}"`);
    const t2 = Date.now();
    const research = await buildFactsTable(cand.title, researchSettings.min_sources, {
      link: cand.link,
      source: cand.source,
    });
    if (!research) {
      await note("researcher", "agent_to_ceo", "failed", "Research me kuch nahi mila — run skip.");
      stage("researcher", "no research", { ms: Date.now() - t2 });
      return finishAs("skipped", "Research produced nothing");
    }
    const { table: facts, rawText } = research;
    const factsBlock = renderFactsForPrompt(facts, rawText);
    if (pipeId) void updatePipelineRun(pipeId, { facts_table: facts });
    stage("researcher", `${facts.facts.length} facts, ${facts.sources.length} resolved sources`, { ms: Date.now() - t2 });
    await note("researcher", "agent_to_ceo", "done", `${facts.facts.length} facts + ${facts.sources.length} real source(s) ka facts table ready.`);

    const authorId = await getDefaultAuthorId();

    // ── STAGE 3 — WRITER (outline-first, facts-only, max_tokens 8000) ──
    await note("writer", "ceo_to_agent", "working", "Writer ko angle + article likhne bhej raha hoon (facts table se).");
    const t3 = Date.now();
    const angle = await step("writer", "angle", {
      system: SYSTEM_EDITOR,
      prompt: anglePrompt(cand.title, factsBlock),
      maxTokens: 400,
      temperature: 0.7,
    });

    const writerCfg = await getAgentConfig("writer");
    const writerNotes = await getAgentSkillNotes("writer");
    const writerPrompt = writerV3Prompt({
      topic: cand.title,
      factsBlock,
      angle: angle.text,
      minWords,
      maxWords,
      tone: general.tone,
      rules,
    });
    let written = await runAgentStep("writer", "writing", {
      system: assembleAgentSystem(SYSTEM_EDITOR, writerCfg, writerNotes),
      prompt: writerPrompt,
      maxTokens: 8000, // Telugu ≈ 5-6x tokens/word — 2000 was truncating at ~450 words
      temperature: 0.8,
    }, writerCfg);
    if (written.usedFallback) {
      await note("ceo", "ceo_to_agent", "fixed",
        `Writer ka primary model fail hua (${written.primaryError ?? "error"}) — ${written.usedFallback} par chala.`);
    }
    let article = parseArticleFields(written.text);
    if (!article.headline || !article.body) {
      // One strict-format retry — models occasionally answer in prose/JSON.
      // Raw snippet goes into the message detail so failures are debuggable.
      await note("writer", "agent_to_ceo", "fixed",
        "Output format galat tha — strict format reminder ke saath dobara likhwa raha hoon.",
        `RAW OUTPUT (first 500 chars):\n${written.text.slice(0, 500)}`);
      written = await runAgentStep("writer", "writing", {
        system: assembleAgentSystem(SYSTEM_EDITOR, writerCfg, writerNotes),
        prompt:
          writerPrompt +
          "\n\nCRITICAL REMINDER: respond ONLY in the exact labeled format above (HEADLINE: / TITLE_META: / ... / BODY:). No preamble, no JSON, no markdown fences around the whole answer, no bold labels.",
        maxTokens: 8000,
        temperature: 0.6,
      }, writerCfg);
      article = parseArticleFields(written.text);
    }
    if (!article.headline || !article.body) {
      await note("writer", "agent_to_ceo", "failed", "Article likhne me format error aaya (retry ke baad bhi).",
        `RAW OUTPUT (first 500 chars):\n${written.text.slice(0, 500)}`);
      if (pipeId) void updatePipelineRun(pipeId, { failure_report: { error: "unparseable article", raw: written.text.slice(0, 1500) } });
      throw new Error("Writing step returned an unparseable article");
    }
    article.headline = normalizeDigits(article.headline);
    article.title_meta = normalizeDigits(article.title_meta);
    article.meta_description = normalizeDigits(article.meta_description);
    article.summary = normalizeDigits(article.summary);
    article.body = normalizeDigits(article.body);

    // Code-side word-count enforcement (never trust the LLM's count).
    let words = wordCount(article.body);
    let expandAttempts = 0;
    while (words < minWords && !article.flag_short && expandAttempts < 2) {
      expandAttempts++;
      await note("writer", "agent_to_ceo", "fixed", `Sirf ${words} words — unused facts ke saath expand attempt ${expandAttempts}/2.`);
      const used = article.body;
      const unused = facts.facts.filter((f) => {
        const key = f.fact.match(/[A-Za-z0-9]{3,}/g)?.[0];
        return key ? !used.includes(key) : true;
      }).map((f) => f.fact);
      try {
        const expanded = await runAgentStep("fixer", "fixer", {
          system: SYSTEM_EDITOR,
          prompt: expandPrompt(article.body, unused.slice(0, 12), minWords),
          maxTokens: 8000,
          temperature: 0.5,
        });
        const newBody = stripFences(expanded.text);
        if (wordCount(newBody) > words) article.body = newBody;
      } catch { break; }
      words = wordCount(article.body);
    }
    stage("writer", `"${article.headline}" — ${words} words`, {
      ms: Date.now() - t3,
      word_count: words,
      output_tokens: written.outputTokens,
    });
    await note("writer", "agent_to_ceo", "done", `"${article.headline}" likh diya (~${words} words${article.flag_short ? ", flag_short" : ""}).`);

    // Quality & Humanizer (existing pass — still runs before Verify Mode).
    let body = article.body;
    let qualityNote = "Quality check off hai (settings me disabled).";
    if (qualityRules.self_check) {
      await note("quality", "ceo_to_agent", "working", "Quality & Humanizer ko bhej raha hoon.");
      try {
        const checked = await step("quality", "quality_check", {
          system: SYSTEM_EDITOR,
          prompt: qualityHumanizePrompt(body, rules, qualityRules),
          maxTokens: 8000,
          temperature: 0.4,
        });
        const { verdict, body: fixedBody } = parseQualityOutput(checked.text);
        qualityNote = verdict;
        if (fixedBody.length > body.length * 0.5) {
          body = fixedBody;
          await note("quality", "agent_to_ceo", "fixed", verdict);
        } else {
          await note("quality", "agent_to_ceo", "done", `${verdict} (original rakha)`);
        }
      } catch (e) {
        qualityNote = "Skipped (error) — original body rakha.";
        await note("quality", "agent_to_ceo", "failed", `Error: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    // ── STAGE 4 — VERIFY MODE (3 reviewers + Fixer, max 3 loops) ──
    const category = (article.category || "tech").toLowerCase();
    const { data: candRows } = await supabase
      .from("articles")
      .select("title, slug")
      .eq("status", "published")
      .eq("category", category)
      .order("published_at", { ascending: false })
      .limit(8);
    const linkCandidates = (candRows ?? []) as { title: string; slug: string }[];

    await note("seo", "ceo_to_agent", "working", "Verify Mode start — Fact Checker + Language Editor + Discover Checker.");
    const t4 = Date.now();
    const verify = await runVerifyMode(
      {
        headline: article.headline,
        title_meta: article.title_meta,
        meta_description: article.meta_description,
        body,
      },
      factsBlock,
      linkCandidates,
      async (msg, agent, status) => {
        await note((agent ?? "ceo") as AgentId, agent ? "agent_to_ceo" : "ceo_to_agent", status ?? "working", msg);
      },
      minWords,
      rules,
    );
    body = insertInternalLinks(verify.article.body, verify.internalLinks);

    // Fixer rewrites can shrink the body below the word floor — re-expand
    // once from unused facts before the hard validators get the final say.
    if (wordCount(body) < minWords && !article.flag_short && facts.facts.length) {
      await note("writer", "ceo_to_agent", "working", `Verify ke baad body ${wordCount(body)} words reh gayi — unused facts se re-expand kar raha hoon.`);
      const unused = facts.facts
        .filter((f) => {
          const key = f.fact.match(/[A-Za-z0-9]{3,}/g)?.[0];
          return key ? !body.includes(key) : true;
        })
        .map((f) => f.fact);
      try {
        const expanded = await runAgentStep("fixer", "fixer", {
          system: SYSTEM_EDITOR,
          prompt: expandPrompt(body, unused.slice(0, 12), minWords),
          maxTokens: 8000,
          temperature: 0.5,
        });
        const newBody = stripFences(expanded.text);
        if (wordCount(newBody) > wordCount(body)) {
          body = newBody;
          await note("writer", "agent_to_ceo", "fixed", `Re-expand ho gaya — ab ${wordCount(body)} words.`);
        }
      } catch { /* validators will catch it */ }
    }
    const headline = verify.article.headline;
    const titleMeta = verify.article.title_meta;
    const metaDescription = verify.article.meta_description;
    if (pipeId) void updatePipelineRun(pipeId, { reviewer_scores: { ...verify.scores, loops: verify.loops } });
    stage("verify", `${verify.passed ? "PASSED" : "FAILED"} — fact=${verify.scores.fact} lang=${verify.scores.language} discover=${verify.scores.discover}, ${verify.loops} loop(s)`, { ms: Date.now() - t4 });
    await note("seo", "agent_to_ceo", verify.passed ? "done" : "failed",
      `Verify ${verify.passed ? "PASS" : "FAIL"} (fact ${verify.scores.fact}/10, language ${verify.scores.language}/10, discover ${verify.scores.discover}/10, ${verify.loops} loop).`);

    const slug = await ensureUniqueSlug(sanitizeSlug(article.slug || headline));

    // ── STAGE 5a — IMAGE AGENT ──
    let imageUrl: string | null = null;
    if (features.image_generation) {
      await note("image", "ceo_to_agent", "working", "Image agent ko header image banane bhej raha hoon.");
      try {
        const img = await runImage(imagePrompt(headline, category));
        imageUrl = await uploadArticleImage(img.bytes, img.contentType, slug);
        await note("image", "agent_to_ceo", "done", "Header image ban gaya + upload ho gaya.");
      } catch (e) {
        await note("image", "agent_to_ceo", "failed", `Image generation fail: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    // Save as DRAFT first — the Publish Gate decides if it goes live.
    const { data: draft, error } = await supabase
      .from("articles")
      .insert({
        slug,
        title: headline,
        title_meta: titleMeta,
        meta_description: metaDescription,
        summary: article.summary,
        body,
        category,
        image_url: imageUrl,
        author_id: authorId,
        source_urls: facts.sources.slice(0, 3).map((s) => ({ title: s.title, url: s.url, source: s.domain })),
        status: "draft",
        published_at: null,
      })
      .select("id, title, slug")
      .single();
    if (error) throw error;
    drafts.push({ id: draft.id, title: draft.title, slug: draft.slug });

    // ── STAGE 5b — PUBLISH GATE (hard code validators = the final word) ──
    const validators = await runHardValidators(
      {
        id: draft.id,
        title: headline,
        slug,
        body,
        image_url: imageUrl,
        source_urls: facts.sources.map((s) => ({ title: s.title, url: s.url, source: s.domain })),
        flag_short: article.flag_short,
        factEntities: factEntities(facts),
      },
      { minWords, maxWords },
    );
    if (pipeId) void updatePipelineRun(pipeId, { hard_validator_results: validators.results });
    const failedChecks = validators.results.filter((r) => !r.pass);
    stage("publish_gate", failedChecks.length
      ? `validators FAILED: ${failedChecks.map((f) => f.name).join(", ")}`
      : "all hard validators passed");

    const publishNow = general.auto_publish && verify.passed && validators.pass;
    let gateFailure: unknown;
    if (publishNow) {
      await supabase
        .from("articles")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", draft.id);
      log.push(`  PUBLISHED ${draft.id}`);
      // Best-effort IndexNow ping (Google is sitemap-driven; IndexNow covers Bing/others).
      const inKey = process.env.INDEXNOW_KEY;
      const site = process.env.NEXT_PUBLIC_SITE_URL || "https://telugulo.in";
      if (inKey) {
        void fetch("https://api.indexnow.org/indexnow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            host: new URL(site).host,
            key: inKey,
            keyLocation: `${site}/indexnow-key.txt`,
            urlList: [`${site}/${slug}/`],
          }),
        }).catch(() => {});
      }
      await note("ceo", "ceo_to_agent", "done", `Publish Gate PASS — "${headline}" live ho gaya.`);
    } else {
      gateFailure = {
        verify_passed: verify.passed,
        reviewer_scores: { ...verify.scores, loops: verify.loops },
        outstanding_issues: verify.issues.slice(0, 10),
        failed_validators: failedChecks,
        auto_publish: general.auto_publish,
      };
      await note("ceo", "ceo_to_agent", "failed",
        `Publish Gate FAIL — draft me rakha. ${!verify.passed ? "Verify fail" : ""} ${failedChecks.length ? `validators: ${failedChecks.map((f) => f.name).join(", ")}` : ""}${!general.auto_publish ? " (auto-publish OFF)" : ""}`);
      log.push(`  Kept as DRAFT ${draft.id} (gate failed)`);
      if (general.auto_publish) {
        void notifyPipelineFailure({
          title: headline,
          status: "draft_failed",
          issues: [
            ...failedChecks.map((f) => ({ severity: f.severity, problem: `${f.name}: ${f.detail}` })),
            ...verify.issues.map((i) => ({ severity: i.severity, problem: i.problem })),
          ],
          articleId: draft.id,
        });
      }
    }

    // CEO final verdict
    try {
      const verdict = await step("ceo", "ceo", {
        system: SYSTEM_EDITOR,
        prompt: ceoVerdictPrompt({
          title: headline,
          wordCount: wordCount(body),
          qualityNote: `${qualityNote} | verify: fact ${verify.scores.fact}, language ${verify.scores.language}, discover ${verify.scores.discover} (${verify.loops} loop)`,
          seoNote: validators.pass ? "hard validators sab pass" : `validators fail: ${failedChecks.map((f) => f.name).join(", ")}`,
          willPublish: publishNow,
        }),
        maxTokens: 150,
        temperature: 0.6,
      });
      await note("ceo", "ceo_to_agent", "done", stripFences(verdict.text));
    } catch {
      await note("ceo", "ceo_to_agent", "done",
        `Team ne kaam pura kiya — "${headline}" ${publishNow ? "publish ho gaya" : "draft me hai (review needed)"}.`);
    }

    if (features.telegram_notifications) {
      try {
        await notifyDraft({ id: draft.id, title: headline, summary: article.summary });
        log.push("  Telegram: notified");
      } catch (e) {
        log.push(`  Telegram: failed (${e instanceof Error ? e.message : "error"})`);
      }
    }

    return finishAs(publishNow ? "published" : "draft_failed",
      publishNow ? "published" : "kept as draft (publish gate failed)",
      { articleId: draft.id, articleTitle: draft.title, failure: gateFailure });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    log.push(`ERROR: ${reason}`);
    await note("ceo", "ceo_to_agent", "failed", `Run me error aaya: ${reason}`);
    return finishAs("error", reason, { failure: { error: reason } });
  }
}

/**
 * Re-run Verify Mode on an existing draft that failed the gate ("Re-verify"
 * button). Reuses the stored facts table from the article's original
 * pipeline_runs row (re-researches if missing), applies fixes, re-runs the
 * hard validators, and publishes if everything passes (+auto_publish ON).
 */
export async function reverifyArticle(
  articleId: string,
  existingRunId?: string,
): Promise<PipelineResult> {
  const log: string[] = [];
  const supabase = createAdminClient();
  const runId = existingRunId ?? (await createRun("manual"));
  const pipeId = await createPipelineRun("reverify").catch(() => null);
  const stageLogs: StageLog[] = [];

  const note = (
    agent: AgentId,
    direction: "ceo_to_agent" | "agent_to_ceo",
    status: "working" | "done" | "fixed" | "failed",
    message: string,
  ) => {
    log.push(`[${agent}] ${message}`);
    return logMessage({ runId, agent, direction, status, message });
  };

  try {
    const { data: art, error: readErr } = await supabase
      .from("articles")
      .select("id, title, title_meta, meta_description, slug, category, body, image_url, source_urls, status")
      .eq("id", articleId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!art) throw new Error("Article not found");

    const general = await getGeneral();
    const qualityRules = await getQualityRules();
    const researchSettings = await getResearchSettings();
    const minWords = qualityRules.min_words;

    await note("ceo", "ceo_to_agent", "working", `Re-verify start: "${art.title}"`);

    // Facts table: reuse the original run's, else re-research.
    const { data: prevRun } = await supabase
      .from("pipeline_runs")
      .select("facts_table")
      .eq("article_id", articleId)
      .not("facts_table", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let facts = (prevRun?.facts_table ?? null) as FactsTable | null;
    let rawText = "";
    if (!facts || !(facts.facts?.length || facts.sources?.length)) {
      await note("researcher", "ceo_to_agent", "working", "Purana facts table nahi mila — fresh research kar raha hoon.");
      const research = await buildFactsTable(art.title, researchSettings.min_sources);
      if (!research) throw new Error("Re-research failed — no sources found");
      facts = research.table;
      rawText = research.rawText;
      await note("researcher", "agent_to_ceo", "done", `${facts.facts.length} facts ka fresh table ready.`);
    }
    const factsBlock = renderFactsForPrompt(facts, rawText || undefined);
    if (pipeId) void updatePipelineRun(pipeId, { facts_table: facts, article_id: articleId });

    const { data: candRows } = await supabase
      .from("articles")
      .select("title, slug")
      .eq("status", "published")
      .eq("category", art.category || "tech")
      .neq("id", articleId)
      .order("published_at", { ascending: false })
      .limit(8);

    const verify = await runVerifyMode(
      {
        headline: art.title,
        title_meta: art.title_meta ?? "",
        meta_description: art.meta_description ?? "",
        body: art.body ?? "",
      },
      factsBlock,
      (candRows ?? []) as { title: string; slug: string }[],
      async (msg, agent, status) => {
        await note((agent ?? "ceo") as AgentId, agent ? "agent_to_ceo" : "ceo_to_agent", status ?? "working", msg);
      },
      minWords,
      await getAgentInstructions(),
    );
    const body = insertInternalLinks(verify.article.body, verify.internalLinks);
    if (pipeId) void updatePipelineRun(pipeId, { reviewer_scores: { ...verify.scores, loops: verify.loops } });
    stageLogs.push({ stage: "verify", summary: `${verify.passed ? "PASSED" : "FAILED"} — fact=${verify.scores.fact} lang=${verify.scores.language} discover=${verify.scores.discover}` });

    // Persist the fixed fields either way (the draft improves every attempt).
    await supabase
      .from("articles")
      .update({
        title: verify.article.headline,
        title_meta: verify.article.title_meta,
        meta_description: verify.article.meta_description,
        body,
      })
      .eq("id", articleId);

    const validators = await runHardValidators(
      {
        id: articleId,
        title: verify.article.headline,
        slug: art.slug,
        body,
        image_url: art.image_url,
        source_urls: art.source_urls as { title?: string; url?: string; source?: string }[] | null,
        factEntities: factEntities(facts),
      },
      { minWords, maxWords: qualityRules.max_words },
    );
    const failedChecks = validators.results.filter((r) => !r.pass);
    if (pipeId) void updatePipelineRun(pipeId, { hard_validator_results: validators.results, stage_logs: stageLogs });

    const publishNow = general.auto_publish && verify.passed && validators.pass;
    if (publishNow && art.status !== "published") {
      await supabase
        .from("articles")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", articleId);
    }
    await note(
      "ceo",
      "ceo_to_agent",
      publishNow ? "done" : "failed",
      publishNow
        ? `Re-verify PASS — "${verify.article.headline}" publish ho gaya! 🎉`
        : `Re-verify ${verify.passed ? "pass hua lekin validators fail" : "FAIL"} (fact ${verify.scores.fact}, lang ${verify.scores.language}, discover ${verify.scores.discover}${failedChecks.length ? ` · validators: ${failedChecks.map((f) => f.name).join(", ")}` : ""}) — draft me hi hai, improvements save ho gaye.`,
    );

    const failure = publishNow
      ? undefined
      : {
          verify_passed: verify.passed,
          reviewer_scores: { ...verify.scores, loops: verify.loops },
          outstanding_issues: verify.issues.slice(0, 10),
          failed_validators: failedChecks,
        };
    if (pipeId) {
      await updatePipelineRun(pipeId, {
        final_status: publishNow ? "published" : "draft_failed",
        ...(failure !== undefined ? { failure_report: failure } : {}),
      });
    }
    await finishRun(runId, publishNow ? "created" : "draft", {
      articleId,
      articleTitle: verify.article.headline,
      reason: publishNow ? undefined : "re-verify failed — still a draft",
    });
    return {
      status: publishNow ? "created" : "skipped",
      drafts: [{ id: articleId, title: verify.article.headline, slug: art.slug }],
      log,
      reason: publishNow ? undefined : "re-verify failed",
      runId,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    await note("ceo", "ceo_to_agent", "failed", `Re-verify error: ${reason}`);
    if (pipeId) void updatePipelineRun(pipeId, { final_status: "error", failure_report: { error: reason } });
    await finishRun(runId, "error", { reason });
    return { status: "error", drafts: [], log, reason, runId };
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
    maxTokens: 8000,
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
        maxTokens: 8000,
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
    maxTokens: 8000,
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
