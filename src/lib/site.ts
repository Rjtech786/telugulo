/** Site-wide constants for SEO, schema and chrome. */
export const SITE = {
  name: "telugulo.in",
  title: "telugulo.in — తెలుగు Tech & AI News",
  description:
    "తెలుగులో AI & tech news. Latest gadgets, apps, ChatGPT, smartphones — daily updates, simple Telugu lo.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  locale: "te_IN",
  organization: {
    name: "telugulo.in",
    logo: "/icon.png",
  },
} as const;

export const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "ai", label: "AI" },
  { slug: "mobile", label: "Mobile" },
  { slug: "apps", label: "Apps" },
  { slug: "gadgets", label: "Gadgets" },
  { slug: "internet", label: "Internet" },
  { slug: "tech", label: "Tech" },
];

export const FOOTER_PAGES: { href: string; label: string }[] = [
  { href: "/about", label: "మా గురించి (About)" },
  { href: "/contact", label: "సంప్రదించండి (Contact)" },
  { href: "/privacy", label: "గోప్యతా విధానం (Privacy)" },
  { href: "/disclaimer", label: "నిరాకరణ (Disclaimer)" },
  { href: "/terms", label: "నిబంధనలు (Terms)" },
  { href: "/editorial-policy", label: "సంపాదకీయ విధానం (Editorial)" },
];

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
