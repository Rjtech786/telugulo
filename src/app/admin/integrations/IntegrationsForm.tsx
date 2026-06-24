"use client";

import { useState, useTransition } from "react";
import type { Integrations } from "@/lib/config";
import { saveIntegrations } from "./actions";

const field =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";

export function IntegrationsForm({ initial }: { initial: Integrations }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function save() {
    start(async () => {
      await saveIntegrations(v);
      setStatus("Saved ✓ — live on the site now");
    });
  }

  return (
    <div className="space-y-5">
      <Card
        title="Google Analytics (GA4)"
        hint="Measurement ID from Analytics → Admin → Data Streams. Format: G-XXXXXXXXXX"
      >
        <input
          className={field}
          placeholder="G-XXXXXXXXXX"
          value={v.ga_id}
          onChange={(e) => setV({ ...v, ga_id: e.target.value })}
        />
      </Card>

      <Card
        title="Google Search Console"
        hint='Verification: in GSC choose "HTML tag", copy only the content="..." value and paste it here.'
      >
        <input
          className={field}
          placeholder="abcd1234… (content value only)"
          value={v.gsc_verification}
          onChange={(e) => setV({ ...v, gsc_verification: e.target.value })}
        />
      </Card>

      <Card
        title="Google AdSense"
        hint="Publisher ID from AdSense. Format: ca-pub-XXXXXXXXXXXXXXXX (adds the script + verification meta)."
      >
        <input
          className={field}
          placeholder="ca-pub-XXXXXXXXXXXXXXXX"
          value={v.adsense_id}
          onChange={(e) => setV({ ...v, adsense_id: e.target.value })}
        />
      </Card>

      <Card
        title="Custom <head> code"
        hint="Anything else for the page <head>: Bing/Pinterest/Facebook verification, extra pixels or scripts. Pasted exactly as-is."
      >
        <textarea
          className={`${field} font-mono`}
          rows={6}
          placeholder={`<meta name="..." content="..." />\n<script>…</script>`}
          value={v.head_html}
          onChange={(e) => setV({ ...v, head_html: e.target.value })}
        />
      </Card>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {status && (
          <span className="text-xs text-green-600 dark:text-green-400">{status}</span>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <p className="mb-3 text-xs text-neutral-500">{hint}</p>
      {children}
    </section>
  );
}
