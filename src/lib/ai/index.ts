import "server-only";
import type { StepKey, CredentialProvider } from "@/lib/config";
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

/** Generate the featured image with the configured image provider. */
export async function runImage(prompt: string): Promise<ImageGenResult> {
  const provider = await getImageProvider();
  const key = await keyFor(provider as CredentialProvider);
  return generateImage(provider, key, prompt);
}
