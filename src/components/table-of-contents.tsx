import type { TocHeading } from "@/lib/article-toc";

/**
 * Small collapsible "in this article" box built from the body's ## / ###
 * headings. Uses native <details> — expand/collapse with zero client JS.
 */
export function TableOfContents({ headings }: { headings: TocHeading[] }) {
  if (headings.length < 2) return null;

  return (
    <details
      open
      className="group mt-6 rounded-xl border border-line bg-surface px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[14px] font-bold text-ink">
        <span className="flex items-center gap-2">
          <span aria-hidden="true">📑</span> ఈ ఆర్టికల్‌లో
        </span>
        <span className="text-ink-mute transition-transform group-open:rotate-180">▾</span>
      </summary>
      <ol className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
        {headings.map((h, i) => (
          <li key={h.id} className={h.level === 3 ? "ml-4" : ""}>
            <a
              href={`#${h.id}`}
              className="text-[13.5px] leading-snug text-ink-soft transition hover:text-accent"
            >
              {h.level === 2 ? `${i + 1}. ` : "– "}
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}
