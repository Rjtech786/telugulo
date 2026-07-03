"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addAd,
  toggleAd,
  removeAd,
  updateAdType,
  generateAdCopy,
  uploadAdImage,
  enhanceImage,
  saveAdsSettingsAction,
} from "./actions";
import { Card, Field, inputCls } from "../_ui";
import { AD_TYPES, type AdType, type AdsSettings } from "@/lib/config";
import type { Ad, AdAnalytics } from "@/lib/ads";

const EMPTY = {
  title: "",
  link: "",
  images: [] as string[],
  type: "card" as AdType,
  keywords: "",
  category: "",
  headline: "",
  description: "",
  cta: "",
};

export function AdsClient({
  ads,
  analytics,
  adsSettings,
}: {
  ads: Ad[];
  analytics: AdAnalytics;
  adsSettings: AdsSettings;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gen, setGen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (form.images.length >= 3) {
      setErr("Max 3 images per ad.");
      return;
    }
    setErr(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    uploadAdImage(fd)
      .then(({ url }) => setForm((s) => ({ ...s, images: [...s.images, url] })))
      .catch((er) => setErr(er instanceof Error ? er.message : "Upload failed"))
      .finally(() => setUploading(false));
  }

  function removeImage(url: string) {
    setForm((s) => ({ ...s, images: s.images.filter((u) => u !== url) }));
  }

  function enhance(url: string) {
    setErr(null);
    setEnhancing(url);
    enhanceImage(url)
      .then(({ url: newUrl }) => setForm((s) => ({ ...s, images: s.images.map((u) => (u === url ? newUrl : u)) })))
      .catch((er) => setErr(er instanceof Error ? er.message : "Enhance failed"))
      .finally(() => setEnhancing(null));
  }

  function aiGenerate() {
    setErr(null);
    setGen(true);
    generateAdCopy({ title: form.title, link: form.link, keywords: form.keywords, images: form.images })
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

  function toggle(ad: Ad) {
    setErr(null);
    start(async () => {
      try {
        await toggleAd(ad.id, !ad.active);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Toggle failed — try again");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete ad?")) return;
    setErr(null);
    start(async () => {
      try {
        await removeAd(id);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Delete failed — try again");
      }
    });
  }

  function changeType(id: string, type: AdType) {
    setErr(null);
    start(async () => {
      try {
        await updateAdType(id, type);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Type change failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Ads Manager</h1>
        <p className="text-sm text-ink-soft">
          Card, Banner ya Popup — type chuno, up to 3 images do (carousel ki tarah rotate hongi), AI
          copy + image enhance karta hai. Active ads matching articles pe PRIORITY paate hain, baaki
          har page pe rotate hote hain.
        </p>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          {err}
        </p>
      )}

      <AdsAnalytics analytics={analytics} />

      <PopupSettings initial={adsSettings} />

      <Card title="Create an ad" desc="Type + images + link + keywords do — AI polished creative bana dega.">
        <div className="mb-4">
          <Field label="Ad type" hint="Kahan dikhega tay karta hai.">
            <div className="flex flex-wrap gap-2">
              {AD_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                  title={t.hint}
                  className={
                    "rounded-lg border px-3 py-1.5 text-sm font-semibold transition " +
                    (form.type === t.id
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line text-ink-soft hover:bg-surface")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product / advertiser" hint="Internal name (optional).">
            <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Acme Smartphone X1" />
          </Field>
          <Field label="Link (https://…)" hint="Where the ad clicks through.">
            <input className={inputCls} value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" />
          </Field>

          <div className="sm:col-span-2">
            <Field label={`Images (${form.images.length}/3)`} hint="1-3 images — 2 ya 3 diye to carousel ki tarah rotate hongi.">
              <div className="flex flex-wrap items-center gap-2.5">
                {form.images.map((url) => (
                  <div key={url} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-16 w-20 rounded-lg border border-line object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/50 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => enhance(url)}
                        disabled={enhancing === url}
                        title="AI se enhance karo"
                        className="rounded bg-white/90 px-1.5 py-1 text-[10px] font-bold text-ink hover:bg-white disabled:opacity-50"
                      >
                        {enhancing === url ? "…" : "✨"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        title="Remove"
                        className="rounded bg-white/90 px-1.5 py-1 text-[10px] font-bold text-red-600 hover:bg-white"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {form.images.length < 3 && (
                  <label className={`grid h-16 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line text-xs font-medium text-ink-soft transition hover:bg-surface ${uploading ? "opacity-60" : ""}`}>
                    {uploading ? "…" : "⬆ Add"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={onFile} />
                  </label>
                )}
              </div>
            </Field>
          </div>

          <Field label="Category (optional)" hint="ai, mobile, apps, gadgets, internet, tech">
            <input className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="mobile" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Keywords (comma-separated)" hint="Matching articles pe ye ad PEHLE dikhega; baaki pages pe bhi rotation me aata hai. Khaali = pure general.">
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

          {(form.headline || form.images.length > 0) && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-ink-mute">Preview</div>
              <AdPreview ad={{ images: form.images, headline: form.headline, description: form.description, cta: form.cta }} />
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={pending || !form.link.trim() || form.images.length === 0}
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
                    <AdPreview
                      ad={{
                        images: ad.images?.length ? ad.images : ad.image_url ? [ad.image_url] : [],
                        headline: ad.headline ?? ad.title ?? "",
                        description: ad.description ?? "",
                        cta: ad.cta ?? "చూడండి",
                      }}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <select
                        value={ad.type}
                        onChange={(e) => changeType(ad.id, e.target.value as AdType)}
                        disabled={pending}
                        className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent"
                      >
                        {AD_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {(ad.keywords ?? []).map((k) => (
                        <span key={k} className="rounded bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-soft">
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
                      {ad.views > 0 && ` · ${Math.round((ad.clicks / ad.views) * 1000) / 10}% CTR`}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col gap-2">
                    <button
                      onClick={() => toggle(ad)}
                      disabled={pending}
                      className={
                        "rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 " +
                        (ad.active ? "bg-green-600 text-white hover:bg-green-700" : "border border-line text-ink-soft hover:bg-surface")
                      }
                    >
                      {ad.active ? "Active" : "Inactive"}
                    </button>
                    <button
                      onClick={() => remove(ad.id)}
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

function PopupSettings({ initial }: { initial: AdsSettings }) {
  const [delay, setDelay] = useState(initial.popup_delay_seconds);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setSaving(true);
    setMsg(null);
    saveAdsSettingsAction({ popup_delay_seconds: delay })
      .then(() => setMsg("Saved ✓"))
      .catch((e) => setMsg(e instanceof Error ? e.message : "Save failed"))
      .finally(() => setSaving(false));
  }

  return (
    <Card title="Popup timing" desc="Popup ad kitni der baad dikhe (session me sirf 1 baar).">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={120}
            value={delay}
            onChange={(e) => setDelay(Math.max(0, Math.min(120, Number(e.target.value) || 0)))}
            className={`${inputCls} w-24`}
          />
          <span className="text-sm text-ink-soft">seconds</span>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-sm font-medium text-green-600">{msg}</span>}
      </div>
    </Card>
  );
}

function AdsAnalytics({ analytics }: { analytics: AdAnalytics }) {
  const totalViews = analytics.series.reduce((s, p) => s + p.views, 0);
  const totalClicks = analytics.series.reduce((s, p) => s + p.clicks, 0);
  const ctr = totalViews > 0 ? Math.round((totalClicks / totalViews) * 1000) / 10 : 0;

  return (
    <Card title="Ads Analytics" desc="Last 14 days — impressions + clicks.">
      <div className="mb-4 flex flex-wrap gap-6">
        <Stat label="Views (14d)" value={totalViews} />
        <Stat label="Clicks (14d)" value={totalClicks} />
        <Stat label="Avg CTR" value={`${ctr}%`} />
      </div>
      <AdsChart series={analytics.series} />
      {analytics.perAd.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs text-ink-mute">
              <tr>
                <th className="px-3 py-2 font-medium">Ad</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Views</th>
                <th className="px-3 py-2 font-medium">Clicks</th>
                <th className="px-3 py-2 font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {analytics.perAd.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="max-w-[220px] truncate px-3 py-2 text-ink">{a.title}</td>
                  <td className="px-3 py-2 capitalize text-ink-soft">{a.type}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-soft">{a.views}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-soft">{a.clicks}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-soft">{a.ctr}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {analytics.placements.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold text-ink">
            In-article placement (last 30d) — auto-picked by CTR
          </div>
          <p className="mb-2 text-xs text-ink-mute">
            AI khud decide karta hai article me ad kahan (early/middle/late) rakhni hai — jo jagah
            best CTR deti hai wahi zyada baar chuni jaati hai, baaki 20% waqt naye spots test karta
            rehta hai taaki result badalne pe placement bhi badal jaye.
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs text-ink-mute">
                <tr>
                  <th className="px-3 py-2 font-medium">Placement</th>
                  <th className="px-3 py-2 font-medium">Views</th>
                  <th className="px-3 py-2 font-medium">Clicks</th>
                  <th className="px-3 py-2 font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {analytics.placements.map((p, i) => (
                  <tr key={p.placement} className="border-t border-line">
                    <td className="px-3 py-2 capitalize text-ink">
                      {p.placement} {i === 0 && <span className="ml-1 text-[10px] font-bold text-green-600">★ leading</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink-soft">{p.views}</td>
                    <td className="px-3 py-2 tabular-nums text-ink-soft">{p.clicks}</td>
                    <td className="px-3 py-2 tabular-nums text-ink-soft">{p.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums text-ink">{value}</div>
      <div className="text-xs text-ink-mute">{label}</div>
    </div>
  );
}

/* ─── SVG bar chart (no library) — mirrors the Overview traffic chart ─── */
function AdsChart({ series }: { series: { day: string; views: number; clicks: number }[] }) {
  const max = Math.max(1, ...series.map((p) => p.views));
  const W = 720;
  const H = 140;
  const pad = 20;
  const n = series.length;
  const bw = (W - pad * 2) / n;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none">
      {series.map((p, i) => {
        const h = (p.views / max) * (H - pad * 2);
        const ch = (p.clicks / max) * (H - pad * 2);
        const x = pad + i * bw;
        const y = H - pad - h;
        const isLast = i === n - 1;
        return (
          <g key={p.day}>
            <rect x={x + bw * 0.15} y={y} width={bw * 0.7} height={Math.max(h, 1)} rx={3} fill={isLast ? "var(--color-accent)" : "#f3c2c6"}>
              <title>{`${p.day}: ${p.views} views, ${p.clicks} clicks`}</title>
            </rect>
            {ch > 0 && (
              <rect x={x + bw * 0.15} y={H - pad - ch} width={bw * 0.7} height={Math.max(ch, 1)} rx={2} fill="var(--color-ink)" />
            )}
            {(i % 2 === 0 || isLast) && (
              <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-ink-mute)">
                {p.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

type PreviewAd = {
  images: string[];
  headline: string;
  description: string;
  cta: string;
};

/** Mirrors the public ad look (first image only — carousel is on the live site). */
function AdPreview({ ad }: { ad: PreviewAd }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-stretch gap-3">
        {ad.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.images[0]} alt="" className="h-[88px] w-[110px] flex-none object-cover" />
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
          {ad.images.length > 1 && (
            <span className="ml-1.5 text-[10px] text-ink-mute">+{ad.images.length - 1} more (carousel)</span>
          )}
        </div>
      </div>
    </div>
  );
}
