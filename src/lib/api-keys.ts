import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto";
import type { CredentialProvider } from "@/lib/config";

/**
 * Encrypted API key storage. SERVER ONLY. Keys are stored AES-256-GCM
 * encrypted in the `api_keys` table and never returned to the browser in
 * plaintext.
 */

/** Which providers currently have a key saved (booleans only — no secrets). */
export async function getKeyStatuses(): Promise<Record<string, boolean>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("provider, key_enc");
  if (error) throw error;

  const statuses: Record<string, boolean> = {};
  for (const row of data ?? []) {
    statuses[row.provider] = Boolean(row.key_enc);
  }
  return statuses;
}

/** Save (encrypt + upsert) a provider key. */
export async function saveKey(
  provider: CredentialProvider,
  plaintext: string,
): Promise<void> {
  const supabase = createAdminClient();
  const key_enc = encrypt(plaintext);
  const { error } = await supabase
    .from("api_keys")
    .upsert({ provider, key_enc }, { onConflict: "provider" });
  if (error) throw error;
}

/** Remove a provider key. */
export async function deleteKey(provider: CredentialProvider): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("provider", provider);
  if (error) throw error;
}

/** Decrypt a provider key for server-side use (testing, pipeline). */
export async function getDecryptedKey(
  provider: CredentialProvider,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("key_enc")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  if (!data?.key_enc) return null;
  return decrypt(data.key_enc);
}
