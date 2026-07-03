"use client";

import { useEffect, useState } from "react";
import { AdImageCarousel } from "@/components/ad-image-carousel";
import { AdViewPing } from "@/components/ad-view-ping";
import type { Ad } from "@/lib/ads";

const SESSION_KEY = "telugulo_popup_ad_shown";

/**
 * Owner-configurable delayed popup — shows once per browser session (per the
 * spec: "session me ek baar, delay owner set kare"). Renders nothing until
 * the timer fires and nothing at all if it already showed this session.
 */
export function PopupAd({ ad, delaySeconds }: { ad: Ad | null; delaySeconds: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ad) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const t = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(SESSION_KEY, "1");
    }, Math.max(0, delaySeconds) * 1000);
    return () => clearTimeout(t);
  }, [ad, delaySeconds]);

  if (!ad || !visible) return null;

  const images = ad.images?.length ? ad.images : ad.image_url ? [ad.image_url] : [];
  const headline = ad.headline || ad.title || "";
  const cta = ad.cta || "చూడండి";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => setVisible(false)}
    >
      <AdViewPing id={ad.id} placement="popup" />
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setVisible(false)}
          aria-label="మూసివేయండి"
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
        >
          ✕
        </button>
        <a
          href={`/api/ads/click?id=${ad.id}&placement=popup`}
          target="_blank"
          rel="nofollow sponsored noopener"
          className="block"
        >
          {images.length > 0 && <AdImageCarousel images={images} alt={headline} className="h-[220px] w-full" />}
          <div className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-mute">
              Sponsored
            </div>
            <div className="mt-1 text-[18px] font-extrabold leading-snug text-ink">{headline}</div>
            {ad.description && (
              <div className="mt-1 text-[13px] leading-snug text-ink-soft">{ad.description}</div>
            )}
            <span className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-[13px] font-bold text-white">
              {cta} →
            </span>
          </div>
        </a>
      </div>
    </div>
  );
}
