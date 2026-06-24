import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IconDraft,
  IconCheck,
  IconStack,
  IconWallet,
  IconArticles,
  IconSettings,
  IconKey,
} from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

export const dynamic = "force-dynamic";

type Stats = {
  drafts: number;
  published: number;
  total: number;
  ready: boolean;
  error?: string;
};

async function getStats(): Promise<Stats> {
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

const TONES = {
  amber: "bg-amber-50 text-amber-600",
  green: "bg-green-50 text-green-600",
  blue: "bg-accent-soft text-accent",
  violet: "bg-violet-50 text-violet-600",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string | number;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-ink">
        {value}
      </div>
      <div className="mt-0.5 text-sm text-ink-soft">{label}</div>
    </div>
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

export default async function AdminOverview() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Overview</h1>
        <p className="text-sm text-ink-soft">telugulo.in — AI tech-news dashboard</p>
      </div>

      {!stats.ready && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Service role key missing.</strong> Add{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> to <code>.env.local</code> to
          enable full dashboard data. ({stats.error})
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IconDraft} label="Pending drafts" value={stats.drafts} tone="amber" />
        <StatCard icon={IconCheck} label="Published" value={stats.published} tone="green" />
        <StatCard icon={IconStack} label="Total articles" value={stats.total} tone="blue" />
        <StatCard icon={IconWallet} label="Monthly cost" value="₹0" tone="violet" />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-mute">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickAction href="/admin/articles" icon={IconArticles} label="Articles" desc="Generate, review & publish" />
          <QuickAction href="/admin/settings" icon={IconSettings} label="AI Settings" desc="Models, toggles & cost" />
          <QuickAction href="/admin/credentials" icon={IconKey} label="Credentials" desc="API keys (encrypted)" />
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-5 text-sm text-ink-soft">
        All phases built. To go live: add your API keys in{" "}
        <Link href="/admin/credentials" className="font-medium text-accent hover:underline">Credentials</Link>, tune{" "}
        <Link href="/admin/settings" className="font-medium text-accent hover:underline">AI Settings</Link>, then hit{" "}
        <Link href="/admin/articles" className="font-medium text-accent hover:underline">Generate now</Link> to create the
        first draft. Review &amp; publish — it appears on the public blog.
      </div>
    </div>
  );
}
