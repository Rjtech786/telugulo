import Link from "next/link";
import Image from "next/image";
import type { PublicArticle } from "@/lib/public";
import { formatDate } from "@/lib/site";

export function ArticleCard({ a }: { a: PublicArticle }) {
  return (
    <Link
      href={`/${a.slug}`}
      className="group flex gap-4 rounded-2xl border border-neutral-200 bg-white p-3 transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
    >
      {a.image_url && (
        <div className="relative aspect-[16/10] w-32 flex-none overflow-hidden rounded-xl sm:w-44">
          <Image
            src={a.image_url}
            alt={a.title}
            fill
            sizes="(max-width: 640px) 8rem, 11rem"
            className="object-cover transition group-hover:scale-105"
          />
        </div>
      )}
      <div className="min-w-0 flex-1 py-1">
        {a.category && (
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {a.category}
          </span>
        )}
        <h2 className="mt-0.5 line-clamp-2 font-semibold leading-snug">
          {a.title}
        </h2>
        {a.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{a.summary}</p>
        )}
        <p className="mt-2 text-xs text-neutral-400">
          {formatDate(a.published_at)}
        </p>
      </div>
    </Link>
  );
}
