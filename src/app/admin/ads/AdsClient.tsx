"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { addAd, toggleAd, removeAd, generateAdCopy, uploadAdImage } from "./actions";
import { Card, Field, inputCls } from "../_ui";
import type { Ad } from "@/lib/ads";

const EMPTY = {
  title: "",
  link: "",
  image_url: "",
  keywords: "",
  category: "",
  headline: "",
  description: "",
  cta: "",
};

export function AdsClient({ ads }: { ads: Ad[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gen, setGen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setErr(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    uploadAdImage(fd)
      .then(({ url }) => setForm((s) => ({ ...s, image_url: url })))
      .catch((er) => setErr(er instanceof Error ? er.message : "Upload failed"))
      .finally(() => setUploading(false));
  }

  function aiGenerate() {
    setErr(null);
    setGen(true);
    generateAdCopy({ title: form.title, link: form.link, keywords: form.keywords })
      .then((c) => setForm((f) => ({ ...f, ...c })))
      .catch((e) => setErr(e?.message ?? "AI generation failed"))
      .finally(() => setGen(false));
  }

  function submit() {
    setErr(null);
    start(async () => {
      try {
        await addAd(form);
        setForm(EMPTY);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to add ad");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Ads Manager</h1>
        <p className="text-sm text-ink-soft">
          Image + link + keywords do — AI ek polished ad bana dega, aur wo sirf un
          articles me dikhega jinke content se keywords match/relate hote hain.
        </p>
      </div>

      <Card title="Create an ad" desc="Keywords matter most — ad sirf matching/related posts me dikhega.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product / advertiser" hint="Internal name (optional).">
            <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Acme Smartphone X1" />
          </Field>
          <Field label="Link (https://…)" hint="Where the ad clicks through.">
            <input className={inputCls} value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Image" hint="Apne computer se upload karo (max 6 MB) ya URL paste karo.">
            <div className="flex items-center gap-2.5">
              <label className={`cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-white ${uploading ? "opacity-60" : ""}`}>
                {uploading ? "Uploading…" : "⬆ Upload image"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={onFile} />
              </label>
              {form.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image_url} alt="" className="h-9 w-12 flex-none rounded border border-line object-cover" />
              )}
            </div>
            <input className={`${inputCls} mt-2`} value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="…or paste an image URL" />
          </Field>
          <Field label="Category (optional)" hint="ai, mobile, apps, gadgets, internet, tech">
            <input className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="mobile" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Keywords (comma-separated)" hint="In keywords se match/related articles me hi ad dikhega. Khaali = har post pe (general).">
              <input className={inputCls} value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="smartphone, 5g, camera phone, android" />
            </Field>
          </div>
        </div>

        {/* AI copy */}
        <div className="mt-5 rounded-xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">Ad copy</span>
            <button
              type="button"
              onClick={aiGenerate}
              disabled={gen || !form.link.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
            >
              {gen ? "Generating…" : "✨ AI se copy banao"}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Headline">
              <input className={inputCls} value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="AI fill karega…" />
            </Field>
            <Field label="CTA button">
              <input className={inputCls} value={form.cta} onChange={(e) => set("cta", e.target.value)} placeholder="ఇప్పుడే చూడండి" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <input className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="One-line benefit…" />
              </Field>
            </div>
          </div>

          {(form.headline || form.image_url) && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-ink-mute">Preview</div>
              <AdPreview ad={form} />
            </div>
          )}
        </div>

        {err && <p className="mt-3 text-sm font-medium text-red-600">{err}</p>}

        <button
          onClick={submit}
          disabled={pending || !form.link.trim()}
          className="mt-5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add ad"}
        </button>
        <p className="mt-2 text-xs text-ink-mute">
          Copy khaali chhoda to add karte waqt AI khud bana dega. New ads inactive
          start hote hain — niche se Active karo.
        </p>
      </Card>

      <Card title={`Your ads (${ads.length})`}>
        {ads.length === 0 ? (
          <p className="text-sm text-ink-mute">No ads yet.</p>
        ) : (
          <div className="space-y-3">
            {ads.map((ad) => (
              <div key={ad.id} className="rounded-xl border border-line p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <AdPreview ad={adToPreview(ad)} />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(ad.keywords ?? []).map((k) => (
                        <span key={k} className="rounded bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                          {k}
                        </span>
                      ))}
                      {(!ad.keywords || ad.keywords.length === 0) && (
                        <span className="rounded bg-surface px-2 py-0.5 text-[11px] text-ink-mute">
                          general (har post pe)
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-ink-mute">
                      {ad.category || "any category"} · {ad.views} views · {ad.clicks} clicks
                    </div>
                  </div>
                  <div className="flex flex-none flex-col gap-2">
                    <button
                      onClick={() => start(async () => { await toggleAd(ad.id, !ad.active); router.refresh(); })}
                      disabled={pending}
                      className={
                        "rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 " +
                        (ad.active ? "bg-green-600 text-white hover:bg-green-700" : "border border-line text-ink-soft hover:bg-surface")
                      }
                    >
                      {ad.active ? "Active" : "Inactive"}
                    </button>
                    <button
                      onClick={() => start(async () => { if (confirm("Delete ad?")) { await removeAd(ad.id); router.refresh(); } })}
                      disabled={pending}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

type PreviewAd = {
  image_url: string;
  headline: string;
  description: string;
  cta: string;
};

function adToPreview(ad: Ad): PreviewAd {
  return {
    image_url: ad.image_url ?? "",
    headline: ad.headline ?? ad.title ?? "",
    description: ad.description ?? "",
    cta: ad.cta ?? "చూడండి",
  };
}

/** Mirrors the public AdSlot look so the owner sees the real result. */
function AdPreview({ ad }: { ad: PreviewAd }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-stretch gap-3">
        {ad.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.image_url} alt="" className="h-[88px] w-[110px] flex-none object-cover" />
        ) : (
          <div className="grid h-[88px] w-[110px] flex-none place-items-center bg-surface text-xs text-ink-mute">
            no image
          </div>
        )}
        <div className="min-w-0 flex-1 py-2.5 pr-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
            Sponsored
          </div>
          <div className="mt-0.5 line-clamp-2 text-[14px] font-bold leading-snug text-ink">
            {ad.headline || "Headline…"}
          </div>
          {ad.description && (
            <div className="mt-0.5 line-clamp-1 text-[12px] text-ink-soft">{ad.description}</div>
          )}
          <span className="mt-1.5 inline-block rounded-md bg-accent px-2.5 py-1 text-[11px] font-bold text-white">
            {ad.cta || "చూడండి"} →
          </span>
        </div>
      </div>
    </div>
  );
}
