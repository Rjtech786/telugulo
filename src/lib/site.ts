/** Site-wide constants for SEO, schema and chrome. */
export const SITE = {
  name: "telugulo.in",
  title: "telugulo.in — తెలుగు Tech & AI News",
  description:
    "రోజువారీ టెక్ న్యూస్, AI, gadgets — తెలుగులో. తాజా technology వార్తలు simple Telugu lo.",
  tagline: "టెక్ న్యూస్ తెలుగులో",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  locale: "te_IN",
  organization: {
    name: "telugulo.in",
    logo: "/opengraph-image",
  },
} as const;

export const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "ai", label: "AI" },
  { slug: "mobile", label: "మొబైల్" },
  { slug: "apps", label: "యాప్స్" },
  { slug: "gadgets", label: "గాడ్జెట్స్" },
  { slug: "internet", label: "ఇంటర్నెట్" },
  { slug: "tech", label: "టెక్" },
];

export function categoryLabel(slug: string | null): string {
  if (!slug) return "టెక్";
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

// Social links are now configured in Admin → Site Settings (DB-driven) and
// rendered via the SocialLinks component. See lib/settings.ts getSiteSettings().

export const FOOTER_PAGES: { href: string; label: string }[] = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/terms", label: "Terms" },
  { href: "/editorial-policy", label: "Editorial Policy" },
];

// Colourful gradient placeholders for articles without a featured image
// (matches the UI mock). Deterministic per seed so a card keeps its colour.
const GRADIENTS: [string, string][] = [
  ["#1d4ed8", "#3b82f6"],
  ["#0ea5e9", "#22d3ee"],
  ["#8b5cf6", "#a78bfa"],
  ["#f59e0b", "#fbbf24"],
  ["#ec4899", "#f472b6"],
  ["#14b8a6", "#2dd4bf"],
  ["#6366f1", "#818cf8"],
  ["#f43f5e", "#fb7185"],
  ["#84cc16", "#a3e635"],
];

export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("te-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
