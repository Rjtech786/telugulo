import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublishedBySlug, getAuthor } from "@/lib/public";
import { ArticleBody } from "@/components/article-body";
import { ViewPing } from "@/components/view-ping";
import { SITE, formatDate } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedBySlug(slug);
  if (!a) return { title: "Not found" };

  const description = a.meta_description || a.summary || SITE.description;
  const url = `${SITE.url}/${a.slug}`;
  return {
    title: a.title_meta || a.title,
    description,
    alternates: { canonical: `/${a.slug}` },
    openGraph: {
      type: "article",
      title: a.title,
      description,
      url,
      publishedTime: a.published_at ?? undefined,
      images: a.image_url ? [{ url: a.image_url, width: 1200, height: 675 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: a.title,
      description,
      images: a.image_url ? [a.image_url] : [],
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await getPublishedBySlug(slug);
  if (!a) notFound();

  const author = a.author_id ? await getAuthor(a.author_id) : null;
  const url = `${SITE.url}/${a.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.title,
    description: a.meta_description || a.summary || undefined,
    image: a.image_url ? [a.image_url] : undefined,
    datePublished: a.published_at || a.created_at,
    dateModified: a.published_at || a.created_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: author
      ? { "@type": "Person", name: author.name, url: author.slug ? `${SITE.url}/author/${author.slug}` : undefined }
      : { "@type": "Organization", name: SITE.name },
    publisher: {
      "@type": "Organization",
      name: SITE.organization.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}${SITE.organization.logo}` },
    },
    inLanguage: "te",
  };

  return (
    <article className="mx-auto max-w-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ViewPing id={a.id} />

      {a.category && (
        <Link
          href={`/category/${a.category}`}
          className="text-xs font-medium uppercase tracking-wide text-neutral-400 hover:text-neutral-600"
        >
          {a.category}
        </Link>
      )}
      <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight">
        {a.title}
      </h1>

      <div className="mt-3 flex items-center gap-2 text-sm text-neutral-500">
        {author && (
          <>
            <span>
              {author.slug ? (
                <Link href={`/author/${author.slug}`} className="font-medium hover:underline">
                  {author.name}
                </Link>
              ) : (
                <span className="font-medium">{author.name}</span>
              )}
            </span>
            <span>·</span>
          </>
        )}
        <time dateTime={a.published_at ?? undefined}>{formatDate(a.published_at)}</time>
      </div>

      {a.image_url && (
        <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl">
          <Image
            src={a.image_url}
            alt={a.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 42rem"
            className="object-cover"
          />
        </div>
      )}

      <div className="mt-6">
        <ArticleBody body={a.body || ""} />
      </div>

      {author?.bio && (
        <div className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="font-semibold">{author.name}</div>
          <p className="mt-1 text-neutral-500">{author.bio}</p>
        </div>
      )}

      <div className="mt-8 text-xs text-neutral-400">
        AI-assisted, human-reviewed. ·{" "}
        <Link href="/editorial-policy" className="underline">
          Editorial policy
        </Link>
      </div>
    </article>
  );
}
