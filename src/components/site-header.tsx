import Link from "next/link";
import { SITE, CATEGORIES } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight">
          {SITE.name}
        </Link>
        <nav className="hidden gap-4 text-sm text-neutral-600 sm:flex dark:text-neutral-400">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="transition hover:text-neutral-900 dark:hover:text-white"
            >
              {c.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
