"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  runPipeline,
  reverifyArticle,
  generateArticleForTopic,
  type PipelineResult,
} from "@/lib/agent/pipeline";
import {
  createRun,
  getActiveRun,
  getRecentRuns,
  getRunMessages,
  getRun,
  type AgentRun,
  type AgentMessage,
} from "@/lib/agent/agentLog";
import { getRecentPipelineRuns, type PipelineRunRow } from "@/lib/agent/pipelineRuns";
import {
  listAgentConfigs,
  updateAgentConfig,
  isAgentKey,
  type AgentConfig,
} from "@/lib/agent/agentConfigs";
import { getGeneral, writeSetting, getFeatures, getQualityRules, setQualityRules } from "@/lib/settings";
import { SETTINGS_KEYS, type ModelTier } from "@/lib/config";

import { listPipelineSteps, type PipelineStep } from "@/lib/agent/pipelineSteps";

export type SystemSettings = {
  systemOn: boolean; // features.article_generation
  publishTime: string; // "HH:MM" IST
  minWords: number;
  maxWords: number;
};

/** V3 mission-control panel data: agent configs + structured runs + settings. */
export async function getV3Panel(): Promise<{
  configs: AgentConfig[];
  pipelineRuns: PipelineRunRow[];
  autoPublish: boolean;
  system: SystemSettings;
  pipelineSteps: PipelineStep[];
}> {
  await requireAdmin();
  const [configs, pipelineRuns, general, features, quality, pipelineSteps] = await Promise.all([
    listAgentConfigs().catch(() => []),
    getRecentPipelineRuns(10).catch(() => []),
    getGeneral(),
    getFeatures(),
    getQualityRules(),
    listPipelineSteps().catch(() => []),
  ]);
  return {
    configs,
    pipelineRuns,
    autoPublish: general.auto_publish,
    system: {
      systemOn: features.article_generation,
      publishTime: general.publish_time,
      minWords: quality.min_words,
      maxWords: quality.max_words,
    },
    pipelineSteps,
  };
}

/** Save the newsroom system settings (on/off, daily run time, word range). */
export async function saveSystemSettings(input: SystemSettings): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (!/^\d{1,2}:\d{2}$/.test(input.publishTime)) throw new Error("Time HH:MM format me do (IST)");
  const [general, features] = await Promise.all([getGeneral(), getFeatures()]);
  await Promise.all([
    writeSetting(SETTINGS_KEYS.general, { ...general, publish_time: input.publishTime }),
    writeSetting(SETTINGS_KEYS.features, { ...features, article_generation: input.systemOn }),
    setQualityRules({ min_words: input.minWords, max_words: input.maxWords }),
  ]);
  return { ok: true };
}

/**
 * Re-verify a failed draft in the background (same pattern as startCeoRun) —
 * returns the run id so Mission Control can animate it live.
 */
export async function startReverify(articleId: string): Promise<{ runId: string }> {
  await requireAdmin();
  const runId = await createRun("manual");
  reverifyArticle(articleId, runId)
    .then(() => revalidatePath("/admin/articles"))
    .catch((e) => console.error("Re-verify failed:", e));
  return { runId };
}

/** Save one agent's instructions / tier / enabled from the side panel. */
export async function saveAgentConfigAction(
  agentKey: string,
  fields: { instructions?: string; model_tier?: string; enabled?: boolean },
): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (!isAgentKey(agentKey)) throw new Error("Unknown agent");
  const patch: { instructions?: string; model_tier?: ModelTier; enabled?: boolean } = {};
  if (fields.instructions !== undefined) patch.instructions = fields.instructions;
  if (fields.enabled !== undefined) patch.enabled = fields.enabled;
  if (fields.model_tier !== undefined) {
    if (!["cheap", "mid", "best"].includes(fields.model_tier)) throw new Error("Bad tier");
    patch.model_tier = fields.model_tier as ModelTier;
  }
  await updateAgentConfig(agentKey, patch);
  return { ok: true };
}

/** Global publish-gate pause (spec §6): auto-publish ON/OFF. */
export async function setAutoPublish(on: boolean): Promise<{ ok: boolean }> {
  await requireAdmin();
  const general = await getGeneral();
  await writeSetting(SETTINGS_KEYS.general, { ...general, auto_publish: on });
  return { ok: true };
}

export type TopicResult =
  | { ok: true; id: string; title: string; slug: string }
  | { ok: false; error: string };

/** On-demand: write a draft on a specific topic with the given options. */
export async function generateFromTopic(input: {
  topic: string;
  category: string;
  length_words: number;
  force_local_angle: boolean;
}): Promise<TopicResult> {
  await requireAdmin();
  const topic = input.topic.trim();
  if (!topic) return { ok: false, error: "Pehle topic likho." };
  try {
    const draft = await generateArticleForTopic(topic, {
      category: input.category || undefined,
      lengthWords: input.length_words || undefined,
      forceLocalAngle: input.force_local_angle,
    });
    revalidatePath("/admin/articles");
    return { ok: true, ...draft };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
}

/**
 * Kick off the CEO multi-agent pipeline in the background and return
 * immediately with a run id. The app runs as a persistent PM2/Node process on
 * EC2 (not serverless), so it's safe to keep working after this action
 * returns — the client polls `getCeoRunStatus` to animate progress live.
 */
export async function startCeoRun(): Promise<{ runId: string }> {
  await requireAdmin();
  const runId = await createRun("manual");
  runPipeline(runId, "manual")
    .then(() => revalidatePath("/admin/articles"))
    .catch((e) => console.error("CEO run failed:", e));
  return { runId };
}

/** Poll a specific run's live status + message timeline. */
export async function getCeoRunStatus(
  runId: string,
): Promise<{ run: AgentRun | null; messages: AgentMessage[] }> {
  await requireAdmin();
  const [run, messages] = await Promise.all([getRun(runId), getRunMessages(runId)]);
  return { run, messages };
}

/** Overview for the Admin -> AI Agent page: current/last run + recent history. */
export async function getCeoOverview(): Promise<{
  active: AgentRun | null;
  activeMessages: AgentMessage[];
  recent: AgentRun[];
}> {
  await requireAdmin();
  const active = await getActiveRun();
  const activeMessages = active ? await getRunMessages(active.id) : [];
  const recent = await getRecentRuns(8);
  return { active, activeMessages, recent };
}

/** Run the full agent on today's trending topics (RSS discovery → draft). */
export async function runTrendingAgent(): Promise<PipelineResult> {
  await requireAdmin();
  const result = await runPipeline(undefined, "manual");
  revalidatePath("/admin/articles");
  return result;
}
