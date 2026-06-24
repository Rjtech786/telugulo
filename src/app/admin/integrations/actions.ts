"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { writeSetting } from "@/lib/settings";
import { SETTINGS_KEYS, type Integrations } from "@/lib/config";

export async function saveIntegrations(values: Integrations) {
  await requireAdmin();
  const clean: Integrations = {
    ga_id: (values.ga_id || "").trim(),
    gsc_verification: (values.gsc_verification || "").trim(),
    adsense_id: (values.adsense_id || "").trim(),
    head_html: (values.head_html || "").trim(),
  };
  await writeSetting(SETTINGS_KEYS.integrations, clean);
  // Head codes apply site-wide — revalidate every route's layout.
  revalidatePath("/", "layout");
  return { ok: true };
}
