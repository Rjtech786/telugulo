import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const nextConfig: NextConfig = {
  // Every page URL ends with "/" (matches the old WordPress URLs, e.g.
  // /kalonji-seeds-in-telugu/). Files with extensions (sitemap.xml, feed.xml)
  // are exempt automatically.
  trailingSlash: true,
  // Hide the on-screen Next.js dev indicator (bottom-left "N" badge).
  devIndicators: false,
  images: {
    // Serve modern formats (AVIF first, then WebP) for the smallest payloads.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
    ],
    // Some networks (NAT64/DNS64) resolve the public Supabase host to a
    // 64:ff9b:: address, which Next 16 blocks as "private". We only optimize
    // images from the allowlisted Supabase host above, so this is safe.
    dangerouslyAllowLocalIP: true,
  },
};

export default nextConfig;
