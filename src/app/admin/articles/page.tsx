import { listArticles } from "@/lib/articles";
import { ArticlesClient } from "./ArticlesClient";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  let articles: Awaited<ReturnType<typeof listArticles>> = [];
  let error: string | null = null;
  try {
    articles = await listArticles();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  return <ArticlesClient articles={articles} />;
}
