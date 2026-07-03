import "server-only";
import { getAgentConfig, getAgentSkillNotes, assembleAgentSystem, runAgentStep } from "./agentConfigs";
import { listBannedPhrases, addBannedPhrase } from "./bannedPhrases";
import {
  factCheckerPrompt,
  languageEditorPrompt,
  discoverCheckerPrompt,
  fixerPrompt,
} from "./prompts";

/**
 * V3 STAGE 4 — VERIFY MODE (spec §5). Three reviewer agents run in parallel
 * on the draft; a Fixer applies their issues; re-check; max 3 loops. The
 * article passes only when all three reviewers pass with average score >= 8.
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
    const m = s.match(new RegExp(`^${label}:[ \\t]*(.*)$`, "mi"));
    return m ? m[1].trim() : "";
  };
  const bodyMatch = s.match(/^BODY:[ \t]*\n?([\s\S]*)$/im);
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

export async function runVerifyMode(
  input: VerifyArticle,
  factsBlock: string,
  candidates: { title: string; slug: string }[],
  note: (msg: string, agent?: "fact_checker" | "language_editor" | "discover_checker" | "fixer", status?: "working" | "done" | "fixed" | "failed") => Promise<void>,
  minWords = 600,
  maxLoops = 3,
): Promise<VerifyResult> {
  let article = { ...input };
  let lastLinks: { slug: string; anchor: string }[] = [];
  let lastIssues: ReviewerIssue[] = [];
  let scores = { fact: 0, language: 0, discover: 0 };

  const [factCfg, langCfg, discCfg, fixCfg, banned] = await Promise.all([
    getAgentConfig("fact_checker"),
    getAgentConfig("language_editor"),
    getAgentConfig("discover_checker"),
    getAgentConfig("fixer"),
    listBannedPhrases(),
  ]);
  const [factNotes, langNotes, discNotes] = await Promise.all([
    getAgentSkillNotes("fact_checker"),
    getAgentSkillNotes("language_editor"),
    getAgentSkillNotes("discover_checker"),
  ]);

  for (let loop = 1; loop <= maxLoops; loop++) {
    await note(`Verify loop ${loop}/${maxLoops} — teeno reviewers ko parallel bhej raha hoon.`);

    const [fact, lang, disc] = await Promise.all([
      factCfg?.enabled === false
        ? Promise.resolve(PASSED)
        : runAgentStep("fact_checker", "fact_check", {
            system: assembleAgentSystem("You review strictly and reply with exact JSON.", factCfg, factNotes),
            prompt: factCheckerPrompt(article.body, article.headline, factsBlock),
            maxTokens: 4000, // long Telugu quotes in issue JSON — 2000 was truncating (parse fail → score 0)
            temperature: 0,
          }, factCfg).then((r) => normalize(parseJson<ReviewerOutput>(r.text))).catch(() => normalize(null)),
      langCfg?.enabled === false
        ? Promise.resolve(PASSED)
        : runAgentStep("language_editor", "language_edit", {
            system: assembleAgentSystem("You review Telugu strictly and reply with exact JSON.", langCfg, langNotes),
            prompt: languageEditorPrompt(article.body, banned),
            maxTokens: 4000,
            temperature: 0,
          }, langCfg).then((r) => normalize(parseJson<ReviewerOutput>(r.text))).catch(() => normalize(null)),
      discCfg?.enabled === false
        ? Promise.resolve(PASSED)
        : runAgentStep("discover_checker", "discover_check", {
            system: assembleAgentSystem("You review for Google Discover strictly and reply with exact JSON.", discCfg, discNotes),
            prompt: discoverCheckerPrompt({
              headline: article.headline,
              meta_description: article.meta_description,
              body: article.body,
              sources: [],
              candidates,
            }),
            maxTokens: 3000,
            temperature: 0,
          }, discCfg).then((r) => normalize(parseJson<ReviewerOutput>(r.text))).catch(() => normalize(null)),
    ]);

    scores = { fact: fact.score, language: lang.score, discover: disc.score };
    if (disc.internal_links?.length) lastLinks = disc.internal_links;

    // Self-learning: store newly found nonsense phrases.
    for (const p of lang.new_banned_phrases ?? []) {
      if (p.phrase) await addBannedPhrase(p.phrase, p.replacement, p.reason ?? "found by language editor");
    }

    const allIssues = [...fact.issues, ...lang.issues, ...disc.issues];
    lastIssues = allIssues;
    const avg = (fact.score + lang.score + disc.score) / 3;
    await note(
      `Loop ${loop}: fact=${fact.score} language=${lang.score} discover=${disc.score} (${allIssues.length} issues)`,
      undefined,
      allIssues.length ? "fixed" : "done",
    );

    if (fact.pass && lang.pass && disc.pass && avg >= 8) {
      return { passed: true, loops: loop, scores, issues: [], article, internalLinks: lastLinks };
    }
    if (loop === maxLoops) break;
    if (fixCfg?.enabled === false) break;

    // FIXER — full-flow rewrite of the affected sentences.
    await note(`Fixer ko ${allIssues.length} issues ke saath bhej raha hoon.`, "fixer", "working");
    try {
      const fixed = await runAgentStep("fixer", "fixer", {
        system: assembleAgentSystem("You fix articles precisely without adding unsupported facts.", fixCfg, await getAgentSkillNotes("fixer")),
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
