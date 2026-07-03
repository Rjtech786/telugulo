"use client";

import { useState, useTransition } from "react";
import { SOCIAL_META, type SiteSettings, type ArticleLayoutSettings } from "@/lib/config";
import { Card, Field, SaveBar, Toggle, inputCls } from "../_ui";
import { saveSiteSettings, saveArticleLayout } from "./actions";

export function SiteSettingsForm({
  initial,
  initialArticleLayout,
}: {
  initial: SiteSettings;
  initialArticleLayout: ArticleLayoutSettings;
}) {
  const [s, setS] = useState<SiteSettings>(initial);
  const [layout, setLayout] = useState<ArticleLayoutSettings>(initialArticleLayout);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [layoutStatus, setLayoutStatus] = useState<string | null>(null);
  const [layoutPending, startLayout] = useTransition();

  function save() {
    start(async () => {
      await saveSiteSettings(s);
      setStatus("Saved ✓ — live in a few seconds");
      setTimeout(() => setStatus(null), 4000);
    });
  }

  function toggleLayout(key: keyof ArticleLayoutSettings, value: boolean) {
    const next = { ...layout, [key]: value };
    setLayout(next);
    startLayout(async () => {
      await saveArticleLayout({ [key]: value });
      setLayoutStatus("Saved ✓");
      setTimeout(() => setLayoutStatus(null), 3000);
    });
  }

  return (
    <div className="space-y-6">
      <Card title="Identity" desc="Shown in the header, footer and across the site.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site name">
            <input
              className={inputCls}
              value={s.name}
              onChange={(e) => setS({ ...s, name: e.target.value })}
            />
          </Field>
          <Field label="Tagline" hint="Small line under the logo.">
            <input
              className={inputCls}
              value={s.tagline}
              onChange={(e) => setS({ ...s, tagline: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Description" hint="Used for SEO / meta description.">
            <textarea
              rows={2}
              className={inputCls}
              value={s.description}
              onChange={(e) => setS({ ...s, description: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Footer about" hint="Short blurb in the footer.">
            <textarea
              rows={2}
              className={inputCls}
              value={s.footer_about}
              onChange={(e) => setS({ ...s, footer_about: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Social links"
        desc="Paste full https:// URLs. Empty ones are hidden — no broken icons."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_META.map((m) => (
            <Field key={m.key} label={m.label}>
              <input
                type="url"
                inputMode="url"
                placeholder={m.placeholder}
                className={inputCls}
                value={s.socials[m.key]}
                onChange={(e) =>
                  setS({ ...s, socials: { ...s.socials, [m.key]: e.target.value } })
                }
              />
            </Field>
          ))}
        </div>
      </Card>

      <SaveBar onSave={save} pending={pending} status={status} label="Save site settings" />

      <Card
        title="Article page layout"
        desc="Har naye toggle click pe turant save ho jata hai — public site pe live."
        action={layoutStatus && <span className="text-sm font-medium text-green-600">{layoutStatus}</span>}
      >
        <div className="space-y-2.5">
          <Toggle
            checked={layout.show_toc}
            onChange={(v) => toggleLayout("show_toc", v)}
            label="Table of Contents"
            hint="Article ke ## headings se banaya chhota collapsible box (kam se kam 2 headings chahiye)."
          />
          <Toggle
            checked={layout.show_sources}
            onChange={(v) => toggleLayout("show_sources", v)}
            label="Sources block (మూలాలు)"
            hint="Research ke real source links wala box."
          />
          <Toggle
            checked={layout.show_related}
            onChange={(v) => toggleLayout("show_related", v)}
            label="Related articles (సంబంధిత వార్తలు)"
            hint="Article ke end me same-category suggestions."
          />
        </div>
        {layoutPending && <p className="mt-2 text-xs text-ink-mute">Saving…</p>}
      </Card>
    </div>
  );
}
