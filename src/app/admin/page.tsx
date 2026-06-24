import { createAdminClient } from "@/lib/supabase/admin";

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
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),
    ]);

    if (draftsRes.error) throw draftsRes.error;
    if (publishedRes.error) throw publishedRes.error;

    const drafts = draftsRes.count ?? 0;
    const published = publishedRes.count ?? 0;
    return { drafts, published, total: drafts + published, ready: true };
  } catch (e) {
    return {
      drafts: 0,
      published: 0,
      total: 0,
      ready: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
    </div>
  );
}

export default async function AdminOverview() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-neutral-500">
          telugulo.in — AI tech news dashboard
        </p>
      </div>

      {!stats.ready && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Service role key missing.</strong> Add{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> to <code>.env.local</code> to
          enable full dashboard data. ({stats.error})
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Pending drafts" value={stats.drafts} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Total articles" value={stats.total} />
        <StatCard label="Monthly cost" value="₹0" />
      </div>

      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/50 p-6 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/50">
        All phases built. To go live: add your API keys in{" "}
        <a href="/admin/credentials" className="underline">Credentials</a>, tune{" "}
        <a href="/admin/settings" className="underline">AI Settings</a>, then hit{" "}
        <a href="/admin/articles" className="underline">Generate now</a> to create
        the first draft. Review &amp; publish — it appears on the public blog.
      </div>
    </div>
  );
}
