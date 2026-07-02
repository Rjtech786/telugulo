import { SITE } from "@/lib/site";
import { urlsetXml, xmlResponse } from "@/lib/sitemap";
import { listPages } from "@/lib/pages";

export const revalidate = 3600;

/** Static pages (home + the DB-driven about/contact/privacy/etc. pages). */
export async function GET() {
  const now = new Date().toISOString();
  const pages = await listPages();
  return xmlResponse(
    urlsetXml([
      { loc: `${SITE.url}/`, lastmod: now },
      ...pages.map((p) => ({ loc: `${SITE.url}/${p.slug}/`, lastmod: p.updated_at })),
    ]),
  );
}
