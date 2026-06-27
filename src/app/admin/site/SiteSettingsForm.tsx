"use client";

import { useState, useTransition } from "react";
import { SOCIAL_META, type SiteSettings } from "@/lib/config";
import { Card, Field, SaveBar, inputCls } from "../_ui";
import { saveSiteSettings } from "./actions";

export function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const [s, setS] = useState<SiteSettings>(initial);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function save() {
    start(async () => {
      await saveSiteSettings(s);
      setStatus("Saved ✓ — live in a few seconds");
      setTimeout(() => setStatus(null), 4000);
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
    </div>
  );
}
