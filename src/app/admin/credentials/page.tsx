import { CREDENTIALS } from "@/lib/config";
import { getKeyStatuses } from "@/lib/api-keys";
import { CredentialRow } from "./CredentialRow";

export const dynamic = "force-dynamic";

export default async function CredentialsPage() {
  let statuses: Record<string, boolean> = {};
  let error: string | null = null;
  try {
    statuses = await getKeyStatuses();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credentials</h1>
        <p className="text-sm text-neutral-500">
          API keys are encrypted (AES-256-GCM) before storage and never sent
          back to the browser. Use <strong>Test</strong> to verify a key works.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {CREDENTIALS.map((c) => (
          <CredentialRow
            key={c.provider}
            provider={c.provider}
            label={c.label}
            hint={c.hint}
            testable={c.testable}
            saved={Boolean(statuses[c.provider])}
          />
        ))}
      </div>
    </div>
  );
}
