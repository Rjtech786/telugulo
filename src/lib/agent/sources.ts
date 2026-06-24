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
