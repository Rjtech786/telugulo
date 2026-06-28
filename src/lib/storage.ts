import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const ARTICLE_BUCKET = "article-images";

/**
 * Upload a generated featured image to Supabase Storage (NOT EC2 disk) and
 * return its public URL. Served as WebP downstream via next/image.
 */
export async function uploadArticleImage(
  bytes: Buffer,
  contentType: string,
  slug: string,
): Promise<string> {
  const supabase = createAdminClient();
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `${slug}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(ARTICLE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(ARTICLE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload an owner-provided ad image to Storage; returns its public URL. */
export async function storeAdImage(
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = createAdminClient();
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const path = `ads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(ARTICLE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(ARTICLE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
