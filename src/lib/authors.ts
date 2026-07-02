import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Author = {
  id: string;
  name: string;
  slug: string | null;
  bio: string | null;
  avatar: string | null;
  social: Record<string, string> | null;
  created_at: string;
};

export async function listAuthors(): Promise<Author[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("authors").select("*").order("created_at");
  if (error) throw error;
  return (data as Author[]) ?? [];
}

export async function getAuthor(id: string): Promise<Author | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("authors").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Author) ?? null;
}

/** Number of articles per author, keyed by author_id (for the admin list). */
export async function countArticlesByAuthor(): Promise<Record<string, number>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("articles").select("author_id");
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.author_id as string | null;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** True if another author already uses this slug. */
export async function isAuthorSlugTaken(slug: string, exceptId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("authors")
    .select("id")
    .eq("slug", slug)
    .neq("id", exceptId)
    .maybeSingle();
  return Boolean(data);
}

/** Create a blank author (manual authoring); returns its id. */
export async function createAuthor(): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("authors")
    .insert({ name: "New author" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateAuthor(
  id: string,
  fields: Partial<Pick<Author, "name" | "slug" | "bio" | "avatar">>,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("authors").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteAuthor(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("authors").delete().eq("id", id);
  if (error) throw error;
}
