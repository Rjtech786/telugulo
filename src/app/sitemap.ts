import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/public";
import { SITE, CATEGORIES, FOOTER_PAGES } from "@/lib/site";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await listPublished(1000);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "hourly", priority: 1 },
    ...FOOTER_PAGES.map((p) => ({
      url: `${SITE.url}${p.href}`,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${SITE.url}/category/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];

  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE.url}/${a.slug}`,
    lastModified: a.published_at ? new Date(a.published_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...articlePages];
}
