/**
 * Renders the plain-text article body into paragraphs. The agent writes plain
 * text with blank lines between paragraphs (and occasional `## heading` lines).
 */
export function ArticleBody({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-4 text-[1.05rem] leading-8 text-neutral-800 dark:text-neutral-200">
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-2 text-xl font-bold tracking-tight">
              {block.replace(/^##\s+/, "")}
            </h2>
          );
        }
        if (block.startsWith("# ")) {
          return (
            <h2 key={i} className="pt-2 text-2xl font-bold tracking-tight">
              {block.replace(/^#\s+/, "")}
            </h2>
          );
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}
