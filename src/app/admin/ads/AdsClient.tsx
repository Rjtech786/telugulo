"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAd, toggleAd, removeAd } from "./actions";
import type { Ad } from "@/lib/ads";

const field =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";

export function AdsClient({ ads }: { ads: Ad[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ title: "", image_url: "", link: "", category: "" });

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ads manager</h1>
        <p className="text-sm text-neutral-500">
          Custom ads with AI-friendly category matching. Activate after traffic
          builds. Kept light so the site stays fast.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 font-semibold">Add an ad</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={field} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className={field} placeholder="Category (e.g. ai, mobile — optional)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className={field} placeholder="Link (https://…)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <input className={field} placeholder="Image URL (optional)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        </div>
        <button
          onClick={() =>
            start(async () => {
              await addAd(form);
              setForm({ title: "", image_url: "", link: "", category: "" });
              refresh();
            })
          }
          disabled={pending || !form.title.trim() || !form.link.trim()}
          className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Add ad
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Your ads ({ads.length})
        </h2>
        {ads.length === 0 ? (
          <p className="text-sm text-neutral-500">No ads yet.</p>
        ) : (
          ads.map((ad) => (
            <div
              key={ad.id}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{ad.title}</div>
                <div className="truncate text-xs text-neutral-500">
                  {ad.category || "any"} · {ad.views} views · {ad.clicks} clicks ·{" "}
                  {ad.link}
                </div>
              </div>
              <button
                onClick={() => start(async () => { await toggleAd(ad.id, !ad.active); refresh(); })}
                disabled={pending}
                className={
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 " +
                  (ad.active
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800")
                }
              >
                {ad.active ? "Active" : "Inactive"}
              </button>
              <button
                onClick={() => start(async () => { if (confirm("Delete ad?")) { await removeAd(ad.id); refresh(); } })}
                disabled={pending}
                className="rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
