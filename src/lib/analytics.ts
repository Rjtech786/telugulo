import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type DayPoint = { day: string; views: number };
export type TopArticle = {
  article_id: string;
  title: string;
  slug: string;
  category: string | null;
  views: number;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** YYYY-MM-DD for the IST calendar day of a UTC instant. */
function istDateStr(utc: Date): string {
  return new Date(utc.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC ISO timestamp for 00:00 IST of today (used as a "since" boundary). */
export function startOfTodayIST(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS).toISOString();
}

/** UTC ISO timestamp for N days ago. */
export function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export type TrafficOverview = {
  today: number;
  yesterday: number;
  last7: number;
  prev7: number;
  total: number;
  deltaPct: number | null;
  series: DayPoint[];
};

/** Zero-filled daily traffic series + today/yesterday/7-day rollups. */
export async function getTrafficOverview(days = 14): Promise<TrafficOverview> {
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("daily_view_counts", { p_days: days });
  const rows = (data as { day: string; views: number }[] | null) ?? [];
  const map = new Map(rows.map((r) => [r.day, Number(r.views)]));

  const series: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = istDateStr(new Date(Date.now() - i * 86_400_000));
    series.push({ day: key, views: map.get(key) ?? 0 });
  }

  const n = series.length;
  const today = series[n - 1]?.views ?? 0;
  const yesterday = series[n - 2]?.views ?? 0;
  const last7 = series.slice(-7).reduce((s, p) => s + p.views, 0);
  const prev7 = series.slice(-14, -7).reduce((s, p) => s + p.views, 0);
  const total = series.reduce((s, p) => s + p.views, 0);
  const deltaPct = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

  return { today, yesterday, last7, prev7, total, deltaPct, series };
}

/** Top articles by view events since a UTC ISO timestamp. */
export async function getTopArticlesByRange(
  sinceISO: string,
  limit = 8,
): Promise<TopArticle[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("top_articles_since", {
    p_since: sinceISO,
    p_limit: limit,
  });
  return (data as TopArticle[] | null) ?? [];
}
