"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  runPipeline,
  generateArticleForTopic,
  type PipelineResult,
} from "@/lib/agent/pipeline";

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

/** Run the full agent on today's trending topics (RSS discovery → draft). */
export async function runTrendingAgent(): Promise<PipelineResult> {
  await requireAdmin();
  const result = await runPipeline();
  revalidatePath("/admin/articles");
  return result;
}
