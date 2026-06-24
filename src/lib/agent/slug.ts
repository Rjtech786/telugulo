import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Enforce the spec's URL slug rules (§6): Telugu romanized, lowercase,
 * hyphen-separated, no special chars / no Telugu script, short (≤6 words).
 */
export function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "") // drop non-ascii (incl. Telugu script) + symbols
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const words = cleaned.split("-").filter(Boolean).slice(0, 6);
  let slug = words.join("-");
  if (slug.length > 60) slug = slug.slice(0, 60).replace(/-[^-]*$/, "");
  return slug || "telugu-tech-news";
}

/** Append -2, -3, … until the slug is unique in the articles table. */
export async function ensureUniqueSlug(base: string): Promise<string> {
  const supabase = createAdminClient();
  let slug = base;
  let n = 1;
  // Loop is tiny in practice; cap to avoid runaway.
  while (n < 50) {
    const { data, error } = await supabase
      .from("articles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}
