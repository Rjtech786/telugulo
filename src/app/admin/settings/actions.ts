"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { writeSetting, type ModelMap } from "@/lib/settings";
import {
  SETTINGS_KEYS,
  PIPELINE_STEPS,
  FEATURES,
  type FeatureKey,
  type ImageProvider,
  type GeneralSettings,
  type CostSettings,
} from "@/lib/config";

const STEP_KEYS = new Set(PIPELINE_STEPS.map((s) => s.key));
const FEATURE_KEYS = new Set(FEATURES.map((f) => f.key));

export async function saveModels(map: ModelMap, imageProvider: ImageProvider) {
  await requireAdmin();
  // Keep only known steps.
  const clean = {} as ModelMap;
  for (const step of PIPELINE_STEPS) {
    const choice = map[step.key];
    if (choice && STEP_KEYS.has(step.key)) clean[step.key] = choice;
  }
  await writeSetting(SETTINGS_KEYS.models, clean);
  await writeSetting(SETTINGS_KEYS.imageProvider, imageProvider);
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function saveFeatures(features: Record<FeatureKey, boolean>) {
  await requireAdmin();
  const clean: Record<string, boolean> = {};
  for (const f of FEATURES) {
    if (FEATURE_KEYS.has(f.key)) clean[f.key] = Boolean(features[f.key]);
  }
  await writeSetting(SETTINGS_KEYS.features, clean);
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function saveGeneral(general: GeneralSettings) {
  await requireAdmin();
  const clean: GeneralSettings = {
    articles_per_day: general.articles_per_day === 2 ? 2 : 1,
    tone: ["friendly", "professional", "casual"].includes(general.tone)
      ? general.tone
      : "friendly",
    article_length: Math.min(1500, Math.max(400, Number(general.article_length) || 900)),
    publish_time: /^\d{2}:\d{2}$/.test(general.publish_time)
      ? general.publish_time
      : "08:00",
    auto_publish: Boolean(general.auto_publish),
  };
  await writeSetting(SETTINGS_KEYS.general, clean);
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function saveCost(cost: CostSettings) {
  await requireAdmin();
  const clean: CostSettings = {
    monthly_budget: Math.max(0, Number(cost.monthly_budget) || 500),
    learning_examples_limit: Math.min(
      10,
      Math.max(0, Number(cost.learning_examples_limit) || 3),
    ),
    performance_frequency:
      cost.performance_frequency === "monthly" ? "monthly" : "weekly",
  };
  await writeSetting(SETTINGS_KEYS.cost, clean);
  revalidatePath("/admin/settings");
  return { ok: true };
}
