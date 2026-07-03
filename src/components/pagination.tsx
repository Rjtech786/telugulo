import Link from "next/link";

/**
 * Numbered pagination for the homepage "తాజా వార్తలు" flow: page 1 is the
 * homepage itself, older pages live at /page/2/, /page/3/, …
 */
export function Pagination({ current, totalPages }: { current: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => (p <= 1 ? "/" : `/page/${p}/`);

  // Window of page numbers: 1 … (c-1, c, c+1) … last
  const nums = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const pages = [...nums].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const items: (number | "…")[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) items.push("…");
    items.push(pages[i]);
  }

  const btn =
    "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-[13.5px] font-semibold transition";

  return (
    <nav aria-label="పేజీలు" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {current > 1 && (
        <Link href={hrefFor(current - 1)} className={`${btn} border-line text-ink-soft hover:border-accent hover:text-accent`}>
          ‹ ముందు
        </Link>
      )}
      {items.map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} className="px-1 text-ink-mute">…</span>
        ) : (
          <Link
            key={it}
            href={hrefFor(it)}
            aria-current={it === current ? "page" : undefined}
            className={
              `${btn} ` +
              (it === current
                ? "border-accent bg-accent text-white"
                : "border-line text-ink-soft hover:border-accent hover:text-accent")
            }
          >
            {it}
          </Link>
        ),
      )}
      {current < totalPages && (
        <Link href={hrefFor(current + 1)} className={`${btn} border-line text-ink-soft hover:border-accent hover:text-accent`}>
          తర్వాత ›
        </Link>
      )}
    </nav>
  );
}
