import type { Candidate } from "./sources";

/**
 * Prompt templates for the agent. The hybrid Telugu rules (spec §5) and the
 * Discover/SEO rules live here so every article follows them.
 */

export const HYBRID_TELUGU_RULES = `
WRITING STYLE — "Hybrid Telugu" (very important):
- Write like a popular Telugu tech YouTuber talking naturally — ~70-80% Telugu, ~20-30% English.
- Keep these in ENGLISH (do NOT translate to pure Telugu): tech terms (AI, internet, smart, phone, app, software, download, update, online, website, login, account), brand/product names (ChatGPT, iPhone, WhatsApp, Google, Android, YouTube), and common English words already used in Telugu speech (mobile, computer, video, photo, message, link, click).
- Keep sentences, explanations, connecting words, feelings and context in TELUGU script.
- Example (correct): "కొత్త AI టూల్ విడుదలైంది. ఇది చాలా smart గా పని చేస్తుంది. మీ phone లో internet ఉంటే చాలు."
- Do NOT force-translate tech words into dictionary Telugu (e.g. avoid "కృత్రిమ మేధ", "అంతర్జాలం").
- Headlines: clean, declarative, specific. NO clickbait or sensationalism (Google Discover penalizes it).
- No robotic AI phrases like "comprehensive", "dives into", "in this article we will explore". Write like a human.
`;

export const SYSTEM_EDITOR = `You are the editor of telugulo.in, a Telugu tech & AI news blog. You think about what Telugu (Andhra Pradesh / Telangana) readers care about. You always respond in the exact format requested.`;

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

As the editor: what is the unique angle for Telugu / India readers? Why does this matter to them specifically? How should we frame it differently from generic English coverage? Local relevance is our edge.

Answer in 3-4 sentences (you may mix Telugu + English).`;
}

export function writingPrompt(opts: {
  title: string;
  research: string;
  angle: string;
  lengthWords: number;
  tone: string;
}): string {
  return `${HYBRID_TELUGU_RULES}

Write a complete news article for telugulo.in.

Topic: "${opts.title}"
Angle for Telugu readers: ${opts.angle}
Tone: ${opts.tone}
Target length: about ${opts.lengthWords} words.

Research (use facts from here, do NOT copy sentences — write original Telugu):
${opts.research}

Structure: hook → context → explanation → takeaway. Use short paragraphs.

Respond ONLY with JSON (no markdown fences):
{
  "headline": "<clean declarative Telugu headline, no clickbait>",
  "title_meta": "<SEO title, <60 chars>",
  "meta_description": "<SEO meta description in Telugu, <160 chars>",
  "summary": "<2-3 line Telugu summary for the card/Telegram>",
  "slug": "<telugu romanized, lowercase, hyphens, 4-6 words, keyword first, NO telugu script>",
  "category": "<one of: ai, mobile, apps, gadgets, internet, tech>",
  "body": "<the full article in hybrid Telugu, plain text with blank lines between paragraphs>"
}`;
}

export function selfCheckPrompt(body: string): string {
  return `${HYBRID_TELUGU_RULES}

Review this draft as a strict editor. Fix any robotic AI phrasing, forced Telugu translations of tech words, or factual hedging. Keep it natural and human. Do NOT shorten it much.

Draft:
${body}

Respond ONLY with JSON: {"body": "<the improved article>"}`;
}

export function imagePrompt(headline: string, category: string): string {
  // English prompt for the image model. Editorial, clean, no text-in-image.
  return `Editorial news header image for a technology article about: "${headline}". Category: ${category}. Modern, clean, professional tech-journalism style, soft studio lighting, vibrant but tasteful colors, landscape 16:9 composition. No text, no words, no watermark, no logos.`;
}
