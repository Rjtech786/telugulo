/**
 * Article body post-processing: table-of-contents extraction + stripping the
 * AI-written "Sources:" section that used to get baked into the body text
 * (redundant with the dedicated "మూలాలు (Sources)" block rendered from
 * `source_urls`). Both operate on the same body so heading indices/anchors
 * line up with what <ArticleBody> actually renders.
 */

export type TocHeading = { id: string; text: string; level: 2 | 3 };

/**
 * Remove a trailing "Sources:"/"**Sources:**"/"## Sources" section (and its
 * bullet list) that the Writer/Fixer sometimes appends despite the separate
 * Sources block already covering this. Only strips a SOURCES heading found
 * in the last ~40% of the body, so a legitimate mid-article mention is
 * never touched.
 */
export function stripInlineSourcesSection(body: string): string {
  const re = /(^|\n)\s*(?:#{1,3}\s*)?\*{0,2}sources\*{0,2}\s*:?\s*\n(?:[ \t]*[-*].*\n?)*$/i;
  const cutoff = Math.floor(body.length * 0.6);
  const match = body.slice(cutoff).match(re);
  if (!match || match.index == null) return body.trim();
  return body.slice(0, cutoff + match.index).trim();
}

/** Extract ## / ### headings in document order, with sequential anchor ids matching <ArticleBody>. */
export function extractHeadings(body: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = body.split("\n");
  let i = 0;
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*$/);
    if (m) {
      headings.push({
        id: `heading-${i}`,
        text: m[2].replace(/[*_`]/g, "").trim(),
        level: m[1].length as 2 | 3,
      });
      i++;
    }
  }
  return headings;
}
