import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the article body (Markdown) with editorial styling. Supports bold,
 * italic, headings (size), lists, links, blockquotes and inline images. The
 * first paragraph gets a larger "lead" treatment.
 */
export function ArticleBody({ body }: { body: string }) {
  return (
    <div className="text-[17px] leading-[1.9] text-[#2a2f3a] [&>p:first-of-type]:text-[19px] [&>p:first-of-type]:leading-[1.8] [&>p:first-of-type]:text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="mb-3 mt-9 font-serif text-[24px] font-bold leading-snug text-ink">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-7 font-serif text-[20px] font-bold leading-snug text-ink">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-5">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-bold text-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline underline-offset-2"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="mb-5 ml-5 list-disc space-y-1.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-5 ml-5 list-decimal space-y-1.5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-6 border-l-4 border-accent/30 pl-4 text-ink-soft italic">
              {children}
            </blockquote>
          ),
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => (
            <img
              src={typeof src === "string" ? src : ""}
              alt={alt ?? ""}
              loading="lazy"
              className="my-6 w-full rounded-xl border border-line"
            />
          ),
          hr: () => <hr className="my-8 border-line" />,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
