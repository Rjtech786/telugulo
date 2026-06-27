import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: [
      `${SITE.url}/sitemap.xml`,
      `${SITE.url}/news-sitemap.xml`,
      `${SITE.url}/stories-sitemap.xml`,
    ],
    host: SITE.url,
  };
}
