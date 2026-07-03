"use client";

import { useState } from "react";

/** Social share row for article pages: WhatsApp, Facebook, Telegram, X, copy. */
export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const links: { name: string; href: string; bg: string; icon: React.ReactNode }[] = [
    {
      name: "WhatsApp",
      href: `https://api.whatsapp.com/send?text=${t}%0A${u}`,
      bg: "bg-[#25d366]",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07a8.2 8.2 0 0 1-2.4-1.49 9 9 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2-1.42.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.58-.35zM12.05 21.8a9.7 9.7 0 0 1-4.96-1.36l-.36-.21-3.68.96.98-3.59-.23-.37a9.75 9.75 0 1 1 8.25 4.57zm0-21.55C5.55.25.28 5.52.28 12.02c0 2.07.54 4.1 1.57 5.88L.18 23.82l6.07-1.6a11.7 11.7 0 0 0 5.8 1.55h.01c6.5 0 11.77-5.27 11.77-11.76 0-3.14-1.22-6.1-3.44-8.32A11.7 11.7 0 0 0 12.05.25z" />
        </svg>
      ),
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      bg: "bg-[#1877f2]",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
        </svg>
      ),
    },
    {
      name: "Telegram",
      href: `https://t.me/share/url?url=${u}&text=${t}`,
      bg: "bg-[#229ed9]",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M11.94 0A12 12 0 1 0 24 12 12 12 0 0 0 11.94 0zm5.85 8.16-1.97 9.3c-.15.66-.54.82-1.1.51l-3.02-2.23-1.46 1.4a.76.76 0 0 1-.6.3l.21-3.06 5.56-5.03c.24-.21-.05-.33-.37-.12l-6.87 4.33-2.96-.93c-.64-.2-.66-.64.14-.95l11.57-4.46c.53-.2 1 .12.87.94z" />
        </svg>
      ),
    },
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      bg: "bg-black",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.66l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z" />
        </svg>
      ),
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-bold uppercase tracking-wide text-ink-mute">Share:</span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${l.name} లో share చేయండి`}
          className={`grid h-8 w-8 place-items-center rounded-full text-white transition hover:scale-110 hover:shadow-md ${l.bg}`}
        >
          {l.icon}
        </a>
      ))}
      <button
        onClick={copy}
        aria-label="Link copy చేయండి"
        className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-soft transition hover:scale-110 hover:border-accent hover:text-accent"
      >
        {copied ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-4 w-4 text-green-600">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
      </button>
      {copied && <span className="text-xs font-medium text-green-600">Copy అయ్యింది ✓</span>}
    </div>
  );
}
