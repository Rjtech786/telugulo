import type { Candidate } from "./sources";

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

export function selectionPrompt(candidates: Candidate[], count: number): string {
  const list = candidates
    .map((c, i) => `${i + 1}. [${c.source}] ${c.title}`)
    .join("\n");
  return `Here are today's candidate tech/AI news topics:

${list}

As the editor, pick the TOP ${count} topic(s) that are most interesting and relevant for Telugu tech readers. Prefer AI, gadgets, apps, smartphones, and things with India relevance. Avoid niche US-only business news.

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

export function writingPrompt(opts: {
  title: string;
  research: string;
  angle: string;
  lengthWords: number;
  tone: string;
}): string {
  return `${WRITING_RULES}

Now write a complete news article for telugulo.in.

Topic: "${opts.title}"
Angle for Telugu readers: ${opts.angle}
Tone: ${opts.tone}
Target length: about ${opts.lengthWords} words.

Research — use ONLY the facts here (rule 4). Do NOT copy sentences; write original Telugu. Do NOT add any fact that is not below:
${opts.research}

Structure: hook → context → explanation → ONE analytical "why this matters" sentence (rule 5) → concrete ending (rule 1). Short paragraphs, varied sentence length.

Respond in EXACTLY this format (plain text, no markdown, no JSON). Keep each of
the first six fields on a SINGLE line. The body comes last and can span many
lines:

HEADLINE: <clean declarative Telugu headline, no clickbait>
TITLE_META: <SEO title, under 60 chars>
META_DESCRIPTION: <SEO meta description in Telugu, under 160 chars>
SUMMARY: <2-3 line Telugu summary for the card>
SLUG: <telugu romanized, lowercase, hyphens, 4-6 words, keyword first, NO telugu script>
CATEGORY: <one of: ai, mobile, apps, gadgets, internet, tech>
BODY:
<the full article in hybrid Telugu, paragraphs separated by blank lines>`;
}

export function selfCheckPrompt(body: string): string {
  return `${WRITING_RULES}

You are a STRICT editor. Review this draft against ALL 8 rules above and fix every violation:
- Cut any generic feel-good ending; replace with a concrete fact/number/observation (rule 1).
- Break up any buzzword list (rule 2).
- Remove any fabricated local angle or any fact not clearly supported (rules 3 & 4).
- Ensure there is exactly one clear "why this matters" sentence (rule 5).
- Vary sentence length; add a short punchy sentence if it's too uniform (rule 6).
- Fix forced/textbook Telugu and robotic AI phrasing; keep tech terms in English (rule 7).
- Delete repeated points (rule 8).

Keep it natural and human. Do NOT shorten it much (only cut filler/repetition).

Draft:
${body}

Respond with ONLY the improved article text — no preamble, no JSON, no markdown.`;
}

export function imagePrompt(headline: string, category: string): string {
  // English prompt for the image model. Editorial, clean, no text-in-image.
  return `Editorial news header image for a technology article about: "${headline}". Category: ${category}. Modern, clean, professional tech-journalism style, soft studio lighting, vibrant but tasteful colors, landscape 16:9 composition. No text, no words, no watermark, no logos.`;
}
