import { getIntegrations } from "@/lib/settings";
import { IntegrationsForm } from "./IntegrationsForm";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  let initial;
  try {
    initial = await getIntegrations();
  } catch (e) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
        {e instanceof Error ? e.message : "Failed to load"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-neutral-500">
          Paste your Google Analytics, Search Console, AdSense and any other{" "}
          <code>&lt;head&gt;</code> code here. Saved to the database and applied
          site-wide instantly — no redeploy needed.
        </p>
      </div>
      <IntegrationsForm initial={initial} />
    </div>
  );
}
