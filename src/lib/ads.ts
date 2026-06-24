import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

export type Ad = {
  id: string;
  title: string | null;
  image_url: string | null;
  link: string | null;
  category: string | null;
  views: number;
  clicks: number;
  active: boolean;
  created_at: string;
};

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
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ads").insert({ ...fields, active: false });
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

/** Pick an active ad to show, preferring one matching the article category. */
export async function pickAd(category?: string | null): Promise<Ad | null> {
  const { data } = await publicClient()
    .from("ads")
    .select("*")
    .eq("active", true);
  const ads = (data as Ad[]) ?? [];
  if (ads.length === 0) return null;
  const matched = category ? ads.filter((a) => a.category === category) : [];
  const pool = matched.length ? matched : ads;
  return pool[Math.floor(Math.random() * pool.length)];
}
