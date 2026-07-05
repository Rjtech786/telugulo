import "server-only";
import type { StepKey, CredentialProvider, TextProvider } from "@/lib/config";
import { getModelMap, getImageProvider } from "@/lib/settings";
import { getDecryptedKey } from "@/lib/api-keys";
import { generateText, type TextGenParams, type TextGenResult } from "./text";
import { generateImage, type ImageGenResult } from "./image";

/**
 * The common AI layer ("universal remote"). The agent calls runStep / runImage
 * provider-agnostically; this reads the dashboard's per-step model settings and
 * the encrypted API key, then routes to the right provider.
 */

// Image providers share an API key with their text sibling, so fall back to it
// if no dedicated key is saved: DALL·E → OpenAI key, Imagen → Gemini (Google) key.
const KEY_FALLBACK: Partial<Record<CredentialProvider, CredentialProvider>> = {
  dalle: "openai",
  imagen: "gemini",
};

async function keyFor(provider: CredentialProvider): Promise<string> {
  let key = await getDecryptedKey(provider);
  const fallback = KEY_FALLBACK[provider];
  if (!key && fallback) key = await getDecryptedKey(fallback);
  if (!key) {
    throw new Error(
      `No API key saved for "${provider}". Add it in Admin → Credentials.`,
    );
  }
  return key;
}

/** Run one pipeline step with its configured provider+model. */
export async function runStep(
  step: StepKey,
  params: TextGenParams,
): Promise<TextGenResult> {
  const map = await getModelMap();
  const { provider, model } = map[step];
  // Text provider ids ("claude"/"openai"/"gemini") match credential ids.
  const key = await keyFor(provider as CredentialProvider);
  return generateText(provider, model, key, params);
}

// Reliability: if a step's configured provider throws (rate limit, outage,
// bad key), retry once on a different provider instead of aborting the whole
// run — e.g. Claude fails -> retried on Gemini.
const FALLBACK_ORDER: TextProvider[] = ["gemini", "openai", "claude", "nvidia"];
const FALLBACK_MODEL: Record<TextProvider, string> = {
  claude: "claude-sonnet-4-6",
  openai: "gpt-4o",
  gemini: "gemini-2.5-flash",
  nvidia: "meta/llama-3.1-70b-instruct",
};

export type StepResult = TextGenResult & {
  usedFallback?: TextProvider;
  primaryProvider?: TextProvider;
  primaryError?: string;
};

/** Same as runStep, but retries once on a different provider if the primary fails. */
export async function runStepWithFallback(
  step: StepKey,
  params: TextGenParams,
  override?: { provider?: TextProvider; model?: string },
): Promise<StepResult> {
  const map = await getModelMap();
  const provider = override?.provider ?? map[step].provider;
  const model = override?.model ?? map[step].model;
  try {
    const key = await keyFor(provider as CredentialProvider);
    return await generateText(provider, model, key, params);
  } catch (primaryErr) {
    const primaryError = primaryErr instanceof Error ? primaryErr.message : "unknown error";
    for (const fb of FALLBACK_ORDER) {
      if (fb === provider) continue;
      try {
        const fbKey = await getDecryptedKey(fb as CredentialProvider);
        if (!fbKey) continue;
        const result = await generateText(fb, FALLBACK_MODEL[fb], fbKey, params);
        return { ...result, usedFallback: fb, primaryProvider: provider, primaryError };
      } catch {
        continue;
      }
    }
    throw primaryErr;
  }
}

/** Generate the featured image with the configured image provider. */
export async function runImage(prompt: string): Promise<ImageGenResult> {
  const provider = await getImageProvider();
  const key = await keyFor(provider as CredentialProvider);
  return generateImage(provider, key, prompt);
}
