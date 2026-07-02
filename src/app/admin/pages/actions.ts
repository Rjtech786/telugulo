"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { updatePage, deletePage, getPage } from "@/lib/pages";

function revalidatePage(slug?: string) {
  revalidatePath("/admin/pages");
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/${slug}`);
}

export async function savePage(id: string, fields: { title: string; content: string }) {
  await requireAdmin();
  const title = fields.title.trim();
  if (!title) throw new Error("Title can't be empty.");
  await updatePage(id, { title, content: fields.content });
  const page = await getPage(id);
  revalidatePage(page?.slug);
  return { ok: true };
}

export async function removePage(id: string) {
  await requireAdmin();
  const page = await getPage(id);
  await deletePage(id);
  revalidatePage(page?.slug);
}
