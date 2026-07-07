import "server-only";
import { getAgentConfig, getAgentSkillNotes, assembleAgentSystem, runAgentStep } from "./agentConfigs";
import { listPipelineSteps } from "./pipelineSteps";
import { listBannedPhrases, addBannedPhrase } from "./bannedPhrases";
import {
  factCheckerPrompt,
  languageEditorPrompt,
  discoverCheckerPrompt,
  fixerPrompt,
} from "./prompts";

/**
 * V3 STAGE 4 — VERIFY MODE (spec §5). Reviewer agents run in parallel
 * on the draft; a Fixer applies their issues; re-check; max 3 loops. The
 * article passes only when all reviewers pass with average score >= 8.
 */

export type ReviewerIssue = {
  severity: "critical" | "major" | "minor";
  location: string;
  problem: string;
  suggested_fix: string;
};

type ReviewerOutput = {
  score: number;
  pass: boolean;
  issues: ReviewerIssue[];
  new_banned_phrases?: { phrase: string; replacement?: string; reason?: string }[];
  internal_links?: { slug: string; anchor: string }[];
};

export type VerifyArticle = {
  headline: string;
  title_meta: string;
  meta_description: string;
  body: string;
};

export type VerifyResult = {
  passed: boolean;
  loops: number;
  scores: { fact: number; language: number; discover: number };
  issues: ReviewerIssue[]; // outstanding issues from the last loop
  article: VerifyArticle; // possibly fixed
  internalLinks: { slug: string; anchor: string }[];
};

function parseJson<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return JSON.parse(s) as T;
}

function normalize(out: Partial<ReviewerOutput> | null): ReviewerOutput {
  return {
    score: typeof out?.score === "number" ? Math.max(0, Math.min(10, out.score)) : 0,
    pass: Boolean(out?.pass),
    issues: Array.isArray(out?.issues) ? (out!.issues as ReviewerIssue[]).slice(0, 20) : [],
    new_banned_phrases: out?.new_banned_phrases ?? [],
    internal_links: out?.internal_links ?? [],
  };
}

const PASSED: ReviewerOutput = { score: 10, pass: true, issues: [] };

function parseFixerOutput(raw: string, prev: VerifyArticle): VerifyArticle {
  const s = raw.trim().replace(/^```(?:\w+)?|```$/g, "");
  const field = (label: string) => {
    const m = s.match(new RegExp(`^[ \\t>#]*\\**${label}\\**[ \\t]*:[ \\t]*(.*)$`, "mi"));
    return m ? m[1].trim().replace(/^\*+|\*+$/g, "").trim() : "";
  };
  const bodyMatch = s.match(/^[ \t>#]*\**BODY\**[ \t]*:[ \t]*\n?([\s\S]*)$/im);
  const body = bodyMatch ? bodyMatch[1].trim() : "";
  return {
    headline: field("HEADLINE") || prev.headline,
    title_meta: field("TITLE_META") || prev.title_meta,
    meta_description: field("META_DESCRIPTION") || prev.meta_description,
    body: body.length > prev.body.length * 0.5 ? body : prev.body,
  };
}

/** Insert vetted internal links into the body (first anchor occurrence). */
export function insertInternalLinks(
  body: string,
  links: { slug: string; anchor: string }[],
): string {
  let out = body;
  for (const l of links.slice(0, 2)) {
    const anchor = l.anchor?.trim();
    if (!anchor || !l.slug) continue;
    if (out.includes(`(/${l.slug}/)`)) continue; // already linked
    const idx = out.indexOf(anchor);
    if (idx === -1) continue; // anchor text not in body — skip (never force)
    out = `${out.slice(0, idx)}[${anchor}](/${l.slug}/)${out.slice(idx + anchor.length)}`;
  }
  return out;
}

const genericReviewerPrompt = (
  agentName: string,
  instructions: string,
  article: VerifyArticle,
  factsBlock: string,
) => `
You are the ${agentName} reviewer.
Your specific instructions:
${instructions}

Please review the following article:
HEADLINE: ${article.headline}
TITLE_META: ${article.title_meta}
META_DESCRIPTION: ${article.meta_description}
BODY:
${article.body}

FACTS TABLE (for reference):
${factsBlock}

You MUST reply with a JSON object matching this schema:
{
  "score": number, // 0-10 score
  "pass": boolean, // true if passes, false if needs fix
  "issues": [
    {
      "severity": "critical" | "major" | "minor",
      "location": string, // brief sentence or section where the issue is
      "problem": string, // description of the problem
      "suggested_fix": string // how to fix it
    }
  ]
}
No preamble, no explanation, only valid JSON.
`;

export async function runVerifyMode(
  input: VerifyArticle,
  factsBlock: string,
  candidates: { title: string; slug: string }[],
  note: (
    msg: string,
    agent?: string,
    status?: "working" | "done" | "fixed" | "failed",
  ) => Promise<void>,
  minWords = 600,
  sharedRules = "",
  maxLoops = 3,
): Promise<VerifyResult> {
  const reviewerBase = (role: string) =>
    `${sharedRules ? `NEWSROOM HOUSE RULES (judge against THESE):\n${sharedRules}\n\n` : ""}${role}`;
  let article = { ...input };
  let lastLinks: { slug: string; anchor: string }[] = [];
  let lastIssues: ReviewerIssue[] = [];
  let scores = { fact: 0, language: 0, discover: 0 };

  const [steps, fixCfg, banned] = await Promise.all([
    listPipelineSteps().catch(() => []),
    getAgentConfig("fixer"),
    listBannedPhrases(),
  ]);

  // Filter steps where step_order is between writer and fixer (order > 4 and order < 6)
  let reviewerSteps = steps.filter((s) => s.enabled && s.step_order > 4 && s.step_order < 6);
  if (reviewerSteps.length === 0) {
    // Fallback default reviewers if table is empty/not loaded yet
    reviewerSteps = [
      { agent_key: "fact_checker" },
      { agent_key: "language_editor" },
      { agent_key: "discover_checker" },
    ] as any;
  }

  const reviewerConfigs = await Promise.all(
    reviewerSteps.map(async (s) => {
      const cfg = await getAgentConfig(s.agent_key);
      const notes = await getAgentSkillNotes(s.agent_key);
      return { step: s, cfg, notes };
    }),
  );

  for (let loop = 1; loop <= maxLoops; loop++) {
    const activeNames = reviewerConfigs.map((r) => r.cfg?.display_name ?? r.step.agent_key).join(" + ");
    await note(`Verify loop ${loop}/${maxLoops} — reviewers (${activeNames}) ko parallel bhej raha hoon.`);

    const reviews = await Promise.all(
      reviewerConfigs.map(async ({ step: s, cfg, notes }) => {
        if (cfg?.enabled === false) return PASSED;

        if (s.agent_key === "fact_checker") {
          try {
            const res = await runAgentStep("fact_checker", "fact_check", {
              system: assembleAgentSystem(reviewerBase("You review strictly and reply with exact JSON."), cfg, notes),
              prompt: factCheckerPrompt(article.body, article.headline, factsBlock),
              maxTokens: 4000,
              temperature: 0,
            }, cfg);
            return normalize(parseJson<ReviewerOutput>(res.text));
          } catch {
            return normalize(null);
          }
        }

        if (s.agent_key === "language_editor") {
          try {
            const res = await runAgentStep("language_editor", "language_edit", {
              system: assembleAgentSystem(reviewerBase("You review Telugu strictly and reply with exact JSON."), cfg, notes),
              prompt: languageEditorPrompt(article.body, banned),
              maxTokens: 4000,
              temperature: 0,
            }, cfg);
            return normalize(parseJson<ReviewerOutput>(res.text));
          } catch {
            return normalize(null);
          }
        }

        if (s.agent_key === "discover_checker") {
          try {
            const res = await runAgentStep("discover_checker", "discover_check", {
              system: assembleAgentSystem(reviewerBase("You review for Google Discover strictly and reply with exact JSON."), cfg, notes),
              prompt: discoverCheckerPrompt({
                headline: article.headline,
                meta_description: article.meta_description,
                body: article.body,
                sources: [],
                candidates,
              }),
              maxTokens: 3000,
              temperature: 0,
            }, cfg);
            return normalize(parseJson<ReviewerOutput>(res.text));
          } catch {
            return normalize(null);
          }
        }

        // Generic dynamic reviewer
        try {
          const res = await runAgentStep(s.agent_key, "self_check", {
            system: assembleAgentSystem(
              reviewerBase(`You are the ${cfg?.display_name ?? s.agent_key} reviewer. Review strictly and reply with exact JSON.`),
              cfg,
              notes,
            ),
            prompt: genericReviewerPrompt(cfg?.display_name ?? s.agent_key, cfg?.instructions ?? "", article, factsBlock),
            maxTokens: 3000,
            temperature: 0,
          }, cfg);
          return normalize(parseJson<ReviewerOutput>(res.text));
        } catch {
          return normalize(null);
        }
      }),
    );

    // Compute scores for the 3 built-ins for stats mapping (fall back to 10 if skipped)
    const factScore = reviews.find((_, i) => reviewerSteps[i].agent_key === "fact_checker")?.score ?? 10;
    const langScore = reviews.find((_, i) => reviewerSteps[i].agent_key === "language_editor")?.score ?? 10;
    const discScore = reviews.find((_, i) => reviewerSteps[i].agent_key === "discover_checker")?.score ?? 10;
    scores = { fact: factScore, language: langScore, discover: discScore };

    // Set last links if any
    for (const r of reviews) {
      if (r.internal_links?.length) {
        lastLinks = r.internal_links;
      }
      for (const p of r.new_banned_phrases ?? []) {
        if (p.phrase) {
          await addBannedPhrase(p.phrase, p.replacement, p.reason ?? "found by language editor");
        }
      }
    }

    const allIssues = reviews.flatMap((r) => r.issues);
    lastIssues = allIssues;

    const avg = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
    await note(
      `Loop ${loop}: fact=${factScore} language=${langScore} discover=${discScore} (avg=${avg.toFixed(1)}, ${allIssues.length} issues)`,
      undefined,
      allIssues.length ? "fixed" : "done",
    );

    const noCritical = allIssues.every((i) => i.severity !== "critical");
    if (avg >= 8 && noCritical) {
      return { passed: true, loops: loop, scores, issues: [], article, internalLinks: lastLinks };
    }

    if (loop === maxLoops) break;
    if (fixCfg?.enabled === false) break;

    // FIXER — full-flow rewrite of the affected sentences.
    await note(`Fixer ko ${allIssues.length} issues ke saath bhej raha hoon.`, "fixer", "working");
    try {
      const fixed = await runAgentStep("fixer", "fixer", {
        system: assembleAgentSystem(reviewerBase("You fix articles precisely without adding unsupported facts."), fixCfg, await getAgentSkillNotes("fixer")),
        prompt: fixerPrompt({ ...article, factsBlock, issues: allIssues, minWords }),
        maxTokens: 8000,
        temperature: 0.3,
      }, fixCfg);
      article = parseFixerOutput(fixed.text, article);
      await note("Fixer ne corrected version de diya — dobara check kar raha hoon.", "fixer", "done");
    } catch (e) {
      await note(`Fixer fail hua: ${e instanceof Error ? e.message : "err"}`, "fixer", "failed");
      break;
    }
  }

  return { passed: false, loops: maxLoops, scores, issues: lastIssues, article, internalLinks: lastLinks };
}
