"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  publishArticle,
  unpublishArticle,
  deleteArticle,
  updateArticle,
  getArticle,
} from "@/lib/articles";
import { runPipeline, type PipelineResult } from "@/lib/agent/pipeline";
import { uploadArticleImage } from "@/lib/storage";
import { runImage } from "@/lib/ai";
import { imagePrompt } from "@/lib/agent/prompts";

export async function generateNow(): Promise<PipelineResult> {
  await requireAdmin();
  const result = await runPipeline();
  revalidatePath("/admin/articles");
  return result;
}

export async function publish(id: string) {
  await requireAdmin();
  await publishArticle(id);
  revalidatePath("/admin/articles");
  revalidatePath("/");
}

export async function unpublish(id: string) {
  await requireAdmin();
  await unpublishArticle(id);
  revalidatePath("/admin/articles");
  revalidatePath("/");
}

export async function remove(id: string) {
  await requireAdmin();
  await deleteArticle(id);
  revalidatePath("/admin/articles");
}

export async function saveArticle(
  id: string,
  fields: {
    title: string;
    title_meta: string;
    meta_description: string;
    summary: string;
    body: string;
    category: string;
  },
) {
  await requireAdmin();
  await updateArticle(id, fields);
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${id}`);
  return { ok: true };
}

// ─── Featured image ───

function revalidateArticle(id: string, slug?: string) {
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath("/");
  if (slug) revalidatePath(`/${slug}`);
}

/** Upload a featured image file to Supabase Storage and attach it. */
export async function uploadFeaturedImage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || id);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file selected");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image too large (max 10MB)");

  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await uploadArticleImage(bytes, file.type, slug);
  await updateArticle(id, { image_url: url });
  revalidateArticle(id, slug);
  return { ok: true, url };
}

/** Set the featured image from a pasted URL. */
export async function setFeaturedImageUrl(id: string, url: string) {
  await requireAdmin();
  const u = url.trim();
  if (u && !/^https?:\/\//i.test(u)) throw new Error("Enter a valid http(s) image URL");
  await updateArticle(id, { image_url: u || null });
  revalidateArticle(id);
  return { ok: true, url: u || null };
}

/** Generate a featured image with the configured AI image provider. */
export async function generateFeaturedImage(id: string) {
  await requireAdmin();
  const article = await getArticle(id);
  if (!article) throw new Error("Article not found");
  const img = await runImage(imagePrompt(article.title, article.category || "tech"));
  const url = await uploadArticleImage(img.bytes, img.contentType, article.slug);
  await updateArticle(id, { image_url: url });
  revalidateArticle(id, article.slug);
  return { ok: true, url };
}

export async function removeFeaturedImage(id: string) {
  await requireAdmin();
  await updateArticle(id, { image_url: null });
  revalidateArticle(id);
  return { ok: true, url: null };
}
