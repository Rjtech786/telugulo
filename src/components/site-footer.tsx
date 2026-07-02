import Link from "next/link";
import { SocialLinks, type Social } from "@/components/social-links";

// Preferred display order for the footer nav; anything else (e.g. a new page
// added in Admin -> Pages) is appended alphabetically after these.
const FOOTER_ORDER = ["about", "contact", "privacy", "disclaimer", "terms", "editorial-policy"];
function orderPages<T extends { slug: string }>(pages: T[]): T[] {
  return [...pages].sort((a, b) => {
    const ia = FOOTER_ORDER.indexOf(a.slug);
    const ib = FOOTER_ORDER.indexOf(b.slug);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

export function SiteFooter({
  name,
  about,
  socials,
  pages,
}: {
  name: string;
  about: string;
  socials: Social[];
  pages: { slug: string; title: string }[];
}) {
  return (
    <footer className="mt-12 border-t border-line bg-lav">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 lg:grid-cols-[1.6fr_1fr]">
        {/* Brand + description + policy links */}
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-accent text-lg font-bold text-white">
              తె
            </span>
            <span className="text-[19px] font-extrabold text-ink">{name}</span>
          </Link>
          <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
            {about}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-ink-soft">
            {orderPages(pages).map((p) => (
              <Link key={p.slug} href={`/${p.slug}`} className="hover:text-accent">
                {p.title}
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
          <SocialLinks
            socials={socials}
            variant="brand"
            size={18}
            className="mt-4 lg:justify-end"
          />
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto max-w-[1180px] px-4 py-4 text-center text-[12px] font-medium text-accent">
          © {new Date().getFullYear()} {name} · All rights reserved
        </div>
      </div>
    </footer>
  );
}
