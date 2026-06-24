"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runAnalysis } from "./actions";

export function RunAnalysis() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() =>
          start(async () => {
            const r = await runAnalysis();
            setMsg(r.message);
            router.refresh();
          })
        }
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Analysing…" : "Run winner analysis"}
      </button>
      {msg && <span className="text-xs text-neutral-500">{msg}</span>}
    </div>
  );
}
