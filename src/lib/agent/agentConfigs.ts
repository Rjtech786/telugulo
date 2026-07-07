import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TEXT_MODELS,
  TIER_TO_MODEL_TIER,
  AGENT_KEYS,
  type AgentKey,
  type ModelTier,
  type StepKey,
} from "@/lib/config";
import { getModelMap } from "@/lib/settings";
import { runStepWithFallback, type StepResult } from "@/lib/ai";
import type { TextGenParams } from "@/lib/ai/text";

/**
 * V3 per-agent configuration (spec §11.5). Prompt assembly order for every
 * agent call: shared newsroom rules → agent_configs.instructions → skill
 * notes where agent_key IN ('all', <agent>). All editable via MCP + admin UI.
 */

export type AgentConfig = {
  agent_key: AgentKey;
  display_name: string | null;
  instructions: string | null;
  model_tier: ModelTier;
  enabled: boolean;
  updated_at: string;
};

export function isAgentKey(k: string): k is AgentKey {
  return typeof k === "string" && k.trim().length > 0;
}

export async function listAgentConfigs(): Promise<AgentConfig[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("agent_registry").select("*").order("agent_key");
  if (error) throw error;
  return (data as AgentConfig[]) ?? [];
}

export async function getAgentConfig(agentKey: AgentKey): Promise<AgentConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agent_registry")
    .select("*")
    .eq("agent_key", agentKey)
    .maybeSingle();
  if (error) throw error;
  return (data as AgentConfig) ?? null;
}

export async function updateAgentConfig(
  agentKey: AgentKey,
  fields: Partial<Pick<AgentConfig, "instructions" | "model_tier" | "enabled">>,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("agent_registry")
    .upsert({ agent_key: agentKey, ...fields }, { onConflict: "agent_key" });
  if (error) throw error;
}

/** Skill-note texts scoped to one agent ('all' + that agent's own notes). */
export async function getAgentSkillNotes(agentKey: AgentKey, limit = 8): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("skill_notes")
    .select("problem_type, solution_note, agent_key")
    .in("agent_key", ["all", agentKey])
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((n) => `${n.problem_type}: ${n.solution_note}`);
}

/**
 * Assemble the final system prompt for an agent:
 * shared rules + agent instructions + scoped skill notes.
 */
export function assembleAgentSystem(
  sharedRules: string,
  config: AgentConfig | null,
  skillNotes: string[],
): string {
  const parts = [sharedRules.trim()];
  if (config?.instructions?.trim()) {
    parts.push(`YOUR AGENT-SPECIFIC INSTRUCTIONS (${config.agent_key}):\n${config.instructions.trim()}`);
  }
  if (skillNotes.length) {
    parts.push(`LEARNED NOTES (apply these):\n${skillNotes.map((n) => `- ${n}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

/** Resolve the model override for an agent's tier, keeping the step's provider. */
export async function tierOverride(
  agentKey: AgentKey,
  step: StepKey,
  config?: AgentConfig | null,
): Promise<{ provider?: never; model?: string } | undefined> {
  const cfg = config === undefined ? await getAgentConfig(agentKey) : config;
  if (!cfg?.model_tier) return undefined;
  const map = await getModelMap();
  const provider = map[step].provider;
  const wanted = TIER_TO_MODEL_TIER[cfg.model_tier];
  const candidates = TEXT_MODELS[provider];
  const hit =
    candidates.find((m) => m.tier === wanted) ??
    // gemini has no "medium" — fall back to cheap for mid, quality for best
    candidates.find((m) => m.tier === (wanted === "medium" ? "cheap" : wanted)) ??
    null;
  return hit ? { model: hit.id } : undefined;
}

/**
 * Run one V3 agent step: loads config, applies tier override, and tags the
 * result. Caller handles `enabled=false` (skip semantics differ per agent).
 */
export async function runAgentStep(
  agentKey: AgentKey,
  step: StepKey,
  params: TextGenParams,
  config?: AgentConfig | null,
): Promise<StepResult> {
  const override = await tierOverride(agentKey, step, config);
  return runStepWithFallback(step, params, override);
}
