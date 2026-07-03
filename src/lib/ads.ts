import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { runStep } from "@/lib/ai";
import { AD_SYSTEM, adCopyPrompt } from "@/lib/agent/prompts";

export type Ad = {
  id: string;
  title: string | null;
  image_url: string | null;
  link: string | null;
  category: string | null;
  keywords: string[] | null;
  headline: string | null;
  description: string | null;
  cta: string | null;
  views: number;
  clicks: number;
  active: boolean;
  created_at: string;
};

export type AdCopy = { headline: string; description: string; cta: string };

/** Tolerant JSON extraction from a model response. */
function parseJson<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return JSON.parse(s) as T;
}

/** AI ad-copy composer — turns image+link+keywords into a polished ad. */
export async function composeAdCopy(input: {
  title?: string;
  keywords: string[];
  link: string;
}): Promise<AdCopy> {
  const res = await runStep("ads", {
    system: AD_SYSTEM,
    prompt: adCopyPrompt(input),
    maxTokens: 300,
    temperature: 0.8,
  });
  const parsed = parseJson<Partial<AdCopy>>(res.text);
  return {
    headline: (parsed.headline || input.title || "").trim().slice(0, 80),
    description: (parsed.description || "").trim().slice(0, 140),
    cta: (parsed.cta || "చూడండి").trim().slice(0, 24),
  };
}

// ── Admin (service role) ──
export async function listAds(): Promise<Ad[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Ad[]) ?? [];
}

export async function createAd(fields: {
  title: string;
  image_url: string;
  link: string;
  category: string;
  keywords: string[];
  headline: string;
  description: string;
  cta: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ads").insert({ ...fields, active: false });
  if (error) throw error;
}

export async function updateAd(
  id: string,
  fields: Partial<
    Pick<Ad, "title" | "image_url" | "link" | "category" | "keywords" | "headline" | "description" | "cta">
  >,
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ads").update(fields).eq("id", id);
  if (error) throw error;
}

export async function setAdActive(id: string, active: boolean) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ads").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteAd(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) throw error;
}

export async function recordAdClick(id: string) {
  const supabase = createAdminClient();
  await supabase.rpc("increment_ad_clicks", { ad_id: id });
}

export async function getAdLink(id: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("ads").select("link").eq("id", id).maybeSingle();
  return data?.link ?? null;
}

// ── Public (anon, RLS → only active ads) ──
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export type AdTarget = {
  category?: string | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
};

/** Score how well an ad's keywords match/relate to an article. */
function scoreAd(ad: Ad, text: string, category?: string | null): number {
  let score = 0;
  for (const kwRaw of ad.keywords ?? []) {
    const kw = kwRaw.trim().toLowerCase();
    if (!kw) continue;
    if (text.includes(kw)) {
      score += 3; // direct keyword hit
    } else if (kw.split(/\s+/).some((w) => w.length > 3 && text.includes(w))) {
      score += 1; // related — a significant word in the phrase matches
    }
  }
  if (ad.category && category && ad.category === category) score += 1;
  return score;
}

/** Best-effort ad-view counter (undercounts under ISR caching — fine). */
async function recordAdViews(ids: string[]): Promise<void> {
  const supabase = createAdminClient();
  await Promise.all(ids.map((id) => supabase.rpc("increment_ad_views", { ad_id: id }))).catch(
    () => {},
  );
}

/**
 * Pick up to `count` active ads for a page, most relevant first. Keywords are
 * a PRIORITY BOOST, not a hard filter: keyword-matched ads rank first, then
 * everything else rotates in — so an active ad is always visible somewhere
 * (an empty ads table is the only way to get zero ads).
 */
export async function pickAds(target: AdTarget, count = 1): Promise<Ad[]> {
  const { data } = await publicClient().from("ads").select("*").eq("active", true);
  const ads = (data as Ad[]) ?? [];
  if (ads.length === 0) return [];

  const text = `${target.title ?? ""} ${target.summary ?? ""} ${target.category ?? ""} ${target.body ?? ""}`.toLowerCase();

  const picked = ads
    .map((ad) => ({ ad, score: scoreAd(ad, text, target.category), r: Math.random() }))
    .sort((a, b) => b.score - a.score || a.r - b.r)
    .slice(0, count)
    .map((s) => s.ad);

  void recordAdViews(picked.map((a) => a.id));
  return picked;
}

/** Single most relevant ad (back-compat helper). */
export async function pickAd(target: AdTarget): Promise<Ad | null> {
  return (await pickAds(target, 1))[0] ?? null;
}
