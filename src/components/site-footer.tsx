import Link from "next/link";
import { SITE, FOOTER_PAGES } from "@/lib/site";
import { SocialLinks } from "@/components/social-links";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-line bg-lav">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 lg:grid-cols-[1.6fr_1fr]">
        {/* Brand + description + policy links */}
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-accent text-lg font-bold text-white">
              తె
            </span>
            <span className="text-[19px] font-extrabold text-ink">{SITE.name}</span>
          </Link>
          <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
            {SITE.name}: మీ నమ్మకమైన టెక్ న్యూస్ ప్లాట్‌ఫామ్ — AI, gadgets, mobile,
            internet వంటి విభాగాల్లో రోజువారీ తాజా &amp; విశ్వసనీయ వార్తలు తెలుగులో. 🚀
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-ink-soft">
            {FOOTER_PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="hover:text-accent">
                {p.label}
              </Link>
            ))}
            <Link href="/feed.xml" className="hover:text-accent">
              RSS
            </Link>
          </div>
        </div>

        {/* Follow us */}
        <div className="lg:text-right">
          <div className="flex items-center gap-2 lg:justify-end">
            <span className="text-accent">●</span>
            <span className="text-[15px] font-bold text-ink">
              Follow Us On Social Media
            </span>
          </div>
          <p className="mt-1 text-[12px] text-ink-mute">
            తాజా టెక్ &amp; AI updates కోసం మాతో connect అవ్వండి.
          </p>
          <SocialLinks variant="brand" size={18} className="mt-4 lg:justify-end" />
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto max-w-[1180px] px-4 py-4 text-center text-[12px] font-medium text-accent">
          © {new Date().getFullYear()} {SITE.name} · All rights reserved
        </div>
      </div>
    </footer>
  );
}
