import { getTopArticles, listInsights } from "@/lib/insights";
import { RunAnalysis } from "./RunAnalysis";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [top, insights] = await Promise.all([getTopArticles(10), listInsights(5)]);
  const gaConfigured = Boolean(process.env.NEXT_PUBLIC_GA_ID);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-neutral-500">
          Top articles, plus the agent&apos;s honest winner analysis. With few
          articles, patterns are guesses — confidence grows with data.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        Google Analytics:{" "}
        {gaConfigured ? (
          <span className="text-green-600 dark:text-green-400">connected ✓</span>
        ) : (
          <span className="text-amber-600">
            not set — add <code>NEXT_PUBLIC_GA_ID</code> to <code>.env.local</code>
          </span>
        )}
        . Search Console: add <code>NEXT_PUBLIC_GSC_VERIFICATION</code> + submit{" "}
        <code>/sitemap.xml</code>.
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Top articles by views
        </h2>
        {top.length === 0 ? (
          <p className="text-sm text-neutral-500">No published articles yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            {top.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2 text-sm last:border-0 dark:border-neutral-800"
              >
                <span className="truncate">{a.title}</span>
                <span className="flex-none text-neutral-500">{a.views} views</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Winner analysis
          </h2>
          <RunAnalysis />
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No analysis yet. Enable “Performance analysis” in Settings, then run it.
          </p>
        ) : (
          insights.map((ins) => (
            <div
              key={ins.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="text-xs text-neutral-400">{ins.week}</div>
              {ins.patterns && <p className="mt-1">{ins.patterns}</p>}
              {ins.suggestions && (
                <p className="mt-2 whitespace-pre-line text-neutral-600 dark:text-neutral-400">
                  {ins.suggestions}
                </p>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
