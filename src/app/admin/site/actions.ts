"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { writeSetting, setArticleLayoutSettings } from "@/lib/settings";
import {
  SETTINGS_KEYS,
  SOCIAL_KEYS,
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
  type ArticleLayoutSettings,
} from "@/lib/config";

export async function saveSiteSettings(input: SiteSettings) {
  await requireAdmin();

  const socials = {} as SiteSettings["socials"];
  for (const k of SOCIAL_KEYS) {
    const v = (input.socials?.[k] ?? "").trim();
    // Only keep http(s) URLs; silently drop anything else.
    socials[k] = /^https?:\/\//i.test(v) ? v : "";
  }

  const clean: SiteSettings = {
    name: (input.name ?? "").trim() || DEFAULT_SITE_SETTINGS.name,
    tagline: (input.tagline ?? "").trim() || DEFAULT_SITE_SETTINGS.tagline,
    description: (input.description ?? "").trim() || DEFAULT_SITE_SETTINGS.description,
    footer_about: (input.footer_about ?? "").trim() || DEFAULT_SITE_SETTINGS.footer_about,
    socials,
  };

  await writeSetting(SETTINGS_KEYS.site, clean);

  // The public chrome is rendered in the (site) layout — refresh it everywhere.
  revalidatePath("/", "layout");
  revalidatePath("/admin/site");
  return { ok: true };
}

export async function saveArticleLayout(input: Partial<ArticleLayoutSettings>) {
  await requireAdmin();
  const next = await setArticleLayoutSettings(input);
  revalidatePath("/", "layout");
  revalidatePath("/admin/site");
  return next;
}
