"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAd, setAdActive, deleteAd } from "@/lib/ads";

export async function addAd(fields: {
  title: string;
  image_url: string;
  link: string;
  category: string;
}) {
  await requireAdmin();
  if (!fields.title.trim() || !fields.link.trim()) {
    throw new Error("Title and link are required");
  }
  await createAd({
    title: fields.title.trim(),
    image_url: fields.image_url.trim(),
    link: fields.link.trim(),
    category: fields.category.trim(),
  });
  revalidatePath("/admin/ads");
  return { ok: true };
}

export async function toggleAd(id: string, active: boolean) {
  await requireAdmin();
  await setAdActive(id, active);
  revalidatePath("/admin/ads");
}

export async function removeAd(id: string) {
  await requireAdmin();
  await deleteAd(id);
  revalidatePath("/admin/ads");
}
