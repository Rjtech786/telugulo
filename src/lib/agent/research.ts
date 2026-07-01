import "server-only";
import { getDecryptedKey } from "@/lib/api-keys";
import type { Candidate } from "./sources";

/**
 * LIVE web research via Gemini's Google Search grounding. Gemini actually
 * searches the web, reads current sources, and returns concrete FACTS with
 * citations — so the writer works from real dates/numbers/names, not memory.
 *
 * This replaces the old "fetch Google-News links" approach, whose redirect
 * links returned Google JS pages (garbage), not article text.
 */

const RESEARCH_MODEL = "gemini-2.5-flash"; // supports Google Search grounding
const TIMEOUT_MS = 60000;

export type ResearchResult = { text: string; sources: Candidate[] };

interface GeminiPart {
  text?: string;
}
interface GroundingChunk {
  web?: { uri?: string; title?: string };
}

export async function researchTopic(
  query: string,
  minSources = 4,
): Promise<ResearchResult> {
  const key = await getDecryptedKey("gemini");
  if (!key) return { text: "", sources: [] };

  const prompt = `You are a news researcher. Using live web search, find the most CURRENT, verified facts about: "${query}".

Cross-check across at least ${minSources} reputable sources. Return ONLY concrete facts as short bullet points — real dates, numbers, prices, names, companies, job titles, locations, events and direct quotes. Prefer the latest developments. Every bullet must be a specific fact you found in the sources (not a general statement, not an opinion, not filler). If you are unsure of a detail, leave it out. Do NOT write an article — just the fact list.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${RESEARCH_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      },
    );
    if (!res.ok) return { text: "", sources: [] };
    const data = await res.json();

    const candidate = data.candidates?.[0];
    const text: string = (candidate?.content?.parts ?? [])
      .map((p: GeminiPart) => p.text ?? "")
      .join("")
      .trim();

    const chunks: GroundingChunk[] = candidate?.groundingMetadata?.groundingChunks ?? [];
    const seen = new Set<string>();
    const sources: Candidate[] = [];
    for (const c of chunks) {
      const uri = c.web?.uri;
      if (uri && !seen.has(uri)) {
        seen.add(uri);
        const title = c.web?.title ?? "source";
        sources.push({ title, link: uri, source: title });
      }
    }

    return { text, sources: sources.slice(0, 8) };
  } catch {
    return { text: "", sources: [] };
  } finally {
    clearTimeout(timer);
  }
}
