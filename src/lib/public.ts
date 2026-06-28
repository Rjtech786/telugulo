import { createClient } from "@supabase/supabase-js";

/**
 * Public read-only data for the blog. Uses the anon key, so RLS guarantees
 * only published articles / authors / active ads are ever returned — drafts
 * can never leak to the public site.
 */
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export type PublicArticle = {
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
  published_at: string | null;
  created_at: string;
  updated_at?: string | null;
  views: number;
};

export type PublicAuthor = {
  id: string;
  name: string;
  slug: string | null;
  bio: string | null;
  avatar: string | null;
  social: Record<string, string> | null;
};

const LIST_COLS =
  "id, slug, title, summary, category, image_url, published_at, created_at";

export async function listPublished(limit = 30): Promise<PublicArticle[]> {
  const { data } = await publicClient()
    .from("articles")
    .select(LIST_COLS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data as PublicArticle[]) ?? [];
}

export async function listTrending(limit = 6): Promise<PublicArticle[]> {
  const { data } = await publicClient()
    .from("articles")
    .select(
      "id, slug, title, summary, category, image_url, published_at, created_at, views",
    )
    .eq("status", "published")
    .order("views", { ascending: false })
    .limit(limit);
  return (data as PublicArticle[]) ?? [];
}

export async function listByCategory(category: string, limit = 30) {
  const { data } = await publicClient()
    .from("articles")
    .select(LIST_COLS)
    .eq("status", "published")
    .eq("category", category)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data as PublicArticle[]) ?? [];
}

export async function getPublishedBySlug(
  slug: string,
): Promise<PublicArticle | null> {
  const { data } = await publicClient()
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as PublicArticle) ?? null;
}

export async function getAuthor(id: string): Promise<PublicAuthor | null> {
  const { data } = await publicClient()
    .from("authors")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as PublicAuthor) ?? null;
}

export async function getAuthorBySlug(slug: string): Promise<PublicAuthor | null> {
  const { data } = await publicClient()
    .from("authors")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as PublicAuthor) ?? null;
}

export async function listByAuthor(authorId: string, limit = 30) {
  const { data } = await publicClient()
    .from("articles")
    .select(LIST_COLS)
    .eq("status", "published")
    .eq("author_id", authorId)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data as PublicArticle[]) ?? [];
}
