import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { runStep } from "@/lib/ai";
import { getDecryptedKey } from "@/lib/api-keys";
import { AD_SYSTEM, adCopyPrompt } from "@/lib/agent/prompts";
import type { AdType } from "@/lib/config";

export type Ad = {
  id: string;
  title: string | null;
  image_url: string | null;
  images: string[];
  type: AdType;
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

/** AI ad-copy composer (text-only) — turns title+link+keywords into a polished ad. */
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

/**
 * Vision-aware ad-copy composer — looks at the actual uploaded images (not
 * just text) so the copy matches what's really in the creative. Falls back
 * to the text-only composer if no OpenAI key or no images are given.
 */
export async function composeAdCopyVision(input: {
  images: string[];
  title?: string;
  keywords: string[];
  link: string;
}): Promise<AdCopy> {
  const key = await getDecryptedKey("openai");
  if (!key || input.images.length === 0) {
    return composeAdCopy(input);
  }

  const prompt = `${adCopyPrompt(input)}\n\nLook at the attached image(s) of the actual ad creative — make sure your headline/description genuinely match what's shown (product, scene, mood).`;
  const content: Record<string, unknown>[] = [{ type: "text", text: prompt }];
  for (const url of input.images.slice(0, 3)) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: AD_SYSTEM },
        { role: "user", content },
      ],
      max_tokens: 300,
      temperature: 0.8,
    }),
  });
  if (!res.ok) return composeAdCopy(input);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = parseJson<Partial<AdCopy>>(text);
    return {
      headline: (parsed.headline || input.title || "").trim().slice(0, 80),
      description: (parsed.description || "").trim().slice(0, 140),
      cta: (parsed.cta || "చూడండి").trim().slice(0, 24),
    };
  } catch {
    return composeAdCopy(input);
  }
}

/**
 * AI image enhancement — turns a rough/plain photo into a cleaner, more
 * attractive ad creative (better lighting/composition/background) using
 * OpenAI's image-edit endpoint. Returns the enhanced image bytes; caller is
 * responsible for uploading it to Storage.
 */
export async function enhanceAdImage(
  imageUrl: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const key = await getDecryptedKey("openai");
  if (!key) throw new Error("OpenAI key not configured (needed to enhance images)");

  const srcRes = await fetch(imageUrl);
  if (!srcRes.ok) throw new Error(`Could not fetch the source image (${srcRes.status})`);
  const srcBlob = await srcRes.blob();

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append(
    "prompt",
    "Turn this into a clean, professional, eye-catching advertisement creative. Enhance the lighting, colors, and composition; keep the main subject clearly visible and unchanged. Do not add any text, logos, or watermarks.",
  );
  form.append("image", srcBlob, "source.png");
  form.append("size", "1536x1024");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Image enhance failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image enhance returned no image");
  return { bytes: Buffer.from(b64, "base64"), contentType: "image/png" };
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
  images: string[];
  type: AdType;
  link: string;
  category: string;
  keywords: string[];
  headline: string;
  description: string;
  cta: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ads").insert({
    ...fields,
    image_url: fields.images[0] ?? null, // legacy column, kept for back-compat
    active: false,
  });
  if (error) throw error;
}

export async function updateAd(
  id: string,
  fields: Partial<
    Pick<Ad, "title" | "images" | "type" | "link" | "category" | "keywords" | "headline" | "description" | "cta">
  >,
) {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = { ...fields };
  if (fields.images) patch.image_url = fields.images[0] ?? null;
  const { error } = await supabase.from("ads").update(patch).eq("id", id);
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
  await Promise.all([
    supabase.rpc("increment_ad_clicks", { ad_id: id }),
    supabase.from("ad_events").insert({ ad_id: id, event: "click" }),
  ]).catch(() => {});
}

export async function getAdLink(id: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("ads").select("link").eq("id", id).maybeSingle();
  return data?.link ?? null;
}

// ── Analytics (Admin -> Ads) ──
export type AdAnalytics = {
  series: { day: string; views: number; clicks: number }[];
  perAd: { id: string; title: string; type: AdType; views: number; clicks: number; ctr: number }[];
};

export async function getAdAnalytics(days = 14): Promise<AdAnalytics> {
  const supabase = createAdminClient();
  const [{ data: rows }, ads] = await Promise.all([
    supabase.rpc("daily_ad_events", { p_days: days }),
    listAds(),
  ]);
  const byDay = new Map((rows as { day: string; views: number; clicks: number }[] | null ?? []).map((r) => [r.day, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(key);
    series.push({ day: key, views: Number(r?.views ?? 0), clicks: Number(r?.clicks ?? 0) });
  }
  const perAd = ads.map((a) => ({
    id: a.id,
    title: a.title || a.headline || "(untitled)",
    type: a.type,
    views: a.views,
    clicks: a.clicks,
    ctr: a.views > 0 ? Math.round((a.clicks / a.views) * 1000) / 10 : 0,
  }));
  return { series, perAd };
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
  if (ids.length === 0) return;
  const supabase = createAdminClient();
  await Promise.all([
    ...ids.map((id) => supabase.rpc("increment_ad_views", { ad_id: id })),
    supabase.from("ad_events").insert(ids.map((ad_id) => ({ ad_id, event: "view" }))),
  ]).catch(() => {});
}

/**
 * Pick up to `count` active ads of one `type` for a page, most relevant
 * first. Keywords are a PRIORITY BOOST, not a hard filter: keyword-matched
 * ads rank first, then everything else rotates in — so an active ad of that
 * type is always visible somewhere (an empty pool is the only way to get
 * zero ads).
 */
export async function pickAds(target: AdTarget, count = 1, type: AdType = "card"): Promise<Ad[]> {
  const { data } = await publicClient().from("ads").select("*").eq("active", true).eq("type", type);
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

/** Single most relevant card ad (back-compat helper). */
export async function pickAd(target: AdTarget): Promise<Ad | null> {
  return (await pickAds(target, 1, "card"))[0] ?? null;
}

/** Highest-priority active popup ad (sitewide — no per-article context). */
export async function pickPopupAd(target: AdTarget = {}): Promise<Ad | null> {
  return (await pickAds(target, 1, "popup"))[0] ?? null;
}
