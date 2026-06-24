import { pickAd } from "@/lib/ads";

/**
 * Public ad slot. Shows one active ad (category-matched when possible). Kept
 * light so it never slows the page (Discover-safe, spec §8.7). Renders nothing
 * when no active ads exist.
 */
export async function AdSlot({ category }: { category?: string | null }) {
  const ad = await pickAd(category);
  if (!ad) return null;

  return (
    <a
      href={`/api/ads/click?id=${ad.id}`}
      target="_blank"
      rel="nofollow sponsored noopener"
      className="block overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex items-center gap-3 p-3">
        {ad.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.image_url}
            alt={ad.title ?? ""}
            className="h-14 w-14 flex-none rounded-lg object-cover"
          />
        )}
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-neutral-400">
            Sponsored
          </div>
          <div className="truncate font-medium">{ad.title}</div>
        </div>
      </div>
    </a>
  );
}
