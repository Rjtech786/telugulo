import type { Candidate } from "./sources";
import type { QualityRules } from "@/lib/config";

/**
 * Prompt templates for the agent. The article writing rules (owner-defined +
 * spec §5/§6/§7) live here so every article follows them.
 */

// Owner's strict article writing instructions — make it read like a human
// Telugu tech journalist, NOT AI-written.
export const WRITING_RULES = `
ARTICLE WRITING INSTRUCTIONS — the article must NOT feel "AI-written". It must read like a human Telugu tech journalist wrote it. Follow these rules STRICTLY:

1. NO GENERIC ENDING (CRITICAL): Never end with vague feel-good lines like "ఇది tech రంగం వృద్ధికి సహాయపడుతుంది". End with something CONCRETE — a date, a number, or a sharp observation. Never write a sentence that adds no new information.

2. BREAK UP BUZZWORD LISTS: Don't dump long lists ("performance, customer growth, enterprise adoption, partnerships, regulatory engagement, operations"). Take 2-3 key points max and fold them into a natural sentence.

3. NO FORCED LOCAL ANGLE (CRITICAL): Do NOT fabricate local connections like "ఇది తెలుగు రాష్ట్రాల్లో ఉద్యోగాలు పెంచుతుంది" if it's not in the source. Only add AP/Telangana relevance when there is a GENUINE connection in the facts.

4. ALL FACTS FROM THE SOURCE ONLY (CRITICAL — NO HALLUCINATION): Names, dates, companies, job titles — write ONLY what's in the provided source. If a fact isn't in the source, do NOT invent it. Transliterate proper nouns (people's names) consistently in Telugu.

5. ONE ANALYTICAL SENTENCE (MANDATORY): Beyond a plain news report, include exactly one "why this matters" sentence — what it signals, the logic behind it (e.g. "Uber నుండి OpenAI కి మారడం అంటే వాళ్ళు India లో enterprise కాదు, consumer-scale growth కోరుకుంటున్నారని అర్థం.").

6. VARY SENTENCE LENGTH: If every sentence is the same length it feels robotic. Use a short punchy sentence somewhere ("ఇది పెద్ద move."), then a longer one. Keep the rhythm varied.

7. HYBRID TELUGU STYLE: Keep tech terms & brand names in ENGLISH (AI, ChatGPT, enterprise, MD, partnership, app, smartphone, internet, software, update, online, login). Write the rest in NATURAL, SPOKEN Telugu (~70-80% Telugu). Avoid over-formal / textbook Telugu and forced translations (NOT "కృత్రిమ మేధ", NOT "అంతర్జాలం"). Example: "కొత్త AI టూల్ విడుదలైంది. ఇది చాలా smart గా పని చేస్తుంది."

8. NO REPETITION: Don't restate the same point in different words. Every paragraph must add NEW information.

HEADLINE: clean, declarative, specific. NO clickbait or sensationalism (Google Discover penalizes it).
`;

export const SYSTEM_EDITOR = `You are a writer/editor for telugulo.in, a Telugu tech & AI news blog. You write like an experienced human Telugu tech journalist — never robotic, never "AI-sounding". You think about what Telugu (Andhra Pradesh / Telangana) readers care about. You always respond in the exact format requested.`;

export function selectionPrompt(
  candidates: Candidate[],
  count: number,
  recentTitles: string[] = [],
): string {
  const list = candidates
    .map((c, i) => `${i + 1}. [${c.source}] ${c.title}`)
    .join("\n");
  const recent = recentTitles.length
    ? `\n\nWe ALREADY published these recently — do NOT pick the same story or a near-duplicate:\n${recentTitles
        .map((t) => `- ${t}`)
        .join("\n")}`
    : "";
  return `Here are today's candidate tech/AI news topics:

${list}${recent}

As the editor, pick the TOP ${count} topic(s) that are most interesting and relevant for Telugu tech readers. Prefer AI, gadgets, apps, smartphones, and things with India relevance. Avoid niche US-only business news. Avoid anything we already covered (listed above) — freshness matters.

If NONE are good enough today, set "skip" to true.

Respond ONLY with JSON (no markdown):
{"skip": false, "skipReason": "", "choices": [{"index": <number from the list>, "reason": "<why, 1 line>"}]}`;
}

export function anglePrompt(title: string, research: string): string {
  return `Topic: "${title}"

Research notes:
${research}

As the editor: what is the unique angle for Telugu / India readers? Why does this matter to them specifically? How should we frame it differently from generic English coverage?

IMPORTANT: only suggest a local (AP/Telangana/India) angle if there is a GENUINE connection in the facts above. Do NOT fabricate a local angle. If there's no real local hook, say so and give the general "why this matters" angle instead.

Answer in 3-4 sentences (you may mix Telugu + English).`;
}

/** Optional learned skill-notes block appended to writing prompts. */
function skillNotesBlock(notes?: string[]): string {
  if (!notes || notes.length === 0) return "";
  return `\n\nLEARNED NOTES (apply these — from past editor feedback):\n${notes
    .map((n) => `- ${n}`)
    .join("\n")}`;
}

/** DB-driven quality rules rendered as a strict block for the prompts. */
export function qualityBlock(qr?: QualityRules): string {
  if (!qr) return "";
  const lines = [`- LENGTH: ${qr.min_words}-${qr.max_words} words (stay in this range).`];
  if (qr.facts_only)
    lines.push(
      "- FACTS-ONLY (CRITICAL): use ONLY facts present in the SOURCES below. Do NOT invent names, dates, numbers, prices or quotes. If a detail is not in the sources, leave it out. Never guess a date.",
    );
  if (qr.require_local_angle)
    lines.push("- LOCAL ANGLE: include a GENUINE Telugu / AP / Telangana / India angle (only if real).");
  if (qr.ban_ai_slop)
    lines.push("- NO AI-SLOP: cut generic feel-good filler and buzzword lists. Write like a real human Telugu journalist.");
  return `\n\nQUALITY RULES (STRICT — follow exactly):\n${lines.join("\n")}`;
}

export function writingPrompt(opts: {
  title: string;
  research: string;
  angle: string;
  lengthWords: number;
  tone: string;
  rules?: string; // DB-driven instructions (falls back to WRITING_RULES)
  skillNotes?: string[];
  quality?: QualityRules;
}): string {
  return `${opts.rules ?? WRITING_RULES}${qualityBlock(opts.quality)}${skillNotesBlock(opts.skillNotes)}

Now write a complete news article for telugulo.in.

Topic: "${opts.title}"
Angle for Telugu readers: ${opts.angle}
Tone: ${opts.tone}
Target length: about ${opts.lengthWords} words.

SOURCES — use ONLY the facts here (no hallucination). Do NOT copy sentences; write original Telugu. Do NOT add any fact that is not below:
${opts.research}

Structure: strong hook (no "ఇటీవల/recently" filler) → context → explanation → ONE analytical "why this matters" sentence (rule 5) → concrete ending (rule 1). Short paragraphs, varied sentence length. Break the article with 2-3 short Telugu "## subheadings" so it is scannable, and put the single most important fact in **bold** (once).

Respond in EXACTLY this format. Keep each of the first six fields on a SINGLE
line of plain text (no markdown in those). The BODY comes last, may use light
markdown (## subheadings, **bold**) and can span many lines:

HEADLINE: <clean declarative Telugu headline, no clickbait>
TITLE_META: <SEO title, under 60 chars>
META_DESCRIPTION: <SEO meta description in Telugu, under 160 chars>
SUMMARY: <2-3 line Telugu summary for the card>
SLUG: <telugu romanized, lowercase, hyphens, 4-6 words, keyword first, NO telugu script>
CATEGORY: <one of: ai, mobile, apps, gadgets, internet, tech>
BODY:
<the full article in hybrid Telugu, short paragraphs separated by blank lines, with 2-3 ## subheadings>`;
}

export function selfCheckPrompt(body: string, rules?: string, quality?: QualityRules): string {
  return `${rules ?? WRITING_RULES}${qualityBlock(quality)}

You are a STRICT editor. Review this draft against ALL the rules above and fix every violation:
- If FACTS-ONLY is set: remove any name/date/number/quote that looks invented or unsupported.
- Cut any generic feel-good ending; replace with a concrete fact/number/observation (rule 1).
- Break up any buzzword list (rule 2).
- Remove any fabricated local angle or any fact not clearly supported (rules 3 & 4).
- Ensure there is exactly one clear "why this matters" sentence (rule 5).
- Vary sentence length; add a short punchy sentence if it's too uniform (rule 6).
- Fix forced/textbook Telugu and robotic AI phrasing; keep tech terms in English (rule 7).
- Delete repeated points (rule 8).

Keep it natural and human. Do NOT shorten it much (only cut filler/repetition).
Preserve the markdown structure — keep the ## subheadings, **bold**, and short
paragraphs.

Draft:
${body}

Respond with ONLY the improved article text (keep its markdown) — no preamble, no JSON.`;
}

/** Revise an existing article body per an owner instruction (keeps the rules). */
export function revisePrompt(body: string, instruction: string, rules?: string): string {
  return `${rules ?? WRITING_RULES}

You are editing an EXISTING telugulo.in article. Apply this instruction from the owner:
"${instruction}"

Keep everything that already works. Follow all the rules above. Keep the hybrid
Telugu style and the markdown structure (## subheadings, **bold**, short paragraphs).

Current article:
${body}

Respond with ONLY the revised full article body (markdown) — no preamble, no JSON.`;
}

// ─── Quality & Humanizer agent (CEO system) ───
// Checks the draft is meaning-complete + reads human, and — critically —
// simplifies any hard/textbook/literary Telugu into natural spoken Telugu
// that an average reader understands instantly. Always auto-fixes inline
// (no back-and-forth with the writer) and reports what it changed.
export function qualityHumanizePrompt(body: string, rules?: string, quality?: QualityRules): string {
  return `${rules ?? WRITING_RULES}${qualityBlock(quality)}

You are the QUALITY & HUMANIZER agent. Review this draft for THREE things and fix problems directly (do not ask anyone — just fix it):

1. MEANING-COMPLETE: does every paragraph make complete sense? No half-finished thoughts, no sentence that trails off, no broken logic. Fix any gap.
2. HUMAN-SOUNDING: does it read like a human Telugu journalist, not an AI? Remove robotic phrasing, generic filler, repeated points.
3. SIMPLIFY HARD TELUGU (CRITICAL): if any word/phrase is heavy literary/textbook Telugu (Sanskrit-loaded, formal, or a word an average person doesn't use in daily speech), replace it with the simple, spoken, everyday Telugu word. Example: replace "అత్యంత ప్రాముఖ్యత" with something like "చాలా ముఖ్యమైన", replace "పరిశోధనలు సూచిస్తున్నాయి" with "study prakaram". Keep tech/brand words in English as usual (rule 7). The goal: a normal Telugu reader (not a scholar) should understand every sentence on the first read, with zero friction.

Keep the markdown structure (## subheadings, **bold**, short paragraphs). Do NOT shorten the article meaningfully — only fix/simplify.

Draft:
${body}

Respond in EXACTLY this format:
VERDICT: <one short line — what you fixed, e.g. "Simplified 4 hard words, fixed one broken sentence" or "OK — already clear and human">
BODY:
<the full corrected article, markdown preserved>`;
}

// ─── SEO agent (CEO system) ───
// Audits + auto-fixes the SEO-facing fields, checks headline-body alignment
// (Google's Feb-2026 Discover classifier suppresses mismatches), and inserts
// 2-3 internal links to related past articles. Always fixes inline (no
// round-trip to the writer).
export function seoAuditPrompt(input: {
  headline: string;
  title_meta: string;
  meta_description: string;
  slug: string;
  body: string;
  relatedArticles?: { title: string; slug: string }[];
}): string {
  const relatedBlock = input.relatedArticles?.length
    ? `\n\nRELATED PAST ARTICLES on telugulo.in you may link to (use ONLY these exact slugs, do not invent any):\n${input.relatedArticles
        .map((r, i) => `${i + 1}. "${r.title}" -> /${r.slug}/`)
        .join("\n")}`
    : "";
  return `You are the SEO agent for telugulo.in (Google Discover + Search matter a lot). Audit these fields for a Telugu news article and FIX any problems directly:

HEADLINE: ${input.headline}
TITLE_META (must be <=60 chars, compelling, keyword near the front): ${input.title_meta}
META_DESCRIPTION (must be <=160 chars, natural Telugu, includes the key fact): ${input.meta_description}
SLUG (must be romanized lowercase, hyphens only, no Telugu script, 4-6 keyword-first words): ${input.slug}

BODY (check it has 2-3 "## " subheadings and the main keyword appears early):
${input.body}

TASKS:
1. HEADLINE-BODY ALIGNMENT (CRITICAL): does the HEADLINE accurately represent what the BODY actually says, with nothing overpromised or clickbait-y? Google's Discover classifier suppresses headline-content mismatches even when the body itself is accurate. If it overpromises or doesn't match, REWRITE the headline to honestly reflect the body (still clean and engaging). If it's already aligned, return it unchanged.
2. Fix TITLE_META/META_DESCRIPTION/SLUG if they violate any rule above (length, clickbait, missing keyword, bad slug format). If a field is already fine, return it unchanged.${
    input.relatedArticles?.length
      ? `\n3. INTERNAL LINKING: naturally insert 2-3 contextual internal links into the BODY pointing to the most topically relevant articles from the list below, using markdown link syntax like [anchor text](/slug/). Prefer anchor text from words/phrases already in the body, or add a short natural connecting phrase. Only link articles that are a genuine topical fit — use fewer than 2-3, or none, if nothing fits well. Do NOT change any fact or meaning in the body — only add link markup and, if needed, a couple of connecting words.${relatedBlock}`
      : ""
  }

Respond in EXACTLY this format (HEADLINE/TITLE_META/META_DESCRIPTION/SLUG each on a single plain-text line, BODY last and may span many lines with its markdown preserved):
VERDICT: <one short line — what you fixed, e.g. "Rewrote mismatched headline, added 2 internal links" or "OK — all fields already clean">
HEADLINE: <final headline>
TITLE_META: <final value>
META_DESCRIPTION: <final value>
SLUG: <final value>
BODY:
<final body, markdown preserved, with any internal links inserted>`;
}

// ─── CEO agent — final verdict on a completed run ───
export function ceoVerdictPrompt(summary: {
  title: string;
  wordCount: number;
  qualityNote: string;
  seoNote: string;
  willPublish: boolean;
}): string {
  return `You are the CEO of the telugulo.in AI newsroom. Your team just finished producing this article:

Title: ${summary.title}
Length: ~${summary.wordCount} words
Quality & Humanizer agent report: ${summary.qualityNote}
SEO agent report: ${summary.seoNote}
Publish decision: ${summary.willPublish ? "will auto-publish now" : "saved as draft for owner review"}

As CEO, write ONE short, confident sentence (Hinglish/hybrid Telugu ok) giving your final verdict on this run to the owner — like a real CEO signing off on their team's work. Be specific (mention the fixes if any), not generic.

Respond with ONLY that one sentence, no preamble, no quotes.`;
}

// ─── Performance agent — weekly self-learning from real traffic data ───
export function performanceAnalysisPrompt(digest: string): string {
  return `You are the PERFORMANCE agent for telugulo.in. Below is REAL traffic data (page views) from recently published articles, broken down by category, word count, and headline length.

${digest}

Based ONLY on this data (do not assume anything not shown), identify 2-5 concrete, actionable patterns that separate higher-traffic from lower-traffic articles. Each insight must be something the Writer/Topic Scout agents can directly apply going forward (e.g. "AI category articles get far more traffic than gadgets — prioritize AI topics when picking today's story" or "Articles under 800 words outperform longer ones — keep length closer to the lower end").

If the sample is too small or noisy to say anything confident and specific, return fewer insights (even zero) rather than inventing a shaky pattern.

Respond ONLY with JSON (no markdown):
{"insights": [{"problem_type": "<short label, e.g. 'category performance'>", "solution_note": "<one actionable sentence>"}]}`;
}

// ─── Ads: AI ad-copy composer (image + link + keywords → polished ad) ───
export const AD_SYSTEM = `You write short, punchy ad copy in hybrid Telugu (keep tech/brand words in English) for telugulo.in sponsored placements. Natural and catchy, never spammy or clickbait. You always reply in the exact JSON requested.`;

export function adCopyPrompt(input: {
  title?: string;
  keywords: string[];
  link: string;
}): string {
  return `Create ad copy for a sponsored placement shown INSIDE Telugu tech articles. There is an accompanying product/banner image, so the copy should complement a visual.

Advertiser / product: ${input.title || "(not given — infer from keywords/link)"}
Target keywords: ${input.keywords.join(", ") || "(none)"}
Destination link: ${input.link}

Write:
- headline: catchy hybrid-Telugu headline, max 8 words (no clickbait)
- description: ONE short hybrid-Telugu line (max 15 words) with the benefit/offer
- cta: 2-3 word Telugu button text (e.g. "ఇప్పుడే చూడండి", "కొనండి", "తెలుసుకోండి")

Respond ONLY with JSON (no markdown):
{"headline":"...","description":"...","cta":"..."}`;
}

export function imagePrompt(headline: string, category: string): string {
  // English prompt for the image model. Editorial, clean, no text-in-image.
  return `Editorial news header image for a technology article about: "${headline}". Category: ${category}. Modern, clean, professional tech-journalism style, soft studio lighting, vibrant but tasteful colors, landscape 16:9 composition. No text, no words, no watermark, no logos.`;
}
