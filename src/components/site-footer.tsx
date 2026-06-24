import Link from "next/link";
import { SITE, FOOTER_PAGES } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-500">
          {FOOTER_PAGES.map((p) => (
            <Link key={p.href} href={p.href} className="hover:text-neutral-900 dark:hover:text-white">
              {p.label}
            </Link>
          ))}
          <Link href="/feed.xml" className="hover:text-neutral-900 dark:hover:text-white">
            RSS
          </Link>
        </div>
        <p className="mt-4 text-xs text-neutral-400">
          © {new Date().getFullYear()} {SITE.name} · AI-assisted, human-reviewed
          Telugu tech & AI news.
        </p>
      </div>
    </footer>
  );
}
