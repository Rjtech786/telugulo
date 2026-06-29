/** Shared sitemap XML builders. Each sitemap references /sitemap.xsl so the
 *  browser renders the styled table (Rank-Math-style); Google reads the raw XML. */

export const SITEMAP_PI =
  '<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';

export function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type UrlEntry = { loc: string; lastmod?: string | null; image?: string | null };

export function urlsetXml(entries: UrlEntry[]): string {
  const body = entries
    .map((e) => {
      const lm = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : "";
      const img = e.image
        ? `\n    <image:image><image:loc>${escXml(e.image)}</image:loc></image:image>`
        : "";
      return `  <url>\n    <loc>${escXml(e.loc)}</loc>${lm}${img}\n  </url>`;
    })
    .join("\n");
  return `${SITEMAP_PI}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>`;
}

export type IndexEntry = { loc: string; lastmod?: string | null };

export function sitemapIndexXml(entries: IndexEntry[]): string {
  const body = entries
    .map((e) => {
      const lm = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : "";
      return `  <sitemap>\n    <loc>${escXml(e.loc)}</loc>${lm}\n  </sitemap>`;
    })
    .join("\n");
  return `${SITEMAP_PI}\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
