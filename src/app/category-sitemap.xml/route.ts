import { SITE, CATEGORIES } from "@/lib/site";
import { urlsetXml, xmlResponse } from "@/lib/sitemap";

export const revalidate = 3600;

/** Category archive pages. */
export async function GET() {
  const now = new Date().toISOString();
  return xmlResponse(
    urlsetXml(
      CATEGORIES.map((c) => ({ loc: `${SITE.url}/category/${c.slug}/`, lastmod: now })),
    ),
  );
}
