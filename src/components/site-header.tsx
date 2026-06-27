import Link from "next/link";
import { CATEGORIES, formatDate } from "@/lib/site";
import { SocialLinks, type Social } from "@/components/social-links";

export function SiteHeader({
  name,
  tagline,
  socials,
}: {
  name: string;
  tagline: string;
  socials: Social[];
}) {
  const today = formatDate(new Date().toISOString());

  return (
    <header>
      {/* ── Logo bar (white) ── */}
      <div className="bg-white">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent text-xl font-bold text-white">
              తె
            </span>
            <span>
              <span className="block text-[22px] font-extrabold leading-none tracking-tight text-ink">
                {name}
              </span>
              <span className="block text-[11px] font-medium text-ink-soft">
                {tagline}
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-[12px] text-ink-mute">{today}</span>
            {socials.length > 0 && <span className="h-4 w-px bg-line" />}
            <SocialLinks socials={socials} variant="brand" size={16} />
          </div>
        </div>
      </div>

      {/* ── Sticky category strip (lavender, black links, red accents) ── */}
      <nav className="sticky top-0 z-50 border-y border-line bg-lav/97 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center gap-0.5 overflow-x-auto px-2 no-scrollbar">
          <NavLink href="/" label="హోమ్" />
          {CATEGORIES.map((c) => (
            <NavLink key={c.slug} href={`/category/${c.slug}`} label={c.label} />
          ))}
        </div>
      </nav>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap border-b-[3px] border-transparent px-3.5 py-2.5 text-[14px] font-semibold text-ink transition hover:border-accent hover:text-accent"
    >
      {label}
    </Link>
  );
}
