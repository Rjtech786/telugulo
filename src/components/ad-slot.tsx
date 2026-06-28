import { pickAd, type AdTarget } from "@/lib/ads";

/**
 * Public ad slot. Shows the most relevant active ad for this article (keyword /
 * category targeting). Kept light so it never slows the page (Discover-safe).
 * Renders nothing when no eligible ad exists.
 */
export async function AdSlot({ target }: { target: AdTarget }) {
  const ad = await pickAd(target);
  if (!ad) return null;

  const headline = ad.headline || ad.title || "";
  const cta = ad.cta || "చూడండి";

  return (
    <a
      href={`/api/ads/click?id=${ad.id}`}
      target="_blank"
      rel="nofollow sponsored noopener"
      className="block overflow-hidden rounded-2xl border border-line bg-white transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-stretch gap-3">
        {ad.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.image_url}
            alt={headline}
            className="h-[96px] w-[120px] flex-none object-cover sm:h-[104px] sm:w-[150px]"
          />
        )}
        <div className="min-w-0 flex-1 py-3 pr-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
            Sponsored
          </div>
          <div className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug text-ink">
            {headline}
          </div>
          {ad.description && (
            <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-soft">
              {ad.description}
            </div>
          )}
          <span className="mt-2 inline-block rounded-md bg-accent px-3 py-1 text-[12px] font-bold text-white">
            {cta} →
          </span>
        </div>
      </div>
    </a>
  );
}
