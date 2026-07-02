import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Static/legal pages (About, Contact, Privacy, Terms, Disclaimer, Editorial
 * Policy) shown in the footer. DB-driven so Admin -> Pages can edit/delete
 * them. Read server-side via the admin client (same pattern as
 * getSiteSettings()) — no anon RLS policy needed.
 */
export type StaticPage = {
  id: string;
  slug: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export async function listPages(): Promise<StaticPage[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("pages").select("*").order("title");
  if (error) throw error;
  return (data as StaticPage[]) ?? [];
}

export async function getPage(id: string): Promise<StaticPage | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("pages").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as StaticPage) ?? null;
}

export async function getPageBySlug(slug: string): Promise<StaticPage | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("pages").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as StaticPage) ?? null;
}

/** Title + content are editable; the slug is fixed (it's tied to a real route). */
export async function updatePage(id: string, fields: { title: string; content: string }): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("pages").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deletePage(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("pages").delete().eq("id", id);
  if (error) throw error;
}
