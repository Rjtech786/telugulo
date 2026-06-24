"use client";

import { useEffect } from "react";

/** Fire-and-forget view counter — pings the API once per page load. */
export function ViewPing({ id }: { id: string }) {
  useEffect(() => {
    const key = `viewed:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/views", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
      keepalive: true,
    }).catch(() => {});
  }, [id]);
  return null;
}
