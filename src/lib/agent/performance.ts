import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatures, getCost, getPerformanceState, setPerformanceLastRun } from "@/lib/settings";
import { getTopArticlesByRange, daysAgoISO } from "@/lib/analytics";
import { addSkillNote } from "./skills";
import { runStepWithFallback } from "@/lib/ai";
import { SYSTEM_EDITOR, performanceAnalysisPrompt } from "./prompts";

/**
 * Performance agent (Phase B — the learning loop). Runs on the cadence set by
 * `cost.performance_frequency` (weekly/monthly), reads real `page_views`
 * traffic for recently published articles, and turns the pattern it finds
 * into `skill_notes` rows — which are already auto-injected into every
 * writing prompt (see ./skills getSkillNoteTexts), so the Writer/Topic Scout
 * get smarter over time with zero code changes.
 */

export type PerformanceResult =
  | { status: "skipped"; reason: string }
  | { status: "ok"; insightsAdded: number; note: string };

const MS_DAY = 86_400_000;
const WINDOW_DAYS = 90;
const MIN_ARTICLES = 6;
const MIN_AGE_DAYS_FOR_RANKING = 2;
const FREQUENCY_DAYS: Record<"weekly" | "monthly", number> = { weekly: 7, monthly: 30 };

type ArticleRow = {
  id: string;
  title: string;
  category: string | null;
  body: string | null;
  published_at: string | null;
};

type ArticleStat = {
  title: string;
  category: string;
  views: number;
  wordCount: number;
  headlineWords: number;
  ageDays: number;
  viewsPerDay: number;
};

function bucketByAvgRate(stats: ArticleStat[], keyOf: (s: ArticleStat) => string): string {
  const agg = new Map<string, { count: number; totalRate: number }>();
  for (const s of stats) {
    const key = keyOf(s);
    const a = agg.get(key) ?? { count: 0, totalRate: 0 };
    a.count += 1;
    a.totalRate += s.viewsPerDay;
    agg.set(key, a);
  }
  return [...agg.entries()]
    .map(([key, a]) => ({ key, avg: a.totalRate / a.count, count: a.count }))
    .sort((a, b) => b.avg - a.avg)
    .map((r) => `- ${r.key}: ${r.avg.toFixed(2)} views/day avg (${r.count} articles)`)
    .join("\n");
}

function wordBucket(words: number): string {
  if (words < 700) return "short (<700w)";
  if (words <= 1000) return "medium (700-1000w)";
  return "long (>1000w)";
}

function headlineBucket(words: number): string {
  if (words <= 6) return "short headline (<=6 words)";
  if (words <= 10) return "medium headline (7-10 words)";
  return "long headline (>10 words)";
}

function parseInsights(raw: string): { problem_type: string; solution_note: string }[] {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  try {
    const parsed = JSON.parse(s) as { insights?: { problem_type: string; solution_note: string }[] };
    return parsed.insights ?? [];
  } catch {
    return [];
  }
}

export async function runPerformanceAnalysis(): Promise<PerformanceResult> {
  const features = await getFeatures();
  if (!features.performance_analysis) {
    return { status: "skipped", reason: "Performance analysis feature is OFF" };
  }

  const cost = await getCost();
  const dueDays = FREQUENCY_DAYS[cost.performance_frequency];
  const state = await getPerformanceState();
  if (state.last_run_at) {
    const sinceLastDays = (Date.now() - new Date(state.last_run_at).getTime()) / MS_DAY;
    if (sinceLastDays < dueDays) {
      return {
        status: "skipped",
        reason: `Not due yet (last run ${sinceLastDays.toFixed(1)}d ago, frequency=${cost.performance_frequency})`,
      };
    }
  }

  const sinceISO = daysAgoISO(WINDOW_DAYS);
  const supabase = createAdminClient();
  const [{ data: articleRows }, rangedViews] = await Promise.all([
    supabase
      .from("articles")
      .select("id, title, category, body, published_at")
      .eq("status", "published")
      .gte("published_at", sinceISO)
      .limit(200),
    getTopArticlesByRange(sinceISO, 200),
  ]);

  const rows = (articleRows as ArticleRow[] | null) ?? [];
  if (rows.length < MIN_ARTICLES) {
    return {
      status: "skipped",
      reason: `Only ${rows.length} published articles in the last ${WINDOW_DAYS}d — need at least ${MIN_ARTICLES} for a meaningful analysis`,
    };
  }

  const viewsById = new Map(rangedViews.map((r) => [r.article_id, Number(r.views)]));
  const now = Date.now();
  const stats: ArticleStat[] = rows
    .filter((r) => r.published_at)
    .map((r) => {
      const ageDays = Math.max(1, (now - new Date(r.published_at as string).getTime()) / MS_DAY);
      const wordCount = (r.body ?? "").split(/\s+/).filter(Boolean).length;
      const headlineWords = (r.title ?? "").split(/\s+/).filter(Boolean).length;
      const views = viewsById.get(r.id) ?? 0;
      return {
        title: r.title,
        category: r.category || "tech",
        views,
        wordCount,
        headlineWords,
        ageDays,
        viewsPerDay: views / ageDays,
      };
    });

  const categoryLines = bucketByAvgRate(stats, (s) => s.category);
  const wordLines = bucketByAvgRate(stats, (s) => wordBucket(s.wordCount));
  const headlineLines = bucketByAvgRate(stats, (s) => headlineBucket(s.headlineWords));

  const eligible = stats.filter((s) => s.ageDays >= MIN_AGE_DAYS_FOR_RANKING);
  const ranked = [...eligible].sort((a, b) => b.viewsPerDay - a.viewsPerDay);
  const top = ranked.slice(0, 5);
  const bottom = ranked.length > 8 ? ranked.slice(-5).reverse() : [];

  const fmt = (a: ArticleStat) => `"${a.title}" [${a.category}] — ${a.viewsPerDay.toFixed(2)}/day, ${a.wordCount}w`;
  const digest = `CATEGORY PERFORMANCE (avg views/day):\n${categoryLines}\n\nWORD COUNT PERFORMANCE:\n${wordLines}\n\nHEADLINE LENGTH PERFORMANCE:\n${headlineLines}\n\nTOP ARTICLES (views/day):\n${top
    .map((a, i) => `${i + 1}. ${fmt(a)}`)
    .join("\n")}${
    bottom.length
      ? `\n\nLOWEST-PERFORMING ARTICLES (at least ${MIN_AGE_DAYS_FOR_RANKING}d old):\n${bottom
          .map((a, i) => `${i + 1}. ${fmt(a)}`)
          .join("\n")}`
      : ""
  }`;

  const res = await runStepWithFallback("performance", {
    system: SYSTEM_EDITOR,
    prompt: performanceAnalysisPrompt(digest),
    maxTokens: 800,
    temperature: 0.3,
  });
  const insights = parseInsights(res.text).slice(0, 5);

  for (const ins of insights) {
    if (ins.problem_type?.trim() && ins.solution_note?.trim()) {
      await addSkillNote(ins.problem_type, ins.solution_note);
    }
  }

  await setPerformanceLastRun(new Date().toISOString());

  return {
    status: "ok",
    insightsAdded: insights.length,
    note: insights.length
      ? `Added ${insights.length} skill note(s) from ${stats.length} articles' performance data.`
      : `Analyzed ${stats.length} articles but found no confident new pattern this time.`,
  };
}
