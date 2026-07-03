import { pickAds, type Ad, type AdTarget } from "@/lib/ads";
import { AdImageCarousel } from "@/components/ad-image-carousel";
import { AdViewPing } from "@/components/ad-view-ping";

/**
 * House-ad rendering. `AdCard` is the pure renderer (card = compact
 * horizontal, banner = full-width); both auto-rotate through `ad.images`
 * like a Google Display-style carousel when there's more than one. `AdSlot`
 * picks + renders ads of one type for a page. `placement` is a free-form tag
 * (e.g. "early"/"middle"/"late"/"end"/"homepage") recorded with the view/
 * click so the newsroom can see which spots actually perform.
 */

function adImages(ad: Ad): string[] {
  return ad.images?.length ? ad.images : ad.image_url ? [ad.image_url] : [];
}

export function AdCard({
  ad,
  variant = "card",
  placement,
}: {
  ad: Ad;
  variant?: "card" | "banner";
  placement?: string;
}) {
  const headline = ad.headline || ad.title || "";
  const cta = ad.cta || "చూడండి";
  const images = adImages(ad);
  const clickHref = `/api/ads/click?id=${ad.id}${placement ? `&placement=${encodeURIComponent(placement)}` : ""}`;

  if (variant === "banner") {
    return (
      <>
        <AdViewPing id={ad.id} placement={placement} />
        <a
          href={clickHref}
          target="_blank"
          rel="nofollow sponsored noopener"
          className="group block overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-white to-surface transition hover:shadow-[0_10px_30px_rgba(0,0,0,0.09)]"
        >
          <div className="flex items-stretch gap-4">
            {images.length > 0 && (
              <AdImageCarousel
                images={images}
                alt={headline}
                className="h-[110px] w-[150px] flex-none sm:h-[130px] sm:w-[220px]"
                imgClassName="transition-transform duration-300 group-hover:scale-105"
              />
            )}
            <div className="min-w-0 flex-1 self-center py-3 pr-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-mute">
                Sponsored
              </div>
              <div className="mt-1 line-clamp-2 text-[17px] font-extrabold leading-snug text-ink sm:text-[19px]">
                {headline}
              </div>
              {ad.description && (
                <div className="mt-1 line-clamp-2 hidden text-[13px] leading-snug text-ink-soft sm:block">
                  {ad.description}
                </div>
              )}
              <span className="mt-2.5 inline-block rounded-lg bg-accent px-4 py-1.5 text-[13px] font-bold text-white transition group-hover:bg-accent-dark">
                {cta} →
              </span>
            </div>
          </div>
        </a>
      </>
    );
  }

  return (
    <>
      <AdViewPing id={ad.id} placement={placement} />
      <a
        href={clickHref}
        target="_blank"
        rel="nofollow sponsored noopener"
        className="block overflow-hidden rounded-2xl border border-line bg-white transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
      >
        <div className="flex items-stretch gap-3">
          {images.length > 0 && (
            <AdImageCarousel
              images={images}
              alt={headline}
              className="h-[96px] w-[120px] flex-none sm:h-[104px] sm:w-[150px]"
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
    </>
  );
}

/** Picks + renders one ad of `type`; renders nothing when none are active. */
export async function AdSlot({
  target,
  variant = "card",
  type = "card",
  placement,
}: {
  target: AdTarget;
  variant?: "card" | "banner";
  type?: "card" | "banner";
  placement?: string;
}) {
  const [ad] = await pickAds(target, 1, type);
  if (!ad) return null;
  return <AdCard ad={ad} variant={variant} placement={placement ?? type} />;
}
