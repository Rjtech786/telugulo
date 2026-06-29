import { listPublished } from "@/lib/public";
import { SITE } from "@/lib/site";
import { urlsetXml, xmlResponse } from "@/lib/sitemap";

export const revalidate = 300;

/** All published articles. */
export async function GET() {
  const articles = await listPublished(1000);
  return xmlResponse(
    urlsetXml(
      articles.map((a) => ({
        loc: `${SITE.url}/${a.slug}/`,
        lastmod: a.published_at ?? a.created_at,
        image: a.image_url ?? undefined,
      })),
    ),
  );
}
