import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listByCategory } from "@/lib/public";
import { ArticleCard } from "@/components/article-card";
import { CATEGORIES } from "@/lib/site";

export const revalidate = 300;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

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
    <div className="py-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-7 w-1.5 rounded-full bg-accent" />
        <h1 className="text-[26px] font-extrabold tracking-tight text-ink">
          {cat.label}
        </h1>
      </div>
      {articles.length === 0 ? (
        <p className="text-ink-soft">ఈ category lo ఇంకా articles లేవు.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {articles.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
