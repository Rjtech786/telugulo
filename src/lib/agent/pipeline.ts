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
import { stripInlineSourcesSection } from "@/lib/article-toc";
import { runHardValidators, checkDuplicate } from "./validators";
import { createPipelineRun, updatePipelineRun, type StageLog, type FinalStatus } from "./pipelineRuns";
import { getAgentConfig, getAgentSkillNotes, assembleAgentSystem, runAgentStep } from "./agentConfigs";
import { notifyPipelineFailure } from "./notify";
import { listPipelineSteps } from "./pipelineSteps";
import { type VerifyResult } from "./verify";

export type PipelineResult = {
  status: "created" | "skipped" | "error";
  drafts: { id: string; title: string; slug: string }[];
  log: string[];
  reason?: string;
  runId?: string;
};

/** Selects an expert writing persona dynamically based on topic keywords. */
function getWriterPersona(title: string): string {
  const t = title.toLowerCase();
  
  const aiKeywords = ["ai", "openai", "gemini", "chatgpt", "claude", "llm", "artificial intelligence", "nvidia", "copilot", "bot", "machine learning", "ml"];
  const mobileKeywords = ["iphone", "samsung", "oneplus", "xiaomi", "pixel", "smartphone", "mobile", "snapdragon", "dimensity", "realme", "vivo", "oppo", "android", "ios", "phone"];
  const softwareKeywords = ["app", "play store", "app store", "whatsapp", "youtube", "instagram", "facebook", "browser", "software", "update", "policy", "features", "website", "service"];

  if (aiKeywords.some(kw => t.includes(kw))) {
    return "You are a Senior AI Research Journalist for telugulo.in with deep technical understanding of machine learning models, NLP, neural networks, and generative AI systems. You explain complex artificial intelligence concepts, benchmark scores, and safety policies in simple, engaging hybrid Telugu, maintaining absolute factual accuracy.";
  }
  
  if (mobileKeywords.some(kw => t.includes(kw))) {
    return "You are a Veteran Hardware and Smartphone Reviewer for telugulo.in who has tested hundreds of mobile processors, camera sensors, displays, and battery tech. You write about phone launches, performance chips, charging speeds, and user value with an expert perspective, using natural, spoken hybrid Telugu.";
  }

  if (softwareKeywords.some(kw => t.includes(kw))) {
    return "You are a Consumer Software and UX Analyst for telugulo.in. You analyze user interfaces, app updates, digital privacy settings, internet browser policies, and social media platforms. You explain new software updates and digital changes to regular readers in simple, daily-speech hybrid Telugu.";
  }

  return "You are the Lead Tech Journalist for telugulo.in. You cover breaking tech news, gadget announcements, enterprise movements, and internet trends. You write with deep analytical clarity, making tech stories understandable and interesting for Telugu readers.";
}

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
const genericStepPrompt = (
  agentName: string,
  instructions: string,
  article: { headline: string; title_meta: string; meta_description: string; body: string },
  factsBlock: string,
  imageUrl: string | null,
) => `
You are the ${agentName} agent.
Your instructions:
${instructions}

Current article state:
HEADLINE: ${article.headline}
TITLE_META: ${article.title_meta}
META_DESCRIPTION: ${article.meta_description}
BODY:
${article.body}
IMAGE_URL: ${imageUrl ?? "None"}

FACTS TABLE (for reference):
${factsBlock}

Execute your task and reply with a JSON object summarizing your execution result:
{
  "status": "done" | "failed",
  "message": "detailed message of what you did",
  "output": any
}
No preamble, no explanation, only valid JSON.
`;

class PipelineEarlyExit extends Error {
  status: FinalStatus;
  constructor(status: FinalStatus, message: string) {
    super(message);
    this.status = status;
    this.name = "PipelineEarlyExit";
  }
}

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

    // Load pipeline steps from DB
    const dbSteps = await listPipelineSteps().catch(() => []);
    const activeSteps = dbSteps.filter((s) => s.enabled);

    if (activeSteps.length === 0) {
      await note("ceo", "agent_to_ceo", "failed", "Pipeline steps database empty or not initialized.");
      return finishAs("error", "No active pipeline steps found");
    }

    // Sort unique step orders
    const stepOrders = Array.from(new Set(activeSteps.map((s) => s.step_order))).sort((a, b) => a - b);

    // Pipeline state variables
    let cand: any = null;
    let facts: FactsTable | null = null;
    let factsBlock = "";
    let article: ArticleFields | null = null;
    let body = "";
    let verify: VerifyResult | null = null;
    let imageUrl: string | null = null;
    let qualityNote = "Quality check off hai (settings me disabled).";
    let hasRunVerify = false;
    const completedAgents = new Set<string>();

    // Iterate through step groups sequentially
    for (const order of stepOrders) {
      const groupSteps = activeSteps.filter((s) => s.step_order === order);
      
      // Execute steps in group in parallel
      await Promise.all(
        groupSteps.map(async (stepObj) => {
          const agentKey = stepObj.agent_key;
          
          // Check depends_on
          if (stepObj.depends_on && stepObj.depends_on.length > 0) {
            for (const dep of stepObj.depends_on) {
              const isDepActive = activeSteps.some((s) => s.agent_key === dep);
              if (isDepActive && !completedAgents.has(dep)) {
                throw new Error(`Dependency not met: ${dep} must run before ${agentKey}`);
              }
            }
          }

          try {
            // ── STAGE: TOPIC SCOUT & DUPLICATE GUARD ──
            if (agentKey === "topic_scout" || agentKey === "dup_guard") {
              // If we already selected the candidate topic, skip running selection again
              if (cand) {
                completedAgents.add(agentKey);
                return;
              }

              await note("topic_scout", "ceo_to_agent", "working", "Naya V3 run start — Topic Scout ko topics dhoondne bhej raha hoon.");
              const t1 = Date.now();
              const candidates = await discoverCandidates();
              if (candidates.length === 0) {
                await note("topic_scout", "agent_to_ceo", "failed", "Aaj koi candidate topic nahi mila (RSS empty).");
                stage("topic_scout", "0 candidates");
                throw new PipelineEarlyExit("skipped", "No candidate topics found today");
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
                throw new PipelineEarlyExit("skipped", reason);
              }

              const scoutCfg = await getAgentConfig("topic_scout");
              const dupCfg = await getAgentConfig("dup_guard");
              let lastSkip: { status: FinalStatus; reason: string } = { status: "skipped", reason: "No eligible topic" };

              for (const choice of selection.choices) {
                const c = candidates[choice.index - 1];
                if (!c) continue;

                // Niche filter
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
                  } catch { /* allow through */ }
                }

                // Duplicate Guard
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
                throw new PipelineEarlyExit(lastSkip.status, lastSkip.reason);
              }
              stage("topic_scout", `picked "${cand.title}"`, { ms: Date.now() - t1 });
              await note("topic_scout", "agent_to_ceo", "done", `Topic final: "${cand.title}" (niche + duplicate check pass)`);
            }

            // ── STAGE: RESEARCHER ──
            else if (agentKey === "researcher") {
              if (!cand) return;
              await note("researcher", "ceo_to_agent", "working", `Researcher ko facts table banane bhej raha hoon: "${cand.title}"`);
              const t2 = Date.now();
              const research = await buildFactsTable(cand.title, researchSettings.min_sources, {
                link: cand.link,
                source: cand.source,
              });
              if (!research) {
                await note("researcher", "agent_to_ceo", "failed", "Research me kuch nahi mila — run skip.");
                stage("researcher", "no research", { ms: Date.now() - t2 });
                throw new PipelineEarlyExit("skipped", "Research produced nothing");
              }
              facts = research.table;
              factsBlock = renderFactsForPrompt(facts, research.rawText);
              if (pipeId) void updatePipelineRun(pipeId, { facts_table: facts });
              stage("researcher", `${facts.facts.length} facts, ${facts.sources.length} resolved sources`, { ms: Date.now() - t2 });
              await note("researcher", "agent_to_ceo", "done", `${facts.facts.length} facts + ${facts.sources.length} real source(s) ka facts table ready.`);
            }

            // ── STAGE: WRITER ──
            else if (agentKey === "writer") {
              if (!factsBlock) return;
              await note("writer", "ceo_to_agent", "working", "Writer ko angle + article likhne bhej raha hoon (facts table se).");
              const t3 = Date.now();
              const angleRes = await step("writer", "angle", {
                system: SYSTEM_EDITOR,
                prompt: anglePrompt(cand.title, factsBlock),
                maxTokens: 400,
                temperature: 0.7,
              });

              const writerCfg = await getAgentConfig("writer");
              const writerNotes = await getAgentSkillNotes("writer");
              const writerPromptText = writerV3Prompt({
                topic: cand.title,
                factsBlock,
                angle: angleRes.text,
                minWords,
                maxWords,
                tone: general.tone,
                rules,
              });
              const writerPersona = getWriterPersona(cand.title);
              let written = await runAgentStep("writer", "writing", {
                system: assembleAgentSystem(writerPersona, writerCfg, writerNotes),
                prompt: writerPromptText,
                maxTokens: 8000,
                temperature: 0.8,
              }, writerCfg);
              if (written.usedFallback) {
                await note("ceo", "ceo_to_agent", "fixed",
                  `Writer ka primary model fail hua (${written.primaryError ?? "error"}) — ${written.usedFallback} par chala.`);
              }
              article = parseArticleFields(written.text);
              if (!article.headline || !article.body) {
                await note("writer", "agent_to_ceo", "fixed",
                  "Output format galat tha — strict format reminder ke saath dobara likhwa raha hoon.",
                  `RAW OUTPUT (first 500 chars):\n${written.text.slice(0, 500)}`);
                written = await runAgentStep("writer", "writing", {
                  system: assembleAgentSystem(writerPersona, writerCfg, writerNotes),
                  prompt:
                    writerPromptText +
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

              // Code-side word-count enforcement
              let words = wordCount(article.body);
              let expandAttempts = 0;
              while (words < minWords && !article.flag_short && expandAttempts < 2) {
                expandAttempts++;
                await note("writer", "agent_to_ceo", "fixed", `Sirf ${words} words — unused facts ke saath expand attempt ${expandAttempts}/2.`);
                const used = article.body;
                const unused = facts!.facts.filter((f) => {
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

              // Quality & Humanizer agent check
              body = article.body;
              if (qualityRules.self_check) {
                await note("quality" as AgentId, "ceo_to_agent", "working", "Quality & Humanizer ko bhej raha hoon.");
                try {
                  const checked = await step("quality" as AgentId, "quality_check", {
                    system: SYSTEM_EDITOR,
                    prompt: qualityHumanizePrompt(body, rules, qualityRules),
                    maxTokens: 8000,
                    temperature: 0.4,
                  });
                  const { verdict, body: fixedBody } = parseQualityOutput(checked.text);
                  qualityNote = verdict;
                  if (fixedBody.length > body.length * 0.5) {
                    body = fixedBody;
                    await note("quality" as AgentId, "agent_to_ceo", "fixed", verdict);
                  } else {
                    await note("quality" as AgentId, "agent_to_ceo", "done", `${verdict} (original rakha)`);
                  }
                } catch (e) {
                  qualityNote = "Skipped (error) — original body rakha.";
                  await note("quality" as AgentId, "agent_to_ceo", "failed", `Error: ${e instanceof Error ? e.message : "unknown"}`);
                }
              }
            }

            // ── STAGE: VERIFYING / REVIEWERS (fact_checker, language_editor, discover_checker, dynamic reviewers) ──
            else if (stepObj.step_order > 4 && stepObj.step_order < 6) {
              if (!article) return;
              if (hasRunVerify) {
                completedAgents.add(agentKey);
                return;
              }
              hasRunVerify = true; // Run verify mode exactly once when we hit the first reviewer step

              const category = (article.category || "tech").toLowerCase();
              const { data: candRows } = await supabase
                .from("articles")
                .select("title, slug")
                .eq("status", "published")
                .eq("category", category)
                .order("published_at", { ascending: false })
                .limit(8);
              const linkCandidates = (candRows ?? []) as { title: string; slug: string }[];

              await note("seo", "ceo_to_agent", "working", "Verify Mode start — reviewer agents running.");
              const t4 = Date.now();
              verify = await runVerifyMode(
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
              body = stripInlineSourcesSection(insertInternalLinks(verify.article.body, verify.internalLinks));

              // Post-verify word count expansion
              if (wordCount(body) < minWords && !article.flag_short && facts?.facts?.length) {
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
                } catch { /* do nothing */ }
              }
              
              article.headline = verify.article.headline;
              article.title_meta = verify.article.title_meta;
              article.meta_description = verify.article.meta_description;

              if (pipeId) void updatePipelineRun(pipeId, { reviewer_scores: { ...verify.scores, loops: verify.loops } });
              stage("verify", `${verify.passed ? "PASSED" : "FAILED"} — fact=${verify.scores.fact} lang=${verify.scores.language} discover=${verify.scores.discover}, ${verify.loops} loop(s)`, { ms: Date.now() - t4 });
              await note("seo", "agent_to_ceo", verify.passed ? "done" : "failed",
                `Verify ${verify.passed ? "PASS" : "FAIL"} (fact ${verify.scores.fact}/10, language ${verify.scores.language}/10, discover ${verify.scores.discover}/10, ${verify.loops} loop).`);
            }

            // ── STAGE: FIXER ──
            else if (agentKey === "fixer") {
              // Handled inside Verify Mode, so no-op.
              completedAgents.add(agentKey);
              return;
            }

            // ── STAGE: IMAGE AGENT ──
            else if (agentKey === "image_agent") {
              if (!article) return;
              if (features.image_generation) {
                await note("image" as AgentId, "ceo_to_agent", "working", "Image agent ko header image banane bhej raha hoon.");
                try {
                  const img = await runImage(imagePrompt(article.headline, article.category || "tech"));
                  imageUrl = await uploadArticleImage(img.bytes, img.contentType, article.slug || sanitizeSlug(article.headline));
                  await note("image" as AgentId, "agent_to_ceo", "done", "Header image ban gaya + upload ho gaya.");
                } catch (e) {
                  await note("image" as AgentId, "agent_to_ceo", "failed", `Image generation fail: ${e instanceof Error ? e.message : "error"}`);
                  if (stepObj.is_blocking) throw e;
                }
              }
            }

            // ── STAGE: GENERIC DYNAMIC POST-PROCESSING AGENTS (step_order >= 7) ──
            else {
              if (!article) return;
              const cfg = await getAgentConfig(agentKey);
              const notes = await getAgentSkillNotes(agentKey);
              await note(agentKey as AgentId, "ceo_to_agent", "working", `${cfg?.display_name ?? agentKey} step starting.`);
              try {
                const promptText = genericStepPrompt(
                  cfg?.display_name ?? agentKey,
                  cfg?.instructions ?? "",
                  {
                    headline: article.headline,
                    title_meta: article.title_meta,
                    meta_description: article.meta_description,
                    body,
                  },
                  factsBlock,
                  imageUrl,
                );

                const res = await runAgentStep(agentKey, "self_check", {
                  system: assembleAgentSystem(SYSTEM_EDITOR, cfg, notes),
                  prompt: promptText,
                  maxTokens: 2000,
                  temperature: 0.5,
                }, cfg);

                const parsed = parseJson<{ status: string; message: string; output?: any }>(res.text);
                if (parsed.status === "failed") {
                  await note(agentKey as AgentId, "agent_to_ceo", "failed", parsed.message || "Failed.");
                  if (stepObj.is_blocking) {
                    throw new Error(`Blocking step ${agentKey} failed: ${parsed.message}`);
                  }
                } else {
                  await note(agentKey as AgentId, "agent_to_ceo", "done", parsed.message || "Completed.");
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : "error";
                await note(agentKey as AgentId, "agent_to_ceo", "failed", `Error running dynamic step: ${msg}`);
                if (stepObj.is_blocking) throw e;
              }
            }

            completedAgents.add(agentKey);
          } catch (error) {
            if (error instanceof PipelineEarlyExit) {
              throw error; // Let early exits bubble up to the main catch block to stop pipeline
            }
            const msg = error instanceof Error ? error.message : String(error);
            await note(agentKey as AgentId, "agent_to_ceo", "failed", `Step execution failed: ${msg}`);
            if (stepObj.is_blocking) {
              throw error;
            }
          }
        })
      );
    }

    if (!article) {
      throw new Error("No article was generated during pipeline execution");
    }
    const activeArticle = article as ArticleFields;
    const activeFacts = facts as FactsTable | null;

    // ── STAGE: SAVE & PUBLISH GATE ──
    const authorId = await getDefaultAuthorId();
    const activeVerify = verify as VerifyResult | null;
    const finalVerify = activeVerify ?? { passed: false, scores: { fact: 0, language: 0, discover: 0 }, loops: 0, issues: [] as any[] };
    const slug = await ensureUniqueSlug(sanitizeSlug(activeArticle.slug || activeArticle.headline));

    const { data: draft, error } = await supabase
      .from("articles")
      .insert({
        slug,
        title: activeArticle.headline,
        title_meta: activeArticle.title_meta,
        meta_description: activeArticle.meta_description,
        summary: activeArticle.summary,
        body,
        category: (activeArticle.category || "tech").toLowerCase(),
        image_url: imageUrl,
        author_id: authorId,
        source_urls: activeFacts ? activeFacts.sources.slice(0, 3).map((s) => ({ title: s.title, url: s.url, source: s.domain })) : [],
        status: "draft",
        published_at: null,
      })
      .select("id, title, slug")
      .single();
    if (error) throw error;
    drafts.push({ id: draft.id, title: draft.title, slug: draft.slug });

    const validators = await runHardValidators(
      {
        id: draft.id,
        title: activeArticle.headline,
        slug,
        body,
        image_url: imageUrl,
        source_urls: activeFacts ? activeFacts.sources.map((s) => ({ title: s.title, url: s.url, source: s.domain })) : [],
        flag_short: activeArticle.flag_short,
        factEntities: activeFacts ? factEntities(activeFacts) : [],
      },
      { minWords, maxWords },
    );
    if (pipeId) void updatePipelineRun(pipeId, { hard_validator_results: validators.results });
    const failedChecks = validators.results.filter((r) => !r.pass);
    stage("publish_gate", failedChecks.length
      ? `validators FAILED: ${failedChecks.map((f) => f.name).join(", ")}`
      : "all hard validators passed");

    const publishNow = general.auto_publish && finalVerify.passed && validators.pass;
    let gateFailure: any;
    if (publishNow) {
      await supabase
        .from("articles")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", draft.id);
      log.push(`  PUBLISHED ${draft.id}`);
      
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
      await note("ceo", "ceo_to_agent", "done", `Publish Gate PASS — "${activeArticle.headline}" live ho gaya.`);
    } else {
      gateFailure = {
        verify_passed: finalVerify.passed,
        reviewer_scores: { ...finalVerify.scores, loops: finalVerify.loops },
        outstanding_issues: finalVerify.issues.slice(0, 10),
        failed_validators: failedChecks,
        auto_publish: general.auto_publish,
      };
      await note("ceo", "ceo_to_agent", "failed",
        `Publish Gate FAIL — draft me rakha. ${!finalVerify.passed ? "Verify fail" : ""} ${failedChecks.length ? `validators: ${failedChecks.map((f) => f.name).join(", ")}` : ""}${!general.auto_publish ? " (auto-publish OFF)" : ""}`);
      log.push(`  Kept as DRAFT ${draft.id} (gate failed)`);
      if (general.auto_publish) {
        void notifyPipelineFailure({
          title: activeArticle.headline,
          status: "draft_failed",
          issues: [
            ...failedChecks.map((f) => ({ severity: f.severity, problem: `${f.name}: ${f.detail}` })),
            ...finalVerify.issues.map((i) => ({ severity: i.severity, problem: i.problem })),
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
          title: activeArticle.headline,
          wordCount: wordCount(body),
          qualityNote: `${qualityNote} | verify: fact ${finalVerify.scores.fact}, language ${finalVerify.scores.language}, discover ${finalVerify.scores.discover} (${finalVerify.loops} loop)`,
          seoNote: validators.pass ? "hard validators sab pass" : `validators fail: ${failedChecks.map((f) => f.name).join(", ")}`,
          willPublish: publishNow,
        }),
        maxTokens: 150,
        temperature: 0.6,
      });
      await note("ceo", "ceo_to_agent", "done", stripFences(verdict.text));
    } catch {
      await note("ceo", "ceo_to_agent", "done",
        `Team ne kaam pura kiya — "${activeArticle.headline}" ${publishNow ? "publish ho gaya" : "draft me hai (review needed)"}.`);
    }

    if (features.telegram_notifications) {
      try {
        await notifyDraft({ id: draft.id, title: activeArticle.headline, summary: activeArticle.summary });
        log.push("  Telegram: notified");
      } catch (e) {
        log.push(`  Telegram: failed (${e instanceof Error ? e.message : "error"})`);
      }
    }

    return finishAs(publishNow ? "published" : "draft_failed",
      publishNow ? "published" : "kept as draft (publish gate failed)",
      { articleId: draft.id, articleTitle: draft.title, failure: gateFailure });

  } catch (e) {
    if (e instanceof PipelineEarlyExit) {
      return finishAs(e.status, e.message);
    }
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
    const body = stripInlineSourcesSection(insertInternalLinks(verify.article.body, verify.internalLinks));
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
