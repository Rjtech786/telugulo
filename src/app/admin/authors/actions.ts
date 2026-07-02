"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createAuthor,
  updateAuthor,
  deleteAuthor,
  getAuthor,
  isAuthorSlugTaken,
} from "@/lib/authors";
import { sanitizeSlug } from "@/lib/agent/slug";
import { uploadArticleImage } from "@/lib/storage";

function revalidateAuthor(slug?: string | null) {
  revalidatePath("/admin/authors");
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/author/${slug}`);
}

/** Create a blank author to fill in; returns its id (for redirect). */
export async function createNewAuthor(): Promise<{ id: string }> {
  await requireAdmin();
  const id = await createAuthor();
  revalidatePath("/admin/authors");
  return { id };
}

export async function saveAuthor(
  id: string,
  fields: { name: string; slug: string; bio: string },
) {
  await requireAdmin();

  const name = fields.name.trim();
  if (!name) throw new Error("Name can't be empty.");

  const cleanSlug = sanitizeSlug(fields.slug);
  if (!cleanSlug) throw new Error("Enter a valid slug (letters, numbers, hyphens).");
  if (await isAuthorSlugTaken(cleanSlug, id)) {
    throw new Error(`Slug "${cleanSlug}" is already used by another author.`);
  }

  await updateAuthor(id, { name, slug: cleanSlug, bio: fields.bio.trim() });
  revalidateAuthor(cleanSlug);
  return { ok: true, slug: cleanSlug };
}

export async function removeAuthor(id: string) {
  await requireAdmin();
  const author = await getAuthor(id);
  await deleteAuthor(id);
  revalidateAuthor(author?.slug);
}

/** Upload an avatar photo file to Supabase Storage and attach it. */
export async function uploadAuthorAvatar(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file selected");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image too large (max 5MB)");

  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await uploadArticleImage(bytes, file.type, `author-${id}`);
  await updateAuthor(id, { avatar: url });
  const author = await getAuthor(id);
  revalidateAuthor(author?.slug);
  return { ok: true, url };
}

/** Set the avatar from a pasted image URL. */
export async function setAuthorAvatarUrl(id: string, url: string) {
  await requireAdmin();
  const u = url.trim();
  if (u && !/^https?:\/\//i.test(u)) throw new Error("Enter a valid http(s) image URL");
  await updateAuthor(id, { avatar: u || null });
  const author = await getAuthor(id);
  revalidateAuthor(author?.slug);
  return { ok: true, url: u || null };
}

export async function removeAuthorAvatar(id: string) {
  await requireAdmin();
  await updateAuthor(id, { avatar: null });
  const author = await getAuthor(id);
  revalidateAuthor(author?.slug);
  return { ok: true, url: null };
}
