/**
 * Renders the plain-text article body into paragraphs. The agent writes plain
 * text with blank lines between paragraphs (and occasional `## heading` lines).
 */
export function ArticleBody({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="text-[17px] leading-[1.85] text-[#2a2f3a]">
      {blocks.map((block, i) => {
        if (/^#{1,2}\s+/.test(block)) {
          return (
            <h2
              key={i}
              className="mb-3.5 mt-8 text-[22px] font-bold tracking-tight text-ink"
            >
              {block.replace(/^#{1,2}\s+/, "")}
            </h2>
          );
        }
        return (
          <p key={i} className="mb-5">
            {block}
          </p>
        );
      })}
    </div>
  );
}
