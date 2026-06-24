import Link from "next/link";
import { listPublished, type PublicArticle } from "@/lib/public";
import { ArticleCard, CategoryBadge } from "@/components/article-card";
import { Thumb } from "@/components/thumb";
import { formatDate, categoryLabel } from "@/lib/site";

export const revalidate = 300;

export default async function HomePage() {
  const articles = await listPublished(30);

  if (articles.length === 0) {
    return (
      <div className="py-4">
        <HeroStrip />
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
  const side = rest.slice(0, 3);
  const grid = rest.slice(3);

  return (
    <div className="py-1">
      <HeroStrip />

      {/* Featured */}
      <div
        className={`mb-9 grid gap-6 ${side.length ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}
      >
        <Link
          href={`/${featured.slug}`}
          className="group overflow-hidden rounded-xl border border-line bg-white"
        >
          <Thumb
            src={featured.image_url}
            alt={featured.title}
            seed={featured.id}
            className="h-[280px] w-full"
            sizes="(max-width: 840px) 100vw, 600px"
            priority
          />
          <div className="px-5 pb-5 pt-4">
            <CategoryBadge slug={featured.category} />
            <h2 className="mt-2.5 text-[23px] font-bold leading-snug tracking-tight text-ink">
              {featured.title}
            </h2>
            {featured.summary && (
              <p className="mt-2 text-sm text-ink-soft">{featured.summary}</p>
            )}
            <div className="mt-3 text-xs text-ink-mute">
              ✍️ telugulo team · {formatDate(featured.published_at)}
            </div>
          </div>
        </Link>

        {side.length > 0 && (
          <div className="flex flex-col gap-4">
            {side.map((a) => (
              <SideItem key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>

      {/* Latest grid */}
      <h2 className="mb-5 inline-block border-b-2 border-ink pb-2 text-base font-bold text-ink">
        తాజా వార్తలు
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(grid.length ? grid : rest).map((a) => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}

function HeroStrip() {
  const today = formatDate(new Date().toISOString());
  return (
    <div className="mb-6 border-b border-line pb-4 pt-5">
      <h1 className="text-[15px] font-medium text-ink-soft">
        📅 {today} · తాజా టెక్నాలజీ వార్తలు
      </h1>
    </div>
  );
}

function SideItem({ a }: { a: PublicArticle }) {
  return (
    <Link
      href={`/${a.slug}`}
      className="flex gap-3 border-b border-line pb-4 last:border-0 last:pb-0"
    >
      <Thumb
        src={a.image_url}
        alt={a.title}
        seed={a.id}
        className="h-16 w-[84px] flex-shrink-0 rounded-lg"
        sizes="84px"
      />
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
          {a.title}
        </h3>
        <div className="mt-1 text-[11px] text-ink-mute">
          {categoryLabel(a.category)} · {formatDate(a.published_at)}
        </div>
      </div>
    </Link>
  );
}
