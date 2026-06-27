import Link from "next/link";
import type { PublicArticle } from "@/lib/public";
import { formatDate, categoryLabel } from "@/lib/site";
import { Thumb } from "@/components/thumb";

export function CategoryBadge({ slug }: { slug: string | null }) {
  return (
    <span className="inline-block rounded bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      {categoryLabel(slug)}
    </span>
  );
}

/** Image-top card (used in the full-width 4-column rows). */
export function ArticleCard({ a }: { a: PublicArticle }) {
  return (
    <Link href={`/${a.slug}`} className="group block">
      <Thumb
        src={a.image_url}
        alt={a.title}
        seed={a.id}
        className="h-[150px] w-full rounded-lg [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-105"
        sizes="(max-width: 560px) 100vw, (max-width: 840px) 50vw, 280px"
      />
      <h3 className="mt-2.5 line-clamp-3 text-[15px] font-bold leading-snug text-ink transition-colors group-hover:text-accent">
        {a.title}
      </h3>
      <p className="mt-1.5 text-[11px] font-medium text-ink-mute">
        {formatDate(a.published_at)}
      </p>
    </Link>
  );
}

/**
 * Compact horizontal item — taazatime's dominant card: square thumbnail (left)
 * + bold headline (right). The signature of the magazine section blocks.
 */
export function ArticleListItem({
  a,
  rank,
}: {
  a: PublicArticle;
  rank?: number;
}) {
  return (
    <Link
      href={`/${a.slug}`}
      className="group flex gap-3 border-b border-line py-3 last:border-0"
    >
      <div className="relative flex-shrink-0">
        <Thumb
          src={a.image_url}
          alt={a.title}
          seed={a.id}
          className="h-[74px] w-[100px] rounded-md [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-105"
          sizes="100px"
        />
        {rank != null && (
          <span className="absolute left-0 top-0 grid h-5 w-5 place-items-center rounded-br-md bg-accent text-[11px] font-bold text-white">
            {rank}
          </span>
        )}
      </div>
      <h4 className="line-clamp-3 text-[14px] font-bold leading-snug text-ink transition-colors group-hover:text-accent">
        {a.title}
      </h4>
    </Link>
  );
}
