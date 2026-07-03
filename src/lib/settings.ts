import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PIPELINE_STEPS,
  FEATURES,
  DEFAULT_GENERAL,
  DEFAULT_COST,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_RESEARCH,
  DEFAULT_QUALITY,
  DEFAULT_ADS_SETTINGS,
  SOCIAL_KEYS,
  SETTINGS_KEYS,
  type StepKey,
  type TextProvider,
  type ImageProvider,
  type FeatureKey,
  type GeneralSettings,
  type CostSettings,
  type Integrations,
  type SiteSettings,
  type ResearchSettings,
  type QualityRules,
  type AdsSettings,
} from "@/lib/config";
import { WRITING_RULES } from "@/lib/agent/prompts";

/**
 * Dashboard settings storage (the `settings` table, key/jsonb). SERVER ONLY.
 * Each config group is one row keyed by SETTINGS_KEYS.*.
 */

export type ModelChoice = { provider: TextProvider; model: string };
export type ModelMap = Record<StepKey, ModelChoice>;

async function readSetting<T>(key: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

/**
 * Agent writing instructions — DB-driven so the MCP server (and future UI) can
 * change how every article is written. Falls back to the built-in WRITING_RULES.
 */
export async function getAgentInstructions(): Promise<string> {
  const saved = await readSetting<string>(SETTINGS_KEYS.agentInstructions);
  return saved && saved.trim() ? saved : WRITING_RULES;
}

export async function setAgentInstructions(text: string): Promise<void> {
  await writeSetting(SETTINGS_KEYS.agentInstructions, text.trim());
}

/** Whether custom instructions are set (vs the built-in default). */
export async function hasCustomAgentInstructions(): Promise<boolean> {
  const saved = await readSetting<string>(SETTINGS_KEYS.agentInstructions);
  return Boolean(saved && saved.trim());
}

/** Research settings — how many sources the agent reads + depth. */
export async function getResearchSettings(): Promise<ResearchSettings> {
  const saved = (await readSetting<Partial<ResearchSettings>>(SETTINGS_KEYS.research)) ?? {};
  return {
    min_sources: Math.min(8, Math.max(1, Number(saved.min_sources) || DEFAULT_RESEARCH.min_sources)),
    depth: saved.depth === "basic" ? "basic" : DEFAULT_RESEARCH.depth,
  };
}

export async function setResearchSettings(input: Partial<ResearchSettings>): Promise<ResearchSettings> {
  const current = await getResearchSettings();
  const next: ResearchSettings = {
    min_sources:
      input.min_sources != null
        ? Math.min(8, Math.max(1, Number(input.min_sources)))
        : current.min_sources,
    depth: input.depth === "basic" || input.depth === "deep" ? input.depth : current.depth,
  };
  await writeSetting(SETTINGS_KEYS.research, next);
  return next;
}

/** Quality rules — enforced in the writing + self-check steps. */
export async function getQualityRules(): Promise<QualityRules> {
  const saved = (await readSetting<Partial<QualityRules>>(SETTINGS_KEYS.quality)) ?? {};
  return { ...DEFAULT_QUALITY, ...saved };
}

export async function setQualityRules(input: Partial<QualityRules>): Promise<QualityRules> {
  const current = await getQualityRules();
  const next: QualityRules = {
    min_words: clampWords(input.min_words, current.min_words),
    max_words: clampWords(input.max_words, current.max_words),
    facts_only: bool(input.facts_only, current.facts_only),
    require_local_angle: bool(input.require_local_angle, current.require_local_angle),
    ban_ai_slop: bool(input.ban_ai_slop, current.ban_ai_slop),
    self_check: bool(input.self_check, current.self_check),
  };
  if (next.max_words < next.min_words) next.max_words = next.min_words + 100;
  await writeSetting(SETTINGS_KEYS.quality, next);
  return next;
}

function clampWords(v: unknown, fallback: number): number {
  if (v == null) return fallback;
  return Math.min(2000, Math.max(300, Number(v) || fallback));
}
function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

/** Per-step model map, filled with spec defaults for any missing step. */
export async function getModelMap(): Promise<ModelMap> {
  const saved = (await readSetting<Partial<ModelMap>>(SETTINGS_KEYS.models)) ?? {};
  const map = {} as ModelMap;
  for (const step of PIPELINE_STEPS) {
    map[step.key] = saved[step.key] ?? {
      provider: step.defaultProvider,
      model: step.defaultModel,
    };
  }
  return map;
}

export async function getImageProvider(): Promise<ImageProvider> {
  return (await readSetting<ImageProvider>(SETTINGS_KEYS.imageProvider)) ?? "imagen";
}

/** Feature toggles, defaulted from config. */
export async function getFeatures(): Promise<Record<FeatureKey, boolean>> {
  const saved =
    (await readSetting<Partial<Record<FeatureKey, boolean>>>(
      SETTINGS_KEYS.features,
    )) ?? {};
  const result = {} as Record<FeatureKey, boolean>;
  for (const f of FEATURES) {
    result[f.key] = saved[f.key] ?? f.default;
  }
  return result;
}

export async function getGeneral(): Promise<GeneralSettings> {
  const saved = (await readSetting<Partial<GeneralSettings>>(
    SETTINGS_KEYS.general,
  )) ?? {};
  return { ...DEFAULT_GENERAL, ...saved };
}

export async function getCost(): Promise<CostSettings> {
  const saved = (await readSetting<Partial<CostSettings>>(
    SETTINGS_KEYS.cost,
  )) ?? {};
  return { ...DEFAULT_COST, ...saved };
}

/** Ads settings — currently just the popup delay (owner-configurable). */
export async function getAdsSettings(): Promise<AdsSettings> {
  const saved = (await readSetting<Partial<AdsSettings>>(SETTINGS_KEYS.ads)) ?? {};
  const delay = Number(saved.popup_delay_seconds);
  return {
    popup_delay_seconds: Number.isFinite(delay)
      ? Math.min(120, Math.max(0, delay))
      : DEFAULT_ADS_SETTINGS.popup_delay_seconds,
  };
}

export async function setAdsSettings(input: Partial<AdsSettings>): Promise<AdsSettings> {
  const current = await getAdsSettings();
  const next: AdsSettings = {
    popup_delay_seconds:
      input.popup_delay_seconds != null
        ? Math.min(120, Math.max(0, Number(input.popup_delay_seconds)))
        : current.popup_delay_seconds,
  };
  await writeSetting(SETTINGS_KEYS.ads, next);
  return next;
}

/** Last-run tracking for the weekly/monthly Performance agent job. */
export type PerformanceState = { last_run_at: string | null };

export async function getPerformanceState(): Promise<PerformanceState> {
  const saved = await readSetting<PerformanceState>(SETTINGS_KEYS.performanceState);
  return saved ?? { last_run_at: null };
}

export async function setPerformanceLastRun(iso: string): Promise<void> {
  await writeSetting(SETTINGS_KEYS.performanceState, { last_run_at: iso });
}

/**
 * Public site settings (name, tagline, description, footer, social links).
 * Merged over code defaults; empty social URLs are simply not rendered.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const saved = (await readSetting<Partial<SiteSettings>>(SETTINGS_KEYS.site)) ?? {};
  const socials = { ...DEFAULT_SITE_SETTINGS.socials };
  for (const k of SOCIAL_KEYS) {
    const v = saved.socials?.[k];
    if (typeof v === "string") socials[k] = v.trim();
  }
  return {
    name: saved.name?.trim() || DEFAULT_SITE_SETTINGS.name,
    tagline: saved.tagline?.trim() || DEFAULT_SITE_SETTINGS.tagline,
    description: saved.description?.trim() || DEFAULT_SITE_SETTINGS.description,
    footer_about: saved.footer_about?.trim() || DEFAULT_SITE_SETTINGS.footer_about,
    socials,
  };
}

/** Social links as a render-ready array (empty URLs dropped). */
export function socialsArray(s: SiteSettings): { name: string; href: string }[] {
  return SOCIAL_KEYS.map((k) => ({ name: k, href: s.socials[k] })).filter(
    (x) => x.href,
  );
}

/**
 * Site integrations (GA4 / Search Console / AdSense / custom head code).
 * Falls back to env vars for GA/GSC so existing setups keep working.
 */
export async function getIntegrations(): Promise<Integrations> {
  const saved =
    (await readSetting<Partial<Integrations>>(SETTINGS_KEYS.integrations)) ?? {};
  return {
    ga_id: saved.ga_id || process.env.NEXT_PUBLIC_GA_ID || "",
    gsc_verification:
      saved.gsc_verification || process.env.NEXT_PUBLIC_GSC_VERIFICATION || "",
    adsense_id: saved.adsense_id || "",
    head_html: saved.head_html || "",
  };
}
