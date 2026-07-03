import Link from "next/link";
import { listPublished, listTrending, countPublished, type PublicArticle } from "@/lib/public";
import { ArticleCard, ArticleListItem } from "@/components/article-card";
import { AdSlot } from "@/components/ad-slot";
import { Pagination } from "@/components/pagination";
import { Thumb } from "@/components/thumb";
import { formatDate, SITE } from "@/lib/site";
import { HOME_FIRST_PAGE, OLDER_PER_PAGE } from "@/lib/paging";

export const revalidate = 300;

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: `${SITE.url}/`,
      description: SITE.description,
      inLanguage: "te",
      publisher: { "@id": `${SITE.url}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.organization.name,
      url: `${SITE.url}/`,
      logo: { "@type": "ImageObject", url: `${SITE.url}${SITE.organization.logo}` },
    },
  ],
};

export default async function HomePage() {
  const [articles, trending, total] = await Promise.all([
    listPublished(60),
    listTrending(5),
    countPublished(),
  ]);

  if (articles.length === 0) {
    return (
      <div className="py-10">
        <div className="rounded-xl border border-dashed border-line px-4 py-16 text-center text-ink-soft">
          <p>ఇంకా articles publish కాలేదు.</p>
          <Link href="/admin" className="mt-2 inline-block text-sm text-accent underline">
            Admin → మొదటి article generate &amp; publish చేయండి
          </Link>
        </div>
      </div>
    );
  }

  const [featured, ...rest] = articles;
  const topList = rest.slice(0, 3);
  const used = new Set([featured.id, ...topList.map((a) => a.id)]);

  const latest = articles.filter((a) => !used.has(a.id)).slice(0, HOME_FIRST_PAGE - 4);
  latest.forEach((a) => used.add(a.id));

  const stories = articles.slice(0, 5);
  const totalPages = Math.max(1, 1 + Math.ceil(Math.max(0, total - HOME_FIRST_PAGE) / OLDER_PER_PAGE));

  return (
    <div className="py-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />

      {/* ── Featured: 3-column top ── */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr_1.05fr]">
        {/* Big featured */}
        <Link href={`/${featured.slug}`} className="group block">
          <Thumb
            src={featured.image_url}
            alt={featured.title}
            seed={featured.id}
            className="h-[230px] w-full rounded-lg sm:h-[300px] [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-105"
            sizes="(max-width: 840px) 100vw, 460px"
            priority
          />
          <h2 className="mt-3 text-[21px] font-extrabold leading-tight text-ink transition-colors group-hover:text-accent sm:text-[24px]">
            {featured.title}
          </h2>
          {featured.summary && (
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink-soft">
              {featured.summary}
            </p>
          )}
          <p className="mt-2 text-[11px] font-medium text-ink-mute">
            {formatDate(featured.published_at)}
          </p>
        </Link>

        {/* Middle list */}
        <div className="flex flex-col">
          {topList.map((a) => (
            <ArticleListItem key={a.id} a={a} />
          ))}
        </div>

        {/* Trending section */}
        <section>
          <SectionHeader title="ట్రెండింగ్" />
          <div>
            {trending.map((a, i) => (
              <ArticleListItem key={a.id} a={a} rank={i + 1} />
            ))}
          </div>
        </section>
      </div>

      {/* ── Latest: full-width 4-column row + pagination to older pages ── */}
      <section className="mt-10">
        <SectionHeader title="తాజా వార్తలు" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {latest.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
        <Pagination current={1} totalPages={totalPages} />
      </section>

      {/* ── Sponsored banner ── */}
      <div className="mt-10">
        <AdSlot target={{}} variant="banner" type="banner" />
      </div>

      {/* ── Web Stories ── */}
      <WebStories items={stories} />
    </div>
  );
}

/* ─── Section header: red icon + bold title + red "›" + circle link ─── */
function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3.5 flex items-center gap-2 border-b-2 border-line pb-2">
      <span className="h-5 w-[5px] rounded-full bg-accent" />
      <h2 className="text-[18px] font-extrabold text-ink">{title}</h2>
      <span className="text-[18px] font-bold leading-none text-accent">›</span>
      {href && (
        <Link
          href={href}
          aria-label={`${title} మరిన్ని`}
          className="ml-auto grid h-6 w-6 place-items-center rounded-full border-2 border-accent text-[13px] font-bold text-accent transition hover:bg-accent hover:text-white"
        >
          ›
        </Link>
      )}
    </div>
  );
}

/* ─── Web Stories (dark maroon block, portrait cards) ─── */
function WebStories({ items }: { items: PublicArticle[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12 rounded-xl bg-story p-5 text-white sm:p-7">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[20px] font-extrabold">Web Stories</h2>
        <a
          href={`/web-stories/${items[0].slug}/`}
          target="_blank"
          rel="noopener"
          className="text-[13px] font-semibold text-white/80 hover:text-white"
        >
          Watch More ▸
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {items.map((a) => (
          <a
            key={a.id}
            href={`/web-stories/${a.slug}/`}
            target="_blank"
            rel="noopener"
            className="group relative block aspect-[3/4] overflow-hidden rounded-lg"
          >
            <Thumb
              src={a.image_url}
              alt={a.title}
              seed={a.id}
              className="h-full w-full [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-105"
              sizes="(max-width: 640px) 50vw, 220px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            {/* play badge → signals these are real stories */}
            <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/25 backdrop-blur">
              <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
            </span>
            <h3 className="absolute inset-x-0 bottom-0 line-clamp-3 p-2.5 text-[12px] font-bold leading-snug text-white">
              {a.title}
            </h3>
          </a>
        ))}
      </div>
    </section>
  );
}
