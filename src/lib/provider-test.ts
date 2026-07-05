import "server-only";
import type { CredentialProvider } from "@/lib/config";
import { getDecryptedKey } from "@/lib/api-keys";

export type TestResult = { ok: boolean; message: string };

const TIMEOUT_MS = 12000;

async function ping(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Verify a stored credential by making a cheap, real API call. For
 * telegram_chat we send a test message (which also proves the token).
 */
export async function testProvider(
  provider: CredentialProvider,
  key: string,
): Promise<TestResult> {
  try {
    switch (provider) {
      case "claude": {
        const { status } = await ping("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        });
        return status === 200
          ? { ok: true, message: "Claude key valid ✓" }
          : { ok: false, message: `Claude returned ${status}` };
      }
      case "openai":
      case "dalle": {
        const { status } = await ping("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return status === 200
          ? { ok: true, message: "OpenAI key valid ✓" }
          : { ok: false, message: `OpenAI returned ${status}` };
      }
      case "gemini":
      case "imagen": {
        const { status } = await ping(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
          {},
        );
        return status === 200
          ? { ok: true, message: "Google AI key valid ✓" }
          : { ok: false, message: `Google AI returned ${status}` };
      }
      case "telegram_token": {
        const { status, body } = await ping(
          `https://api.telegram.org/bot${key}/getMe`,
          {},
        );
        if (status === 200) {
          const data = JSON.parse(body);
          return {
            ok: true,
            message: `Bot @${data.result?.username ?? "?"} ✓`,
          };
        }
        return { ok: false, message: `Telegram returned ${status}` };
      }
      case "telegram_chat": {
        // Needs the bot token to send a test message to this chat id.
        const token = await getDecryptedKey("telegram_token");
        if (!token) {
          return {
            ok: false,
            message: "Save the Telegram Bot Token first, then test the chat ID.",
          };
        }
        const { status, body } = await ping(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chat_id: key,
              text: "✅ telugulo.in — Telegram test message. Approval flow is connected.",
            }),
          },
        );
        if (status === 200) {
          return { ok: true, message: "Test message sent ✓ (check Telegram)" };
        }
        let detail = `HTTP ${status}`;
        try {
          detail = JSON.parse(body).description ?? detail;
        } catch {}
        return { ok: false, message: `Failed: ${detail}` };
      }
      case "nvidia": {
        const { status } = await ping("https://integrate.api.nvidia.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return status === 200
          ? { ok: true, message: "NVIDIA NIM key valid ✓" }
          : { ok: false, message: `NVIDIA NIM returned ${status}` };
      }
      default:
        return { ok: false, message: "Unknown provider" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, message: msg };
  }
}
