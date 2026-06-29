import { listPublished } from "@/lib/public";
import { SITE } from "@/lib/site";
import { SITEMAP_PI, escXml as esc } from "@/lib/sitemap";

export const revalidate = 300;

/**
 * Google News sitemap — only articles published in the last 48 hours
 * (Google News requirement). Submit in Search Console / Publisher Center.
 */
export async function GET() {
  const all = await listPublished(100);
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = all.filter(
    (a) => a.published_at && new Date(a.published_at).getTime() >= cutoff,
  );

  const items = recent
    .map((a) => {
      const loc = `${SITE.url}/${a.slug}/`;
      return `  <url>
    <loc>${loc}</loc>
    <news:news>
      <news:publication>
        <news:name>${esc(SITE.name)}</news:name>
        <news:language>te</news:language>
      </news:publication>
      <news:publication_date>${a.published_at}</news:publication_date>
      <news:title>${esc(a.title)}</news:title>
    </news:news>
  </url>`;
    })
    .join("\n");

  const xml = `${SITEMAP_PI}
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
