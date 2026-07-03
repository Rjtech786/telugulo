"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget GENUINE ad-view counter — pings once per ad per page load,
 * only from a real browser (never during SSR/SSG). Mirrors <ViewPing />.
 */
export function AdViewPing({ id, placement }: { id: string; placement?: string }) {
  useEffect(() => {
    const key = `ad-viewed:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/ads/view/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, placement }),
      keepalive: true,
    }).catch(() => {});
  }, [id, placement]);
  return null;
}
