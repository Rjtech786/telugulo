"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createAd,
  setAdActive,
  deleteAd,
  composeAdCopy,
  type AdCopy,
} from "@/lib/ads";
import { storeAdImage } from "@/lib/storage";

/** Upload an ad image file → returns its public Storage URL. */
export async function uploadAdImage(formData: FormData): Promise<{ url: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file selected");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  if (file.size > 6 * 1024 * 1024) {
    throw new Error("Image too large (max 6 MB)");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await storeAdImage(bytes, file.type);
  return { url };
}

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** AI: turn image+link+keywords into ad copy (for the form preview). */
export async function generateAdCopy(input: {
  title: string;
  link: string;
  keywords: string;
}): Promise<AdCopy> {
  await requireAdmin();
  if (!input.link.trim()) throw new Error("Add a link first");
  return composeAdCopy({
    title: input.title.trim(),
    link: input.link.trim(),
    keywords: parseKeywords(input.keywords),
  });
}

export async function addAd(fields: {
  title: string;
  image_url: string;
  link: string;
  category: string;
  keywords: string;
  headline: string;
  description: string;
  cta: string;
}) {
  await requireAdmin();
  if (!fields.link.trim()) throw new Error("A link is required");

  const keywords = parseKeywords(fields.keywords);

  // If the owner didn't generate copy, let the AI compose it now.
  let copy: AdCopy = {
    headline: fields.headline.trim(),
    description: fields.description.trim(),
    cta: fields.cta.trim(),
  };
  if (!copy.headline) {
    copy = await composeAdCopy({ title: fields.title.trim(), link: fields.link.trim(), keywords });
  }

  await createAd({
    title: fields.title.trim() || copy.headline,
    image_url: fields.image_url.trim(),
    link: fields.link.trim(),
    category: fields.category.trim(),
    keywords,
    headline: copy.headline,
    description: copy.description,
    cta: copy.cta || "చూడండి",
  });
  revalidatePath("/admin/ads");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleAd(id: string, active: boolean) {
  await requireAdmin();
  await setAdActive(id, active);
  revalidatePath("/admin/ads");
  revalidatePath("/", "layout");
}

export async function removeAd(id: string) {
  await requireAdmin();
  await deleteAd(id);
  revalidatePath("/admin/ads");
  revalidatePath("/", "layout");
}
