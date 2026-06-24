import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PIPELINE_STEPS,
  FEATURES,
  DEFAULT_GENERAL,
  DEFAULT_COST,
  SETTINGS_KEYS,
  type StepKey,
  type TextProvider,
  type ImageProvider,
  type FeatureKey,
  type GeneralSettings,
  type CostSettings,
  type Integrations,
} from "@/lib/config";

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
