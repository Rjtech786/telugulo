import Link from "next/link";
import { getTopArticles, listInsights } from "@/lib/insights";
import { getIntegrations } from "@/lib/settings";
import { RunAnalysis } from "./RunAnalysis";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [top, insights, integrations] = await Promise.all([
    getTopArticles(10),
    listInsights(5),
    getIntegrations().catch(() => null),
  ]);
  const gaConfigured = Boolean(integrations?.ga_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Analytics</h1>
        <p className="text-sm text-ink-soft">
          Top articles, plus the agent&apos;s honest winner analysis. With few
          articles, patterns are guesses — confidence grows with data.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
        Google Analytics:{" "}
        {gaConfigured ? (
          <span className="font-medium text-green-600">connected ✓</span>
        ) : (
          <span className="font-medium text-amber-600">not set</span>
        )}
        . Add GA, Search Console &amp; AdSense codes in{" "}
        <Link href="/admin/integrations" className="font-medium text-accent underline">
          Integrations
        </Link>
        , then submit <code>/sitemap_index.xml</code> in Search Console.
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-mute">
          Top articles by views (all time)
        </h2>
        {top.length === 0 ? (
          <p className="text-sm text-ink-mute">No published articles yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {top.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded bg-accent-soft text-xs font-bold text-accent">
                    {i + 1}
                  </span>
                  <span className="truncate text-ink">{a.title}</span>
                </span>
                <span className="flex-none font-semibold tabular-nums text-ink-soft">
                  {a.views}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-mute">
            Winner analysis
          </h2>
          <RunAnalysis />
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-ink-mute">
            No analysis yet. Enable “Performance analysis” in Settings, then run it.
          </p>
        ) : (
          insights.map((ins) => (
            <div
              key={ins.id}
              className="rounded-2xl border border-line bg-white p-4 text-sm"
            >
              <div className="text-xs text-ink-mute">{ins.week}</div>
              {ins.patterns && <p className="mt-1 text-ink">{ins.patterns}</p>}
              {ins.suggestions && (
                <p className="mt-2 whitespace-pre-line text-ink-soft">
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
