import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listByCategory } from "@/lib/public";
import { ArticleCard } from "@/components/article-card";
import { CATEGORIES } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = CATEGORIES.find((c) => c.slug === category);
  return { title: cat ? `${cat.label} News` : "Category" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat) notFound();

  const articles = await listByCategory(category);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">{cat.label}</h1>
      {articles.length === 0 ? (
        <p className="text-neutral-500">ఈ category lo ఇంకా articles లేవు.</p>
      ) : (
        <div className="grid gap-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
