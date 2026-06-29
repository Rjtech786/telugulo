import { listPublished } from "@/lib/public";
import { SITE } from "@/lib/site";
import { sitemapIndexXml, xmlResponse } from "@/lib/sitemap";

export const revalidate = 300;

/** Master sitemap index → post / page / category sub-sitemaps. */
export async function GET() {
  const latest = await listPublished(1);
  const articlesLastmod = latest[0]?.published_at ?? new Date().toISOString();
  const now = new Date().toISOString();

  return xmlResponse(
    sitemapIndexXml([
      { loc: `${SITE.url}/post-sitemap.xml`, lastmod: articlesLastmod },
      { loc: `${SITE.url}/page-sitemap.xml`, lastmod: now },
      { loc: `${SITE.url}/category-sitemap.xml`, lastmod: articlesLastmod },
    ]),
  );
}
