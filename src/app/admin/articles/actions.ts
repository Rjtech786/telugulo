"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  publishArticle,
  unpublishArticle,
  deleteArticle,
  updateArticle,
} from "@/lib/articles";
import { runPipeline, type PipelineResult } from "@/lib/agent/pipeline";

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
