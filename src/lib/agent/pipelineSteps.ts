import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PipelineStep = {
  id: string;
  step_order: number;
  agent_key: string;
  depends_on: string[];
  is_blocking: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  agent_registry?: {
    display_name: string;
    instructions: string;
    model_tier: string;
    enabled: boolean;
    input_schema?: any;
    output_schema?: any;
  } | null;
};

export async function listPipelineSteps(): Promise<PipelineStep[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pipeline_steps")
    .select("*, agent_registry:agent_registry(*)")
    .order("step_order", { ascending: true });
  if (error) throw error;
  return (data as PipelineStep[]) ?? [];
}

export async function updatePipelineStep(
  agentKey: string,
  fields: Partial<Pick<PipelineStep, "step_order" | "depends_on" | "is_blocking" | "enabled">>,
): Promise<void> {
  if (agentKey === "fact_checker") {
    if (fields.is_blocking === false) {
      throw new Error("fact_checker must always remain a blocking gate.");
    }
    if (fields.enabled === false) {
      throw new Error("fact_checker cannot be disabled.");
    }
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pipeline_steps")
    .update(fields)
    .eq("agent_key", agentKey);
  if (error) throw error;
}

export async function addAgent(args: {
  agent_key: string;
  display_name: string;
  instructions: string;
  model_tier?: "cheap" | "mid" | "best";
  insert_after: string;
  is_blocking?: boolean;
}): Promise<void> {
  const supabase = createAdminClient();

  // 1. Insert into agent_registry
  const { error: regError } = await supabase
    .from("agent_registry")
    .insert({
      agent_key: args.agent_key,
      display_name: args.display_name,
      instructions: args.instructions,
      model_tier: args.model_tier ?? "mid",
      enabled: true,
    });
  if (regError) throw regError;

  // 2. Calculate step_order dynamically
  const steps = await listPipelineSteps();
  const insertAfterStep = steps.find((s) => s.agent_key === args.insert_after);
  
  let newOrder = 1;
  let dependsOn: string[] = [];

  if (insertAfterStep) {
    const order1 = insertAfterStep.step_order;
    dependsOn = [args.insert_after];

    // Find next highest step_order
    const nextStep = steps.find((s) => s.step_order > order1);
    if (nextStep) {
      newOrder = (order1 + nextStep.step_order) / 2;
    } else {
      newOrder = order1 + 1;
    }
  } else {
    // Default: put at end
    const maxStep = steps.reduce((max, s) => (s.step_order > max ? s.step_order : max), 0);
    newOrder = maxStep + 1;
  }

  // 3. Insert into pipeline_steps
  const { error: stepError } = await supabase
    .from("pipeline_steps")
    .insert({
      agent_key: args.agent_key,
      step_order: newOrder,
      depends_on: dependsOn,
      is_blocking: args.is_blocking ?? false,
      enabled: true,
    });
  if (stepError) {
    // Rollback registry insertion
    await supabase.from("agent_registry").delete().eq("agent_key", args.agent_key);
    throw stepError;
  }
}

export async function removeAgent(agentKey: string): Promise<void> {
  if (agentKey === "fact_checker") {
    throw new Error("fact_checker cannot be removed or disabled.");
  }
  const supabase = createAdminClient();
  
  // Soft-delete: disable in both tables
  const { error: stepErr } = await supabase
    .from("pipeline_steps")
    .update({ enabled: false })
    .eq("agent_key", agentKey);
  if (stepErr) throw stepErr;

  const { error: regErr } = await supabase
    .from("agent_registry")
    .update({ enabled: false })
    .eq("agent_key", agentKey);
  if (regErr) throw regErr;
}

export async function reorderPipeline(
  steps: { agent_key: string; step_order: number; depends_on: string[]; is_blocking?: boolean }[],
): Promise<void> {
  const fc = steps.find((s) => s.agent_key === "fact_checker");
  if (!fc) {
    throw new Error("fact_checker must be included in the pipeline flow.");
  }
  if (fc.is_blocking === false) {
    throw new Error("fact_checker must remain a blocking gate (is_blocking=true).");
  }

  const supabase = createAdminClient();

  // 1. Delete all current steps
  const { error: delError } = await supabase
    .from("pipeline_steps")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Deletes all rows safely
  if (delError) throw delError;

  // 2. Insert new configurations
  const { error: insError } = await supabase
    .from("pipeline_steps")
    .insert(
      steps.map((s) => ({
        agent_key: s.agent_key,
        step_order: s.step_order,
        depends_on: s.depends_on,
        is_blocking: s.agent_key === "fact_checker" ? true : (s.is_blocking ?? true),
        enabled: true,
      })),
    );
  if (insError) throw insError;
}
