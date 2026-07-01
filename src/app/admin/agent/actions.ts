"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  runPipeline,
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
