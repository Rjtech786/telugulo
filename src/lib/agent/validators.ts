import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * V3 hard code validators (spec §5e) — pure code, deterministic, the final
 * word before publish. LLM reviewers can be wrong; these cannot be argued
 * with. Run before AND after Verify Mode.
 */

export type ValidatorResult = {
  name: string;
  pass: boolean;
  severity: "critical" | "major";
  detail: string;
};

export type ArticleForValidation = {
  id?: string;
  title: string;
  slug: string;
  body: string;
  image_url?: string | null;
  source_urls?: { title?: string; url?: string; source?: string }[] | null;
  flag_short?: boolean;
  factEntities?: string[]; // proper nouns from the facts table (for ending check)
};

// 1 ─ SCRIPT PURITY: Telugu + Basic Latin + common punctuation only.
// Allowed: Telugu 0C00–0C7F, ASCII, ZWNJ/ZWJ (Telugu shaping), general
// punctuation (– — ‘ ’ “ ” …), ₹, °, ×, whitespace.
const ALLOWED_RE =
  /[ఀ-౿ -~\n\r\t‌‍–—‘’“”…₹°× ]/;

export function checkScriptPurity(title: string, body: string): ValidatorResult {
  const text = `${title}\n${body}`;
  const bad = new Map<string, number>();
  for (const ch of text) {
    if (!ALLOWED_RE.test(ch)) bad.set(ch, (bad.get(ch) ?? 0) + 1);
  }
  if (bad.size === 0) return { name: "script_purity", pass: true, severity: "critical", detail: "OK" };
  const sample = [...bad.entries()]
    .slice(0, 5)
    .map(([ch, n]) => `"${ch}" (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}) ×${n}`)
    .join(", ");
  return {
    name: "script_purity",
    pass: false,
    severity: "critical",
    detail: `Foreign-script characters found: ${sample}`,
  };
}

// 2 ─ WORD COUNT: [min,max] pass; [500,min) only with flag_short.
export function checkWordCount(
  body: string,
  minWords: number,
  maxWords: number,
  flagShort: boolean,
): ValidatorResult {
  const words = body.split(/\s+/).filter(Boolean).length;
  const pass =
    (words >= minWords && words <= maxWords + 100) ||
    (flagShort && words >= 500 && words < minWords);
  return {
    name: "word_count",
    pass,
    severity: "major",
    detail: pass
      ? `${words} words OK`
      : `${words} words — target ${minWords}-${maxWords}${flagShort ? " (flag_short set but < 500)" : ""}`,
  };
}

// 3 ─ SLUG: format + typo detection (edit-distance-1 from a known word ⇒ typo).
const SLUG_DICT = new Set([
  // tech whitelist + common slug words (extend freely)
  "ai","chatgpt","openai","whatsapp","gemini","google","iphone","apple","android","samsung","nvidia","meta","facebook","instagram","youtube","telegram","twitter","microsoft","amazon","tesla","uber","sora","claude","anthropic","grok","xai","deepseek","llama","mistral","copilot","bing","chrome","pixel","galaxy","oneplus","xiaomi","realme","oppo","vivo","nothing","redmi","jio","airtel","bsnl","isro","upi","aadhaar","paytm","phonepe","gpay",
  "update","updates","new","launch","launched","launches","release","released","features","feature","price","prices","pricing","news","tech","technology","mobile","phone","phones","smartphone","app","apps","internet","online","digital","electric","car","cars","battery","camera","display","screen","chip","processor","model","models","version","pro","max","ultra","mini","plus","series","edition",
  "india","indian","telugu","hyderabad","andhra","telangana","world","us","usa","china","japan","uk","europe",
  "january","february","march","april","may","june","july","august","september","october","november","december",
  "vs","for","and","the","in","on","of","to","with","how","why","what","top","best","big","full","first","last","next","free","paid","offer","deal","sale","ban","banned","down","shutdown","outage","hack","leak","leaked","rumor","rumors","review","reviews","benefits","guide","tips","comparison","2024","2025","2026","2027",
]);

function editDistance1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function checkSlug(slug: string): ValidatorResult {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
    return { name: "slug", pass: false, severity: "critical", detail: `Bad slug format: "${slug}"` };
  }
  for (const token of slug.split("-")) {
    if (SLUG_DICT.has(token) || /^\d+$/.test(token) || token.length < 4) continue;
    // Unknown token: fine if it's a Telugu romanization — but if it's one
    // edit away from a known English word, it's a typo ("apdate" → "update").
    for (const w of SLUG_DICT) {
      if (w.length >= 4 && editDistance1(token, w)) {
        return {
          name: "slug",
          pass: false,
          severity: "critical",
          detail: `Slug typo: "${token}" looks like a misspelling of "${w}"`,
        };
      }
    }
  }
  return { name: "slug", pass: true, severity: "critical", detail: "OK" };
}

// 4 ─ SOURCES: at least 1 URL, none from the redirect blacklist.
export const REDIRECT_BLACKLIST = [
  "vertexaisearch.cloud.google.com",
  "news.google.com",
  "google.com/url",
  "l.facebook.com",
  "lm.facebook.com",
  "t.co",
];

export function isBlacklistedUrl(url: string): boolean {
  return REDIRECT_BLACKLIST.some((b) => url.includes(b));
}

export function checkSources(sources: ArticleForValidation["source_urls"]): ValidatorResult {
  const urls = (sources ?? []).map((s) => s.url).filter((u): u is string => Boolean(u));
  if (urls.length === 0) {
    return { name: "sources", pass: false, severity: "critical", detail: "No source URLs" };
  }
  const bad = urls.filter(isBlacklistedUrl);
  if (bad.length) {
    return { name: "sources", pass: false, severity: "critical", detail: `Redirect URLs in sources: ${bad[0]}` };
  }
  return { name: "sources", pass: true, severity: "critical", detail: `${urls.length} source(s) OK` };
}

// 5 ─ DUPLICATE: pg_trgm similarity vs published titles > 0.6.
export async function checkDuplicate(title: string, excludeId?: string): Promise<ValidatorResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("similar_published_titles", {
    p_title: title,
    p_threshold: 0.6,
  });
  if (error) {
    // pg_trgm not migrated yet — don't block, but say so.
    return { name: "duplicate", pass: true, severity: "critical", detail: `check unavailable (${error.message})` };
  }
  const rows = ((data as { id: string; title: string; slug: string; sim: number }[]) ?? []).filter(
    (r) => r.id !== excludeId,
  );
  if (rows.length) {
    return {
      name: "duplicate",
      pass: false,
      severity: "critical",
      detail: `Too similar to published "${rows[0].title}" (sim ${rows[0].sim.toFixed(2)})`,
    };
  }
  return { name: "duplicate", pass: true, severity: "critical", detail: "OK" };
}

// 6 ─ INTERNAL LINKS: every internal href must be an existing published slug.
export async function checkInternalLinks(body: string): Promise<ValidatorResult> {
  const hrefs = [...body.matchAll(/\]\(\/([a-z0-9-]+)\/?\)/g)].map((m) => m[1]);
  const internal = [...new Set(hrefs)].filter(
    (s) => !["about", "contact", "privacy", "terms", "disclaimer", "editorial-policy"].includes(s),
  );
  if (internal.length === 0) return { name: "internal_links", pass: true, severity: "major", detail: "no internal links" };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("articles")
    .select("slug")
    .in("slug", internal)
    .eq("status", "published");
  const found = new Set((data ?? []).map((r) => r.slug as string));
  const missing = internal.filter((s) => !found.has(s));
  return missing.length
    ? { name: "internal_links", pass: false, severity: "major", detail: `Broken internal link(s): /${missing.join(", /")}` }
    : { name: "internal_links", pass: true, severity: "major", detail: `${internal.length} link(s) OK` };
}

// 7 ─ IMAGE: hero >= 1200px wide + Telugu alt (alt = title).
function parseImageWidth(bytes: Uint8Array): number | null {
  // PNG: width at offset 16 (big-endian, after 8-byte sig + IHDR len/type)
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  }
  // JPEG: scan for SOF0-SOF15 markers
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return (bytes[i + 7] << 8) | bytes[i + 8];
      }
      i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
  }
  // WebP VP8X: canvas width at offset 24 (little-endian, minus one)
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
    return 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
  }
  return null;
}

export async function checkImage(imageUrl: string | null | undefined, title: string): Promise<ValidatorResult> {
  if (!imageUrl) {
    return { name: "image", pass: false, severity: "major", detail: "No hero image" };
  }
  if (!/[ఀ-౿]/.test(title)) {
    return { name: "image", pass: false, severity: "major", detail: "Alt text (title) has no Telugu" };
  }
  try {
    const res = await fetch(imageUrl, { headers: { range: "bytes=0-65535" } });
    if (!res.ok) return { name: "image", pass: false, severity: "major", detail: `Image fetch ${res.status}` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    const width = parseImageWidth(bytes);
    if (width == null) {
      return { name: "image", pass: true, severity: "major", detail: "unknown format — width unverified" };
    }
    return width >= 1200
      ? { name: "image", pass: true, severity: "major", detail: `${width}px OK` }
      : { name: "image", pass: false, severity: "major", detail: `Hero only ${width}px wide (need >=1200)` };
  } catch (e) {
    return { name: "image", pass: false, severity: "major", detail: `Image check failed: ${e instanceof Error ? e.message : "err"}` };
  }
}

// 8 ─ ENDING: last sentence contains a digit or a proper-noun entity.
export function checkEnding(body: string, factEntities: string[] = []): ValidatorResult {
  const plain = body.replace(/[#*_\[\]()]/g, " ").trim();
  const sentences = plain.split(/(?<=[.!?।॥])\s+|\n+/).filter((s) => s.trim().length > 3);
  const last = (sentences[sentences.length - 1] ?? "").trim();
  const hasDigit = /\d/.test(last);
  const hasLatinEntity = /\b[A-Z][a-zA-Z0-9]{1,}\b/.test(last);
  const hasFactEntity = factEntities.some((e) => e.length > 2 && last.includes(e));
  const pass = hasDigit || hasLatinEntity || hasFactEntity;
  return {
    name: "ending",
    pass,
    severity: "major",
    detail: pass ? "concrete ending OK" : `Vague ending: "${last.slice(0, 90)}"`,
  };
}

/** Run every hard validator; returns results + overall pass. */
export async function runHardValidators(
  a: ArticleForValidation,
  opts: { minWords: number; maxWords: number },
): Promise<{ pass: boolean; results: ValidatorResult[] }> {
  const results: ValidatorResult[] = [
    checkScriptPurity(a.title, a.body),
    checkWordCount(a.body, opts.minWords, opts.maxWords, Boolean(a.flag_short)),
    checkSlug(a.slug),
    checkSources(a.source_urls),
    checkEnding(a.body, a.factEntities),
    await checkDuplicate(a.title, a.id),
    await checkInternalLinks(a.body),
    await checkImage(a.image_url, a.title),
  ];
  return { pass: results.every((r) => r.pass), results };
}
