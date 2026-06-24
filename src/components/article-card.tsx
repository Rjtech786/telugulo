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
      className="group block overflow-hidden rounded-xl border border-line bg-white transition duration-200 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] [&_img]:transition-transform [&_img]:duration-500 hover:[&_img]:scale-105"
    >
      <Thumb
        src={a.image_url}
        alt={a.title}
        seed={a.id}
        className="h-[160px] w-full"
        sizes="(max-width: 560px) 100vw, (max-width: 840px) 50vw, 320px"
      />
      <div className="p-4">
        <CategoryBadge slug={a.category} />
        <h3 className="mt-2.5 line-clamp-2 font-serif text-[17px] font-bold leading-snug text-ink transition-colors group-hover:text-accent">
          {a.title}
        </h3>
        {a.summary && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
            {a.summary}
          </p>
        )}
        <p className="mt-3 text-xs font-medium text-ink-mute">
          {formatDate(a.published_at)}
        </p>
      </div>
    </Link>
  );
}
