import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle } from "@/lib/articles";
import { EditForm } from "./EditForm";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/articles" className="text-sm text-neutral-500 hover:underline">
        ← Back to articles
      </Link>
      <EditForm
        id={article.id}
        status={article.status}
        slug={article.slug}
        imageUrl={article.image_url}
        initial={{
          title: article.title ?? "",
          title_meta: article.title_meta ?? "",
          meta_description: article.meta_description ?? "",
          summary: article.summary ?? "",
          body: article.body ?? "",
          category: article.category ?? "",
        }}
      />
    </div>
  );
}
