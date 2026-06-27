import "server-only";
import type { ImageProvider } from "@/lib/config";

export type ImageGenResult = {
  /** Raw image bytes (decoded from base64). */
  bytes: Buffer;
  contentType: string;
};

const TIMEOUT_MS = 120000;

// Imagen on Google AI Studio. 16:9 output is ~1408×768 (>1200px wide — meets
// the Google Discover requirement).
const IMAGEN_MODEL = "imagen-3.0-generate-002";

async function post(url: string, init: RequestInit) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    return JSON.parse(body);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Provider-agnostic image generation. Always returns a landscape image
 * suitable for Google Discover (1200px+ wide). Bytes go to Supabase Storage.
 */
export async function generateImage(
  provider: ImageProvider,
  apiKey: string,
  prompt: string,
): Promise<ImageGenResult> {
  switch (provider) {
    case "imagen": {
      const data = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio: "16:9" },
          }),
        },
      );
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) throw new Error("Imagen returned no image");
      return { bytes: Buffer.from(b64, "base64"), contentType: "image/png" };
    }

    case "dalle": {
      // OpenAI's current image model (gpt-image-1). dall-e-3 is unavailable on
      // newer accounts. Always returns base64 PNG; no response_format param.
      const data = await post("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          size: "1536x1024", // landscape, >1200px wide (Google Discover)
          n: 1,
          quality: "low", // cheapest (~₹1.4/img); fine for blog headers
        }),
      });
      const item = data.data?.[0];
      if (item?.b64_json) {
        return { bytes: Buffer.from(item.b64_json, "base64"), contentType: "image/png" };
      }
      if (item?.url) {
        const imgRes = await fetch(item.url);
        if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
        return {
          bytes: Buffer.from(await imgRes.arrayBuffer()),
          contentType: imgRes.headers.get("content-type") || "image/png",
        };
      }
      throw new Error("OpenAI returned no image");
    }

    default:
      throw new Error(`Unknown image provider: ${provider}`);
  }
}
