import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import type { StaticPage } from "@/lib/pages";

/** Shared renderer for the DB-driven footer/legal pages (Admin -> Pages). */
export function StaticPageView({ page }: { page: StaticPage | null }) {
  if (!page) notFound();

  const lastUpdated = new Date(page.updated_at).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-[720px] py-10">
      <h1 className="text-[28px] font-extrabold leading-tight text-ink sm:text-[32px]">
        {page.title}
      </h1>
      <p className="mt-2 text-[13px] text-ink-mute">Last updated: {lastUpdated}</p>
      <div className="mt-6">
        <ArticleBody body={page.content} />
      </div>
    </div>
  );
}
