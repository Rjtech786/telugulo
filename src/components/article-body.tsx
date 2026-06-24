/**
 * Renders the plain-text article body into paragraphs. The agent writes plain
 * text with blank lines between paragraphs (and occasional `## heading` lines).
 * The first paragraph gets a larger "lead" treatment (editorial feel).
 */
export function ArticleBody({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  let firstPara = true;

  return (
    <div className="text-[17px] leading-[1.9] text-[#2a2f3a]">
      {blocks.map((block, i) => {
        if (/^#{1,2}\s+/.test(block)) {
          return (
            <h2
              key={i}
              className="mb-3 mt-9 font-serif text-[24px] font-bold leading-snug text-ink"
            >
              {block.replace(/^#{1,2}\s+/, "")}
            </h2>
          );
        }
        const isLead = firstPara;
        firstPara = false;
        return (
          <p
            key={i}
            className={
              isLead
                ? "mb-5 text-[19px] leading-[1.8] text-ink"
                : "mb-5"
            }
          >
            {block}
          </p>
        );
      })}
    </div>
  );
}
