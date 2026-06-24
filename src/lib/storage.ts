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
