import type { Metadata } from "next";
import { searchPublished } from "@/lib/public";
import { ArticleCard } from "@/components/article-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "వెతకండి (Search)",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await searchPublished(query) : [];

  return (
    <div className="py-6">
      <div className="mb-5 flex items-center gap-2 border-b-2 border-line pb-2">
        <span className="h-5 w-[5px] rounded-full bg-accent" />
        <h1 className="text-[18px] font-extrabold text-ink">వెతకండి</h1>
      </div>

      <form action="/search/" className="mb-7 flex max-w-xl gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="ఏం వెతుకుతున్నారు? (e.g. Gemini, WhatsApp…)"
          className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          autoFocus
        />
        <button className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-dark">
          వెతకండి
        </button>
      </form>

      {query &&
        (results.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-ink-soft">
              “{query}” కోసం {results.length} ఫలితాలు:
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
              {results.map((a) => (
                <ArticleCard key={a.id} a={a} />
              ))}
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-ink-soft">
            “{query}” కోసం ఏమీ దొరకలేదు — వేరే పదంతో ప్రయత్నించండి.
          </p>
        ))}
    </div>
  );
}
