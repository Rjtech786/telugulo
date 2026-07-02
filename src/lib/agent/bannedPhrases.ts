import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Self-learning banned-phrase store (Language Editor reads + extends it). */
export type BannedPhrase = {
  id: number;
  phrase: string;
  replacement: string | null;
  reason: string | null;
};

export async function listBannedPhrases(limit = 100): Promise<BannedPhrase[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("banned_phrases")
    .select("id, phrase, replacement, reason")
    .order("id")
    .limit(limit);
  return (data as BannedPhrase[]) ?? [];
}

export async function addBannedPhrase(
  phrase: string,
  replacement?: string | null,
  reason?: string | null,
): Promise<void> {
  const p = phrase.trim();
  if (!p || p.length > 80) return;
  const supabase = createAdminClient();
  // upsert-ignore: unique(phrase)
  await supabase
    .from("banned_phrases")
    .upsert({ phrase: p, replacement: replacement ?? null, reason: reason ?? null }, { onConflict: "phrase", ignoreDuplicates: true });
}
