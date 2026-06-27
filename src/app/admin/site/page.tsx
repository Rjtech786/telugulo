import { getSiteSettings } from "@/lib/settings";
import { SiteSettingsForm } from "./SiteSettingsForm";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  const initial = await getSiteSettings();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Site Settings</h1>
        <p className="text-sm text-ink-soft">
          Public identity &amp; social links — changes go live on the site in a few seconds.
        </p>
      </div>
      <SiteSettingsForm initial={initial} />
    </div>
  );
}
