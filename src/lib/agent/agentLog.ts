import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * CEO multi-agent system — run + message log. Every daily/manual pipeline run
 * creates one `agent_runs` row and a timeline of `agent_messages` (CEO <->
 * specialist agent signals). Powers the animated master/slave view in
 * Admin -> AI Agent.
 */

export type AgentId =
  | "ceo"
  | "topic_scout"
  | "researcher"
  | "writer"
  | "quality"
  | "seo"
  | "image"
  // V3 Verify Mode agents
  | "fact_checker"
  | "language_editor"
  | "discover_checker"
  | "fixer";

export type MsgDirection = "ceo_to_agent" | "agent_to_ceo";
export type MsgStatus = "working" | "done" | "fixed" | "failed";
export type RunStatus = "running" | "created" | "skipped" | "error" | "draft";
export type RunTrigger = "cron" | "manual";

export type AgentRun = {
  id: string;
  trigger: RunTrigger;
  status: RunStatus;
  article_id: string | null;
  article_title: string | null;
  reason: string | null;
  started_at: string;
  finished_at: string | null;
};

export type AgentMessage = {
  id: string;
  run_id: string;
  agent: AgentId;
  direction: MsgDirection;
  status: MsgStatus;
  message: string;
  detail: string | null;
  created_at: string;
};

export async function createRun(trigger: RunTrigger): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({ trigger, status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function logMessage(input: {
  runId: string;
  agent: AgentId;
  direction: MsgDirection;
  status: MsgStatus;
  message: string;
  detail?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("agent_messages").insert({
    run_id: input.runId,
    agent: input.agent,
    direction: input.direction,
    status: input.status,
    message: input.message,
    detail: input.detail ?? null,
  });
  // Logging must never break the pipeline — swallow errors.
  if (error) console.error("agentLog.logMessage failed:", error.message);
}

export async function finishRun(
  runId: string,
  status: RunStatus,
  opts: { articleId?: string; articleTitle?: string; reason?: string } = {},
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("agent_runs")
    .update({
      status,
      article_id: opts.articleId ?? null,
      article_title: opts.articleTitle ?? null,
      reason: opts.reason ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) console.error("agentLog.finishRun failed:", error.message);
}

export async function getActiveRun(): Promise<AgentRun | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as AgentRun) ?? null;
}

export async function getRecentRuns(limit = 10): Promise<AgentRun[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as AgentRun[]) ?? [];
}

export async function getRunMessages(runId: string): Promise<AgentMessage[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as AgentMessage[]) ?? [];
}

export async function getRun(runId: string): Promise<AgentRun | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  return (data as AgentRun) ?? null;
}
