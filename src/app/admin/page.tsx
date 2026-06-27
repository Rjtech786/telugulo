import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTrafficOverview,
  getTopArticlesByRange,
  startOfTodayIST,
  daysAgoISO,
  type DayPoint,
  type TopArticle,
} from "@/lib/analytics";
import {
  IconCheck,
  IconChart,
  IconArticles,
  IconSettings,
  IconKey,
} from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

export const dynamic = "force-dynamic";

type Content = { drafts: number; published: number; total: number; ready: boolean; error?: string };

async function getContentStats(): Promise<Content> {
  try {
    const supabase = createAdminClient();
    const [draftsRes, publishedRes] = await Promise.all([
      supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published"),
    ]);
    if (draftsRes.error) throw draftsRes.error;
    if (publishedRes.error) throw publishedRes.error;
    const drafts = draftsRes.count ?? 0;
    const published = publishedRes.count ?? 0;
    return { drafts, published, total: drafts + published, ready: true };
  } catch (e) {
    return { drafts: 0, published: 0, total: 0, ready: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export default async function AdminOverview() {
  const [content, traffic, topToday, topWeek] = await Promise.all([
    getContentStats(),
    getTrafficOverview(14).catch(() => null),
    getTopArticlesByRange(startOfTodayIST(), 6).catch(() => []),
    getTopArticlesByRange(daysAgoISO(7), 6).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Overview</h1>
        <p className="text-sm text-ink-soft">telugulo.in — traffic &amp; content dashboard</p>
      </div>

      {!content.ready && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Service role key missing.</strong> Add{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> to enable dashboard data. ({content.error})
        </div>
      )}

      {/* ── Traffic stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={IconChart}
          label="Views today"
          value={traffic?.today ?? 0}
          tone="red"
          sub={traffic ? `${traffic.yesterday} yesterday` : undefined}
        />
        <StatCard
          icon={IconChart}
          label="Views yesterday"
          value={traffic?.yesterday ?? 0}
          tone="blue"
        />
        <StatCard
          icon={IconChart}
          label="Last 7 days"
          value={traffic?.last7 ?? 0}
          tone="green"
          delta={traffic?.deltaPct ?? null}
        />
        <StatCard
          icon={IconCheck}
          label="Published"
          value={content.published}
          tone="violet"
          sub={`${content.drafts} drafts`}
        />
      </div>

      {/* ── 14-day traffic chart ── */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-mute">
            Traffic — last 14 days
          </h2>
          <span className="text-xs text-ink-mute">
            {traffic?.total ?? 0} views total
          </span>
        </div>
        {traffic && traffic.total > 0 ? (
          <TrafficChart series={traffic.series} />
        ) : (
          <EmptyHint>
            No page views recorded yet. As people read articles, daily traffic
            will show up here.
          </EmptyHint>
        )}
      </div>

      {/* ── Per-article traffic ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title="Top articles — today" items={topToday} />
        <TopList title="Top articles — last 7 days" items={topWeek} />
      </div>

      {/* ── Quick actions ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-mute">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/admin/articles" icon={IconArticles} label="Articles" desc="Generate, review & publish" />
          <QuickAction href="/admin/analytics" icon={IconChart} label="Analytics" desc="Winners & insights" />
          <QuickAction href="/admin/settings" icon={IconSettings} label="AI Settings" desc="Models, agent & cost" />
          <QuickAction href="/admin/site" icon={IconKey} label="Site Settings" desc="Name, socials & SEO" />
        </div>
      </div>
    </div>
  );
}

/* ─── Stat card ─── */
const TONES = {
  red: "bg-accent-soft text-accent",
  green: "bg-green-50 text-green-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  sub,
  delta,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string | number;
  tone: keyof typeof TONES;
  sub?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONES[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        {delta != null && <DeltaBadge pct={delta} />}
      </div>
      <div className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-ink">
        {value}
      </div>
      <div className="mt-0.5 text-sm text-ink-soft">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-mute">{sub}</div>}
    </div>
  );
}

function DeltaBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-semibold " +
        (up ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")
      }
    >
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

/* ─── SVG bar chart (no library) ─── */
function TrafficChart({ series }: { series: DayPoint[] }) {
  const max = Math.max(1, ...series.map((p) => p.views));
  const W = 720;
  const H = 160;
  const pad = 22;
  const n = series.length;
  const bw = (W - pad * 2) / n;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none">
      {series.map((p, i) => {
        const h = (p.views / max) * (H - pad * 2);
        const x = pad + i * bw;
        const y = H - pad - h;
        const isLast = i === n - 1;
        return (
          <g key={p.day}>
            <rect
              x={x + bw * 0.15}
              y={y}
              width={bw * 0.7}
              height={Math.max(h, 1)}
              rx={3}
              fill={isLast ? "var(--color-accent)" : "#f3c2c6"}
            >
              <title>{`${p.day}: ${p.views} views`}</title>
            </rect>
            {(i % 2 === 0 || isLast) && (
              <text
                x={x + bw / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-ink-mute)"
              >
                {p.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Top-article list ─── */
function TopList({ title, items }: { title: string; items: TopArticle[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-mute">
        {title}
      </h2>
      {items.length === 0 ? (
        <EmptyHint>No traffic in this range yet.</EmptyHint>
      ) : (
        <ol className="space-y-1">
          {items.map((a, i) => (
            <li key={a.article_id}>
              <Link
                href={`/${a.slug}`}
                target="_blank"
                className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface"
              >
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded bg-accent-soft text-xs font-bold text-accent">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink group-hover:text-accent">
                  {a.title}
                </span>
                <span className="flex-none text-sm font-semibold tabular-nums text-ink-soft">
                  {a.views}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-mute">
      {children}
    </p>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-line bg-white p-4 transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface text-ink-soft transition-colors group-hover:bg-white group-hover:text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block truncate text-xs text-ink-mute">{desc}</span>
      </span>
    </Link>
  );
}
