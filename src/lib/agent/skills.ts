import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SkillNote = {
  id: string;
  problem_type: string;
  solution_note: string;
  times_used: number;
  created_at: string;
};

/** Add a reusable skill note to the agent's learning memory. */
export async function addSkillNote(problemType: string, solutionNote: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("skill_notes")
    .insert({ problem_type: problemType.trim(), solution_note: solutionNote.trim() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function listSkillNotes(limit = 50): Promise<SkillNote[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("skill_notes")
    .select("id, problem_type, solution_note, times_used, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as SkillNote[]) ?? [];
}

/** Solution-note texts to inject into the writing prompt (most recent first). */
export async function getSkillNoteTexts(limit = 8): Promise<string[]> {
  const notes = await listSkillNotes(limit);
  return notes.map((n) => `${n.problem_type}: ${n.solution_note}`);
}
