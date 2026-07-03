import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedBySlug, getAuthor, listPublished, listRelated } from "@/lib/public";
import { pickAds } from "@/lib/ads";
import { getArticleLayoutSettings } from "@/lib/settings";
import { stripInlineSourcesSection, extractHeadings } from "@/lib/article-toc";
import { ArticleBody } from "@/components/article-body";
import { TableOfContents } from "@/components/table-of-contents";
import { ReadingProgress } from "@/components/reading-progress";
import { ShareBar } from "@/components/share-bar";
import { ViewPing } from "@/components/view-ping";
import { AdCard } from "@/components/ad-slot";
import { Thumb } from "@/components/thumb";
import { CategoryBadge, ArticleCard } from "@/components/article-card";
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

  const [author, related, ads, layout] = await Promise.all([
    a.author_id ? getAuthor(a.author_id) : Promise.resolve(null),
    listRelated(a.category, a.id, 6),
    pickAds({ category: a.category, title: a.title, summary: a.summary, body: a.body }, 2),
    getArticleLayoutSettings(),
  ]);
  const cleanBody = stripInlineSourcesSection(a.body || "");
  const headings = extractHeadings(cleanBody);
  const [bodyTop, bodyRest] = splitBodyForAd(cleanBody);
  const sourceLinks = (a.source_urls ?? []).filter(
    (s): s is { title?: string; url: string; source?: string } => Boolean(s.url),
  );
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
      <ReadingProgress />

      <div className="mt-6">
        {a.category ? (
          <Link href={`/category/${a.category}/`}>
            <CategoryBadge slug={a.category} />
          </Link>
        ) : (
          <CategoryBadge slug={a.category} />
        )}
      </div>

      <h1 className="mt-4 text-[25px] font-extrabold leading-[1.35] text-ink sm:text-[32px] sm:leading-[1.3]">
        {a.title}
      </h1>

      <div className="mt-4 flex items-center gap-3 border-b border-line pb-5 text-[13px] text-ink-soft">
        {author?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar}
            alt={author.name}
            className="h-9 w-9 flex-none rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
            తె
          </span>
        )}
        <span>
          <span className="block font-medium text-ink">
            {author?.slug ? (
              <Link href={`/author/${author.slug}/`} className="hover:text-accent">
                {author.name}
              </Link>
            ) : (
              author?.name ?? "telugulo team"
            )}
          </span>
          <time dateTime={a.published_at ?? undefined}>
            {formatDateTime(a.published_at)}
          </time>
          {a.updated_at &&
            a.published_at &&
            new Date(a.updated_at).getTime() - new Date(a.published_at).getTime() > 120000 && (
              <span className="block text-ink-mute">
                నవీకరించబడింది {formatDate(a.updated_at)}
              </span>
            )}
        </span>
      </div>

      <div className="mt-4">
        <ShareBar url={url} title={a.title} />
      </div>

      <Thumb
        src={a.image_url}
        alt={a.title}
        seed={a.id}
        className="mt-7 h-[320px] w-full rounded-xl"
        sizes="(max-width: 760px) 100vw, 720px"
        priority
      />

      {layout.show_toc && <TableOfContents headings={headings} />}

      <div className="mt-7">
        <ArticleBody body={bodyTop} />
        {ads[0] && bodyRest && (
          <div className="my-7">
            <AdCard ad={ads[0]} />
          </div>
        )}
        {bodyRest && <ArticleBody body={bodyRest} lead={false} />}
      </div>

      <div className="mt-8 rounded-xl border border-line bg-surface px-4 py-3">
        <ShareBar url={url} title={a.title} />
      </div>

      {(ads[1] ?? ads[0]) && (
        <div className="mt-6">
          <AdCard ad={ads[1] ?? ads[0]} variant="banner" />
        </div>
      )}

      {layout.show_sources && sourceLinks.length > 0 && (
        <div className="mt-8 rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="mb-2 font-semibold text-ink">మూలాలు (Sources)</div>
          <ul className="space-y-1.5">
            {sourceLinks.map((s, i) => (
              <li key={i} className="truncate">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-accent hover:underline"
                >
                  {s.title || s.source || s.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {author?.bio && (
        <div className="mt-8 rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="font-semibold text-ink">{author.name}</div>
          <p className="mt-1 text-ink-soft">{author.bio}</p>
        </div>
      )}

      {layout.show_related && related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2 border-b-2 border-line pb-2 text-[18px] font-extrabold text-ink">
            <span className="h-5 w-[5px] rounded-full bg-accent" />
            సంబంధిత వార్తలు
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <ArticleCard key={r.id} a={r} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

/**
 * Split the markdown body near the middle at a safe paragraph boundary (never
 * right before a list item / blockquote continuation) for the in-article ad.
 * Short articles aren't split at all.
 */
function splitBodyForAd(body: string): [string, string] {
  const paras = body.split(/\n{2,}/);
  if (paras.length < 6) return [body, ""];
  let idx = Math.ceil(paras.length / 2);
  while (idx < paras.length - 1 && /^\s*([#>*-]|\d+\.)/.test(paras[idx])) idx++;
  if (idx >= paras.length - 1) return [body, ""];
  return [paras.slice(0, idx).join("\n\n"), paras.slice(idx).join("\n\n")];
}
