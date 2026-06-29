import { SITE, FOOTER_PAGES } from "@/lib/site";
import { urlsetXml, xmlResponse } from "@/lib/sitemap";

export const revalidate = 3600;

/** Static pages (home + about/contact/privacy/etc.). */
export async function GET() {
  const now = new Date().toISOString();
  return xmlResponse(
    urlsetXml([
      { loc: `${SITE.url}/`, lastmod: now },
      ...FOOTER_PAGES.map((p) => ({ loc: `${SITE.url}${p.href}/`, lastmod: now })),
    ]),
  );
}
