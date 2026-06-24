import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatures } from "@/lib/settings";
import { runStep } from "@/lib/ai";

export type Insight = {
  id: string;
  week: string | null;
  top_articles: { title: string; views: number }[] | null;
  patterns: string | null;
  suggestions: string | null;
  created_at: string;
};

export async function getTopArticles(limit = 10) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("articles")
    .select("title, slug, category, views, published_at")
    .eq("status", "published")
    .order("views", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listInsights(limit = 8): Promise<Insight[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("performance_insights")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as Insight[]) ?? [];
}

/**
 * Weekly winner analysis. Compares high vs low traffic articles and asks a
 * cheap model for patterns — but is explicitly honest that with few articles
 * (<~50) these are guesses, not certainty (spec §4).
 */
export async function generateWeeklyInsights(): Promise<{
  ok: boolean;
  message: string;
}> {
  const features = await getFeatures();
  if (!features.performance_analysis) {
    return { ok: false, message: "Performance analysis is OFF (enable in Settings)" };
  }

  const supabase = createAdminClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("title, category, views")
    .eq("status", "published")
    .order("views", { ascending: false });

  if (!articles || articles.length < 3) {
    return { ok: false, message: "Need at least 3 published articles to analyse" };
  }

  const list = articles
    .map((a, i) => `${i + 1}. [${a.category}] "${a.title}" — ${a.views} views`)
    .join("\n");

  const lowData = articles.length < 50;
  const prompt = `Here are published articles by view count (high to low):

${list}

Total: ${articles.length} articles. ${
    lowData
      ? "IMPORTANT: this is a SMALL sample — treat any pattern as a tentative guess, not certainty. Traffic also depends on Google Discover randomness, not just quality. Say so."
      : ""
  }

As a data analyst, find patterns (topic, category, headline style, length) that separate higher-traffic from lower-traffic articles, and give 2-3 actionable suggestions.

Respond ONLY with JSON: {"patterns": "<short paragraph>", "suggestions": "<2-3 bullet-style lines>"}`;

  const res = await runStep("performance", {
    prompt,
    maxTokens: 700,
    temperature: 0.4,
  });

  let parsed: { patterns: string; suggestions: string };
  try {
    const s = res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1);
    parsed = JSON.parse(s);
  } catch {
    parsed = { patterns: res.text, suggestions: "" };
  }

  const week = new Date().toISOString().slice(0, 10);
  await supabase.from("performance_insights").insert({
    week,
    top_articles: articles.slice(0, 5).map((a) => ({ title: a.title, views: a.views })),
    patterns: parsed.patterns,
    suggestions: parsed.suggestions,
  });

  return { ok: true, message: "Analysis saved" };
}
