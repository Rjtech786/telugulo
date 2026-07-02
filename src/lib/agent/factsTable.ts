import "server-only";
import { researchTopic } from "./research";
import { fetchArticleText } from "./sources";
import { runAgentStep } from "./agentConfigs";
import { isBlacklistedUrl } from "./validators";
import { factsExtractPrompt, SYSTEM_EDITOR } from "./prompts";

/**
 * V3 Researcher output — the FACTS TABLE, the single source of truth for the
 * Writer and Fact Checker. If a number/date/name is not in here, it does not
 * exist for this pipeline (spec §3).
 */

export type Fact = { fact: string; source_url: string; confidence: "direct_quote" | "stated" | "inferred" };
export type Quote = { quote_original: string; speaker: string; source_url: string };
export type FactsSource = { domain: string; url: string; title: string };

export type FactsTable = {
  topic: string;
  facts: Fact[];
  quotes: Quote[];
  sources: FactsSource[];
  india_angle: { exists: boolean; detail: string };
};

/** Follow redirects server-side to the final publisher URL (spec §3). */
export async function resolveRedirectUrl(url: string): Promise<string | null> {
  if (!isBlacklistedUrl(url)) return url;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (telugulo-bot)" },
    });
    const finalUrl = res.url;
    if (finalUrl && !isBlacklistedUrl(finalUrl)) return finalUrl;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 60);
  }
}

function parseJson<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return JSON.parse(s) as T;
}

/**
 * Build the facts table: live web research (Gemini grounding) + primary
 * source → resolve redirect URLs → LLM-structure into strict facts JSON.
 */
export async function buildFactsTable(
  topic: string,
  minSources: number,
  primary?: { link: string; source: string },
): Promise<{ table: FactsTable; rawText: string } | null> {
  const web = await researchTopic(topic, Math.max(3, minSources));
  const primaryText = primary ? await fetchArticleText(primary.link, 6000) : "";
  if (!web.text && !primaryText) return null;

  // Resolve redirect URLs to real publisher URLs; drop unresolvable ones.
  const resolvedSources: FactsSource[] = [];
  for (const s of web.sources.slice(0, 8)) {
    const finalUrl = await resolveRedirectUrl(s.link);
    if (finalUrl) {
      resolvedSources.push({ domain: domainOf(finalUrl), url: finalUrl, title: s.title });
    }
  }
  if (primary && !isBlacklistedUrl(primary.link)) {
    resolvedSources.push({ domain: domainOf(primary.link), url: primary.link, title: primary.source });
  }
  const dedup = [...new Map(resolvedSources.map((s) => [s.url, s])).values()];

  const rawText = [
    web.text ? `RESEARCHED FACTS (live web search):\n${web.text}` : "",
    primaryText ? `PRIMARY SOURCE (${primary?.source}):\n${primaryText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  try {
    const res = await runAgentStep("researcher", "facts_extract", {
      system: SYSTEM_EDITOR,
      prompt: factsExtractPrompt(topic, rawText, dedup),
      maxTokens: 3000,
      temperature: 0.1,
    });
    const table = parseJson<FactsTable>(res.text);
    table.topic = topic;
    table.sources = dedup.length ? dedup : table.sources ?? [];
    table.facts = (table.facts ?? []).filter((f) => f.fact?.trim());
    table.quotes = table.quotes ?? [];
    table.india_angle = table.india_angle ?? { exists: false, detail: "" };
    return { table, rawText };
  } catch {
    // Structuring failed — fall back to a minimal table so the run can
    // continue (Writer still gets rawText via renderFactsForPrompt).
    return {
      table: {
        topic,
        facts: [],
        quotes: [],
        sources: dedup,
        india_angle: { exists: false, detail: "" },
      },
      rawText,
    };
  }
}

/** Render the facts table as the Writer/reviewer prompt block. */
export function renderFactsForPrompt(t: FactsTable, rawFallback?: string): string {
  if (t.facts.length === 0 && rawFallback) {
    return `SOURCES (use ONLY facts from this research):\n${rawFallback}`;
  }
  const facts = t.facts.map((f, i) => `${i + 1}. ${f.fact} [${f.source_url}] (${f.confidence})`).join("\n");
  const quotes = t.quotes.length
    ? `\n\nQUOTES:\n${t.quotes.map((q) => `- "${q.quote_original}" — ${q.speaker} [${q.source_url}]`).join("\n")}`
    : "";
  const india = t.india_angle.exists
    ? `\n\nINDIA ANGLE (genuine, from sources): ${t.india_angle.detail}`
    : "\n\nINDIA ANGLE: none in sources — do NOT fabricate one.";
  return `FACTS TABLE (the ONLY allowed facts — nothing outside this exists):\n${facts}${quotes}${india}`;
}

/** Proper-noun entities from the facts table (for the ending validator). */
export function factEntities(t: FactsTable): string[] {
  const text = [...t.facts.map((f) => f.fact), ...t.quotes.map((q) => q.speaker)].join(" ");
  const m = text.match(/\b[A-Z][a-zA-Z0-9]{2,}\b/g) ?? [];
  return [...new Set(m)].slice(0, 40);
}
