import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { listPublishedRange, countPublished } from "@/lib/public";
import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { HOME_FIRST_PAGE, OLDER_PER_PAGE, totalPagesFor } from "@/lib/paging";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  return {
    title: `తాజా వార్తలు — పేజీ ${n}`,
    robots: { index: false, follow: true }, // archive pages: crawl, don't index
    alternates: { canonical: `/page/${n}/` },
  };
}

export default async function OlderArticlesPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const page = Number(n);
  if (!Number.isInteger(page) || page < 1) notFound();
  if (page === 1) redirect("/");

  const total = await countPublished();
  const totalPages = totalPagesFor(total);
  if (page > totalPages) notFound();

  const from = HOME_FIRST_PAGE + (page - 2) * OLDER_PER_PAGE;
  const articles = await listPublishedRange(from, from + OLDER_PER_PAGE - 1);
  if (articles.length === 0) notFound();

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center gap-2 border-b-2 border-line pb-2">
        <span className="h-5 w-[5px] rounded-full bg-accent" />
        <h1 className="text-[18px] font-extrabold text-ink">తాజా వార్తలు</h1>
        <span className="text-[13px] font-medium text-ink-mute">· పేజీ {page}/{totalPages}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
        {articles.map((a) => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
      <Pagination current={page} totalPages={totalPages} />
    </div>
  );
}
