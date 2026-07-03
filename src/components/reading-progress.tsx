"use client";

import { useEffect, useState } from "react";

/** Thin accent progress bar fixed to the top of article pages — fills as you scroll. */
export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setPct(total > 0 ? Math.min(100, (el.scrollTop / total) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent" aria-hidden="true">
      <div
        className="h-full bg-gradient-to-r from-accent to-[#ff5a3c] shadow-[0_0_8px_rgba(209,25,25,0.55)] transition-[width] duration-100"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
