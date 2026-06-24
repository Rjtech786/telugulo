"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { saveKey, deleteKey, getDecryptedKey } from "@/lib/api-keys";
import { testProvider, type TestResult } from "@/lib/provider-test";
import { CREDENTIALS, type CredentialProvider } from "@/lib/config";

const VALID = new Set(CREDENTIALS.map((c) => c.provider));

function assertProvider(p: string): asserts p is CredentialProvider {
  if (!VALID.has(p as CredentialProvider)) throw new Error("Invalid provider");
}

export async function saveCredential(provider: string, key: string) {
  await requireAdmin();
  assertProvider(provider);
  const trimmed = key.trim();
  if (!trimmed) throw new Error("Empty key");
  await saveKey(provider, trimmed);
  revalidatePath("/admin/credentials");
  return { ok: true };
}

export async function removeCredential(provider: string) {
  await requireAdmin();
  assertProvider(provider);
  await deleteKey(provider);
  revalidatePath("/admin/credentials");
  return { ok: true };
}

export async function testCredential(provider: string): Promise<TestResult> {
  await requireAdmin();
  assertProvider(provider);
  const key = await getDecryptedKey(provider);
  if (!key) return { ok: false, message: "No key saved yet" };
  return testProvider(provider, key);
}
