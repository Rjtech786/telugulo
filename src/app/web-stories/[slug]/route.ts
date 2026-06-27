import { getPublishedBySlug } from "@/lib/public";
import { buildStoryHtml } from "@/lib/web-story";

export const revalidate = 600;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const article = await getPublishedBySlug(slug);

  if (!article) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(buildStoryHtml(article), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
