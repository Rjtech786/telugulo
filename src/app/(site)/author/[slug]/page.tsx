import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorBySlug, listByAuthor } from "@/lib/public";
import { ArticleCard } from "@/components/article-card";
import { SITE } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  return { title: author ? author.name : "Author" };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const articles = await listByAuthor(author.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    description: author.bio || undefined,
    url: `${SITE.url}/author/${author.slug}`,
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{author.name}</h1>
        {author.bio && <p className="text-neutral-500">{author.bio}</p>}
      </header>
      <div className="grid gap-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}
