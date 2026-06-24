import Link from "next/link";
import type { PublicArticle } from "@/lib/public";
import { formatDate, categoryLabel } from "@/lib/site";
import { Thumb } from "@/components/thumb";

export function CategoryBadge({ slug }: { slug: string | null }) {
  return (
    <span className="inline-block rounded-md bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
      {categoryLabel(slug)}
    </span>
  );
}

export function ArticleCard({ a }: { a: PublicArticle }) {
  return (
    <Link
      href={`/${a.slug}`}
      className="group block overflow-hidden rounded-xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
    >
      <Thumb
        src={a.image_url}
        alt={a.title}
        seed={a.id}
        className="h-[150px] w-full"
        sizes="(max-width: 560px) 100vw, (max-width: 840px) 50vw, 320px"
      />
      <div className="px-4 pb-4 pt-3.5">
        <CategoryBadge slug={a.category} />
        <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-ink">
          {a.title}
        </h3>
        {a.summary && (
          <p className="mt-2 line-clamp-2 text-[13px] text-ink-soft">{a.summary}</p>
        )}
        <p className="mt-2.5 text-xs text-ink-mute">{formatDate(a.published_at)}</p>
      </div>
    </Link>
  );
}
