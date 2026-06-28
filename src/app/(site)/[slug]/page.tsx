import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedBySlug, getAuthor, listPublished } from "@/lib/public";
import { ArticleBody } from "@/components/article-body";
import { ViewPing } from "@/components/view-ping";
import { AdSlot } from "@/components/ad-slot";
import { Thumb } from "@/components/thumb";
import { CategoryBadge } from "@/components/article-card";
import { SITE, formatDate, formatDateTime } from "@/lib/site";

export const revalidate = 300;

// Pre-render all published articles at build (static + ISR). New articles
// published later are rendered on first request and then cached.
export async function generateStaticParams() {
  const articles = await listPublished(1000);
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedBySlug(slug);
  if (!a) return { title: "Not found" };

  const description = a.meta_description || a.summary || SITE.description;
  const url = `${SITE.url}/${a.slug}/`;
  return {
    title: a.title_meta || a.title,
    description,
    alternates: { canonical: `/${a.slug}/` },
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
  const url = `${SITE.url}/${a.slug}/`;

  const breadcrumb = [
    { name: "Home", item: `${SITE.url}/` },
    ...(a.category
      ? [{ name: a.category, item: `${SITE.url}/category/${a.category}/` }]
      : []),
    { name: a.title, item: url },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: a.title,
        description: a.meta_description || a.summary || undefined,
        image: a.image_url ? [a.image_url] : undefined,
        datePublished: a.published_at || a.created_at,
        dateModified: a.published_at || a.created_at,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        author: author
          ? { "@type": "Person", name: author.name, url: author.slug ? `${SITE.url}/author/${author.slug}/` : undefined }
          : { "@type": "Organization", name: SITE.name },
        publisher: {
          "@type": "Organization",
          name: SITE.organization.name,
          logo: { "@type": "ImageObject", url: `${SITE.url}${SITE.organization.logo}` },
        },
        inLanguage: "te",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumb.map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: b.name,
          item: b.item,
        })),
      },
    ],
  };

  return (
    <article className="mx-auto max-w-[720px]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ViewPing id={a.id} />

      <Link
        href="/"
        className="mt-6 mb-5 inline-flex items-center gap-1.5 text-[13px] text-accent"
      >
        ← వెనక్కి
      </Link>

      <div>
        {a.category ? (
          <Link href={`/category/${a.category}`}>
            <CategoryBadge slug={a.category} />
          </Link>
        ) : (
          <CategoryBadge slug={a.category} />
        )}
      </div>

      <h1 className="mt-4 text-[34px] font-extrabold leading-[1.2] text-ink sm:text-[40px]">
        {a.title}
      </h1>

      <div className="mt-4 flex items-center gap-3 border-b border-line pb-5 text-[13px] text-ink-soft">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
          తె
        </span>
        <span>
          <span className="block font-medium text-ink">
            {author?.slug ? (
              <Link href={`/author/${author.slug}`} className="hover:text-accent">
                {author.name}
              </Link>
            ) : (
              author?.name ?? "telugulo team"
            )}
          </span>
          <time dateTime={a.published_at ?? undefined}>
            {formatDateTime(a.published_at)}
          </time>
          <span className="block text-ink-mute">
            {readMins(a.body)} నిమి చదవండి
            {a.updated_at &&
              a.published_at &&
              new Date(a.updated_at).getTime() - new Date(a.published_at).getTime() >
                120000 && <> · నవీకరించబడింది {formatDate(a.updated_at)}</>}
          </span>
        </span>
      </div>

      <Thumb
        src={a.image_url}
        alt={a.title}
        seed={a.id}
        className="mt-7 h-[320px] w-full rounded-xl"
        sizes="(max-width: 760px) 100vw, 720px"
        priority
      />

      <div className="mt-7">
        <ArticleBody body={a.body || ""} />
      </div>

      <div className="my-7 border-l-[3px] border-line py-2 pl-4 text-[13px] italic text-ink-mute">
        ℹ️ ఈ article AI సహాయంతో తయారు చేసి, మానవ సమీక్ష తర్వాత ప్రచురించబడింది. ·{" "}
        <Link href="/editorial-policy" className="underline">
          Editorial policy
        </Link>
      </div>

      <AdSlot
        target={{
          category: a.category,
          title: a.title,
          summary: a.summary,
          body: a.body,
        }}
      />

      {author?.bio && (
        <div className="mt-8 rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="font-semibold text-ink">{author.name}</div>
          <p className="mt-1 text-ink-soft">{author.bio}</p>
        </div>
      )}
    </article>
  );
}

/** Rough read-time: ~180 Telugu words/min. */
function readMins(body: string | null): number {
  if (!body) return 1;
  return Math.max(1, Math.round(body.split(/\s+/).length / 180));
}
