import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Article = {
  id: string;
  slug: string;
  title: string;
  title_meta: string | null;
  meta_description: string | null;
  body: string | null;
  summary: string | null;
  category: string | null;
  image_url: string | null;
  author_id: string | null;
  source_urls: { title?: string; url?: string; source?: string }[] | null;
  status: "draft" | "published";
  views: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export async function listArticles(status?: "draft" | "published") {
  const supabase = createAdminClient();
  let q = supabase
    .from("articles")
    .select("id, slug, title, summary, category, image_url, status, views, created_at, published_at")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getArticle(id: string): Promise<Article | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Article | null;
}

export async function publishArticle(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("articles")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function unpublishArticle(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("articles")
    .update({ status: "draft", published_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function updateArticle(
  id: string,
  fields: Partial<
    Pick<
      Article,
      "title" | "title_meta" | "meta_description" | "summary" | "body" | "category" | "image_url"
    >
  >,
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("articles").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteArticle(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw error;
}

/** Increment view count + log a timestamped event (best-effort, public pages). */
export async function incrementViews(id: string) {
  const supabase = createAdminClient();
  await Promise.all([
    supabase.rpc("increment_article_views", { article_id: id }),
    supabase.from("page_views").insert({ article_id: id }),
  ]);
}
