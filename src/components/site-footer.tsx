import Link from "next/link";
import { SITE, FOOTER_PAGES } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-3 px-5 py-7">
        <div className="text-[13px] text-ink-soft">
          © {new Date().getFullYear()} {SITE.name} · {SITE.tagline}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
          {FOOTER_PAGES.map((p) => (
            <Link key={p.href} href={p.href} className="py-1 hover:text-accent">
              {p.label}
            </Link>
          ))}
          <Link href="/feed.xml" className="py-1 hover:text-accent">
            RSS
          </Link>
        </div>
      </div>
    </footer>
  );
}
