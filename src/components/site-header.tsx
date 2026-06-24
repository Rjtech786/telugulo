import Link from "next/link";
import { SITE, CATEGORIES } from "@/lib/site";

const NAV = CATEGORIES.filter((c) =>
  ["ai", "gadgets", "mobile", "tech"].includes(c.slug),
);

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1040px] items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-accent text-lg font-bold text-white">
            తె
          </span>
          <span>
            <span className="block text-[19px] font-bold leading-none tracking-tight text-ink">
              {SITE.name}
            </span>
            <span className="block text-[11px] text-ink-soft">{SITE.tagline}</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden gap-6 text-sm text-ink-soft sm:flex">
          <Link href="/" className="py-1 transition hover:text-accent">
            హోమ్
          </Link>
          {NAV.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="py-1 transition hover:text-accent"
            >
              {c.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile nav — horizontally scrollable category chips */}
      <nav className="flex gap-2 overflow-x-auto border-t border-line px-4 py-2 sm:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <Link
          href="/"
          className="whitespace-nowrap rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
        >
          హోమ్
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/category/${c.slug}`}
            className="whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-sm text-ink-soft"
          >
            {c.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
