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

          <div className="flex items-center gap-3">
            {/* Search (desktop: inline box · mobile: icon → /search) */}
            <form action="/search/" className="hidden md:block">
              <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 transition focus-within:border-accent">
                <SearchIcon className="h-4 w-4 flex-none text-ink-mute" />
                <input
                  type="search"
                  name="q"
                  placeholder="వెతకండి…"
                  className="w-[150px] bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-mute"
                />
              </div>
            </form>
            <Link
              href="/search/"
              aria-label="వెతకండి"
              className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-soft transition hover:border-accent hover:text-accent md:hidden"
            >
              <SearchIcon className="h-4.5 w-4.5" />
            </Link>
            <span className="hidden text-[12px] text-ink-mute lg:inline">{today}</span>
            {socials.length > 0 && <span className="hidden h-4 w-px bg-line sm:inline" />}
            <span className="hidden sm:flex">
              <SocialLinks socials={socials} variant="brand" size={16} />
            </span>
          </div>
        </div>
      </div>

      {/* ── Sticky category strip (lavender, black links, red accents) ── */}
      <nav className="sticky top-0 z-50 border-y border-line bg-lav/97 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center gap-0.5 overflow-x-auto px-2 no-scrollbar">
          <NavLink href="/" label="హోమ్" />
          {CATEGORIES.map((c) => (
            <NavLink key={c.slug} href={`/category/${c.slug}/`} label={c.label} />
          ))}
        </div>
      </nav>
    </header>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
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
