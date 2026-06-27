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

/** Web Stories sitemap — every article's AMP story (with its image). */
export async function GET() {
  const articles = await listPublished(1000);

  const items = articles
    .map((a) => {
      const loc = `${SITE.url}/web-stories/${a.slug}/`;
      const img = a.image_url || `${SITE.url}/opengraph-image`;
      return `  <url>
    <loc>${esc(loc)}</loc>
    ${a.published_at ? `<lastmod>${a.published_at}</lastmod>` : ""}
    <image:image><image:loc>${esc(img)}</image:loc></image:image>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${items}
</urlset>`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
