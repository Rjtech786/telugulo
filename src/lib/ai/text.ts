import "server-only";
import type { TextProvider } from "@/lib/config";

export type TextGenParams = {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
};

export type TextGenResult = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
};

const TIMEOUT_MS = 120000;

async function postJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    return JSON.parse(body);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Provider-agnostic text generation. The agent calls this without caring which
 * provider is behind it — the dashboard's per-step settings pick provider+model
 * (see lib/ai/index.ts).
 */
export async function generateText(
  provider: TextProvider,
  model: string,
  apiKey: string,
  params: TextGenParams,
): Promise<TextGenResult> {
  const maxTokens = params.maxTokens ?? 4096;
  const temperature = params.temperature ?? 0.7;

  switch (provider) {
    case "claude": {
      const data = await postJson("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          ...(params.system ? { system: params.system } : {}),
          messages: [{ role: "user", content: params.prompt }],
        }),
      });
      const text = (data.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");
      return {
        text,
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      };
    }

    case "openai": {
      const messages = [
        ...(params.system
          ? [{ role: "system", content: params.system }]
          : []),
        { role: "user", content: params.prompt },
      ];
      const data = await postJson(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          }),
        },
      );
      return {
        text: data.choices?.[0]?.message?.content ?? "",
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      };
    }

    case "gemini": {
      const data = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(params.system
              ? { systemInstruction: { parts: [{ text: params.system }] } }
              : {}),
            contents: [{ role: "user", parts: [{ text: params.prompt }] }],
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature,
              ...(model.includes("gemini-2.5")
                ? { thinkingConfig: { thinkingBudget: 0 } }
                : {}),
            },
          }),
        },
      );
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("");
      return {
        text,
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      };
    }

    case "nvidia": {
      const messages = [
        ...(params.system
          ? [{ role: "system", content: params.system }]
          : []),
        { role: "user", content: params.prompt },
      ];
      const data = await postJson(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          }),
        },
      );
      return {
        text: data.choices?.[0]?.message?.content ?? "",
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      };
    }

    default:
      throw new Error(`Unknown text provider: ${provider}`);
  }
}
