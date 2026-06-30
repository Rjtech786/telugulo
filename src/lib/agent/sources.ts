import "server-only";

/**
 * Lightweight discovery + research sources. Pulls recent items from tech/AI RSS
 * feeds (real, current topics) and extracts trimmed article text for research
 * (only relevant content — saves tokens, per spec §4 step 3).
 */

export type Candidate = { title: string; link: string; source: string };

// Tech/AI focused feeds. Tune freely from the dashboard later.
const FEEDS: { url: string; source: string }[] = [
  { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
  { url: "https://www.theverge.com/rss/index.xml", source: "The Verge" },
  { url: "https://www.engadget.com/rss.xml", source: "Engadget" },
  { url: "https://feeds.arstechnica.com/arstechnica/technology-lab", source: "Ars Technica" },
];

const FETCH_TIMEOUT = 15000;

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "telugulo-bot/1.0 (+https://telugulo.in)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Parse <item>/<entry> titles + links from an RSS/Atom feed. */
function parseFeed(xml: string, source: string, limit: number): Candidate[] {
  const items: Candidate[] = [];
  const blocks = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  for (const block of blocks) {
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    // RSS: <link>url</link>  | Atom: <link href="url" />
    const linkMatch =
      block.match(/<link[^>]*href="([^"]+)"/) ||
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/);
    if (!titleMatch) continue;
    const title = decodeEntities(titleMatch[1]).trim();
    const link = linkMatch ? decodeEntities(linkMatch[1]).trim() : "";
    if (title && link) items.push({ title, link, source });
    if (items.length >= limit) break;
  }
  return items;
}

/** Gather recent candidate topics across all feeds. */
export async function discoverCandidates(perFeed = 6): Promise<Candidate[]> {
  const results = await Promise.all(
    FEEDS.map(async (f) => {
      const xml = await fetchText(f.url);
      return xml ? parseFeed(xml, f.source, perFeed) : [];
    }),
  );
  return results.flat();
}

/** Strip HTML to readable text, trimmed to a token-friendly length. */
export async function fetchArticleText(
  url: string,
  maxChars = 6000,
): Promise<string> {
  const html = await fetchText(url);
  if (!html) return "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  return decodeEntities(text).trim().slice(0, maxChars);
}

// ─── Multi-source research (Google News search → real sources) ───

export type SearchHit = Candidate & { snippet: string };

/** Parse Google News RSS search results (title - publisher, link, snippet). */
function parseGoogleNews(xml: string, limit: number): SearchHit[] {
  const hits: SearchHit[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks) {
    const titleRaw = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "";
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? "";
    const srcRaw = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "";
    const descRaw = block.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ?? "";
    const title0 = decodeEntities(titleRaw).trim();
    const source =
      decodeEntities(srcRaw).trim() ||
      (title0.includes(" - ") ? title0.split(" - ").slice(-1)[0].trim() : "news");
    const title =
      source && title0.endsWith(`- ${source}`)
        ? title0.slice(0, -(source.length + 2)).trim()
        : title0;
    const snippet = decodeEntities(descRaw)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (title && link) hits.push({ title, link: decodeEntities(link).trim(), source, snippet });
    if (hits.length >= limit) break;
  }
  return hits;
}

/** Search real news sources for any topic (free, no API key — Google News RSS). */
export async function searchSources(query: string, limit = 8): Promise<SearchHit[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=en-IN&gl=IN&ceid=IN:en`;
  const xml = await fetchText(url);
  return xml ? parseGoogleNews(xml, limit) : [];
}

export type ResearchResult = { text: string; sources: Candidate[] };

/**
 * Read multiple real sources for a topic and return combined research text +
 * the sources used. Prefers full article text; falls back to the news snippet
 * when a source can't be fetched, so there's always real grounding.
 */
export async function gatherResearch(
  query: string,
  opts: { minSources?: number; depth?: "basic" | "deep"; seed?: Candidate } = {},
): Promise<ResearchResult> {
  const minSources = Math.min(8, Math.max(1, opts.minSources ?? 4));
  const perChars = opts.depth === "basic" ? 2500 : 5000;

  const hits = await searchSources(query, minSources + 5);
  const queue: SearchHit[] = [];
  if (opts.seed) queue.push({ ...opts.seed, snippet: "" });
  for (const h of hits) {
    if (!queue.some((q) => q.link === h.link)) queue.push(h);
  }

  const fetched = await Promise.all(
    queue.slice(0, minSources + 5).map(async (q) => ({
      q,
      text: await fetchArticleText(q.link, perChars),
    })),
  );

  const used: Candidate[] = [];
  const parts: string[] = [];
  for (const { q, text } of fetched) {
    const content = text && text.length > 400 ? text : q.snippet;
    if (content && content.length > 60) {
      used.push({ title: q.title, link: q.link, source: q.source });
      parts.push(`SOURCE — ${q.source}: ${q.title}\n${content}`);
    }
    if (used.length >= minSources) break;
  }

  return { text: parts.join("\n\n---\n\n"), sources: used };
}
