import { listPublished } from "@/lib/public";
import { SITE } from "@/lib/site";

export const revalidate = 300;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** RSS 2.0 feed — enables Google's "Follow" feature (spec §7). */
export async function GET() {
  const articles = await listPublished(50);

  const items = articles
    .map((a) => {
      const link = `${SITE.url}/${a.slug}`;
      const date = a.published_at ? new Date(a.published_at).toUTCString() : "";
      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      ${a.summary ? `<description>${esc(a.summary)}</description>` : ""}
      ${date ? `<pubDate>${date}</pubDate>` : ""}
      ${a.category ? `<category>${esc(a.category)}</category>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(SITE.title)}</title>
    <link>${SITE.url}</link>
    <description>${esc(SITE.description)}</description>
    <language>te</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
