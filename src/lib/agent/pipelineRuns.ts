import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * V3 structured pipeline log: one `pipeline_runs` row per run, with per-stage
 * logs, the facts table, reviewer scores, hard-validator results and a
 * failure report. Complements agent_runs/agent_messages (live animation).
 */

export type StageLog = {
  stage: string;
  summary: string;
  ms?: number;
  word_count?: number;
  output_tokens?: number;
};

export type FinalStatus =
  | "published"
  | "draft_failed"
  | "skipped_duplicate"
  | "skipped_off_niche"
  | "skipped"
  | "error";

export type PipelineRunRow = {
  id: string;
  article_id: string | null;
  trigger: string | null;
  stage_logs: StageLog[] | null;
  facts_table: unknown;
  reviewer_scores: { fact?: number; language?: number; discover?: number; loops?: number } | null;
  hard_validator_results: unknown;
  final_status: FinalStatus | null;
  failure_report: unknown;
  created_at: string;
};

export async function createPipelineRun(trigger: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pipeline_runs")
    .insert({ trigger })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updatePipelineRun(
  id: string,
  fields: Partial<Omit<PipelineRunRow, "id" | "created_at">>,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("pipeline_runs").update(fields).eq("id", id);
  if (error) console.error("pipelineRuns.update failed:", error.message);
}

export async function getRecentPipelineRuns(limit = 10): Promise<PipelineRunRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pipeline_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as PipelineRunRow[]) ?? [];
}
