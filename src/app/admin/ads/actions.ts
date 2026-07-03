"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createAd,
  updateAd,
  setAdActive,
  deleteAd,
  composeAdCopy,
  composeAdCopyVision,
  enhanceAdImage,
  getAdAnalytics,
  type AdCopy,
  type AdAnalytics,
} from "@/lib/ads";
import { storeAdImage } from "@/lib/storage";
import { getAdsSettings, setAdsSettings } from "@/lib/settings";
import type { AdType, AdsSettings } from "@/lib/config";

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

/** AI-enhance an already-uploaded image into a more attractive creative. */
export async function enhanceImage(url: string): Promise<{ url: string }> {
  await requireAdmin();
  const { bytes, contentType } = await enhanceAdImage(url);
  const newUrl = await storeAdImage(bytes, contentType);
  return { url: newUrl };
}

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** AI: turn image(s)+link+keywords into ad copy (for the form preview). */
export async function generateAdCopy(input: {
  title: string;
  link: string;
  keywords: string;
  images: string[];
}): Promise<AdCopy> {
  await requireAdmin();
  if (!input.link.trim()) throw new Error("Add a link first");
  const opts = { title: input.title.trim(), keywords: parseKeywords(input.keywords), link: input.link.trim() };
  return input.images.length > 0
    ? composeAdCopyVision({ ...opts, images: input.images })
    : composeAdCopy(opts);
}

export async function addAd(fields: {
  title: string;
  images: string[];
  type: AdType;
  link: string;
  category: string;
  keywords: string;
  headline: string;
  description: string;
  cta: string;
}) {
  await requireAdmin();
  if (!fields.link.trim()) throw new Error("A link is required");
  if (fields.images.length === 0) throw new Error("Add at least one image");

  const keywords = parseKeywords(fields.keywords);

  // If the owner didn't generate copy, let the AI compose it now.
  let copy: AdCopy = {
    headline: fields.headline.trim(),
    description: fields.description.trim(),
    cta: fields.cta.trim(),
  };
  if (!copy.headline) {
    copy = await composeAdCopyVision({
      title: fields.title.trim(),
      link: fields.link.trim(),
      keywords,
      images: fields.images,
    });
  }

  await createAd({
    title: fields.title.trim() || copy.headline,
    images: fields.images,
    type: fields.type,
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

export async function updateAdType(id: string, type: AdType) {
  await requireAdmin();
  await updateAd(id, { type });
  revalidatePath("/admin/ads");
  revalidatePath("/", "layout");
}

export async function getAdsAnalyticsAction(): Promise<AdAnalytics> {
  await requireAdmin();
  return getAdAnalytics(14);
}

export async function getAdsSettingsAction(): Promise<AdsSettings> {
  await requireAdmin();
  return getAdsSettings();
}

export async function saveAdsSettingsAction(input: AdsSettings): Promise<AdsSettings> {
  await requireAdmin();
  const next = await setAdsSettings(input);
  revalidatePath("/", "layout");
  return next;
}
