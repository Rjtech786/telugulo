"use client";

import { useState, useTransition } from "react";
import {
  saveCredential,
  removeCredential,
  testCredential,
} from "./actions";

type Props = {
  provider: string;
  label: string;
  hint: string;
  testable: boolean;
  saved: boolean;
};

export function CredentialRow({ provider, label, hint, testable, saved }: Props) {
  const [value, setValue] = useState("");
  const [isSaved, setIsSaved] = useState(saved);
  const [status, setStatus] = useState<
    { kind: "ok" | "err" | "info"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!value.trim()) return;
    startTransition(async () => {
      try {
        await saveCredential(provider, value);
        setIsSaved(true);
        setValue("");
        setStatus({ kind: "ok", text: "Saved (encrypted) ✓" });
      } catch (e) {
        setStatus({ kind: "err", text: errMsg(e) });
      }
    });
  }

  function handleTest() {
    startTransition(async () => {
      try {
        const res = await testCredential(provider);
        setStatus({ kind: res.ok ? "ok" : "err", text: res.message });
      } catch (e) {
        setStatus({ kind: "err", text: errMsg(e) });
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeCredential(provider);
        setIsSaved(false);
        setStatus({ kind: "info", text: "Removed" });
      } catch (e) {
        setStatus({ kind: "err", text: errMsg(e) });
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-medium">
            {label}
            {isSaved && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-400">
                saved
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">{hint}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="password"
          autoComplete="off"
          placeholder={isSaved ? "•••••••• (saved — type to replace)" : "Paste key…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100"
        />
        <button
          onClick={handleSave}
          disabled={pending || !value.trim()}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Save
        </button>
        {testable && (
          <button
            onClick={handleTest}
            disabled={pending || !isSaved}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Test
          </button>
        )}
        {isSaved && (
          <button
            onClick={handleRemove}
            disabled={pending}
            className="rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/30"
          >
            Remove
          </button>
        )}
      </div>

      {status && (
        <p
          className={
            "mt-2 text-xs " +
            (status.kind === "ok"
              ? "text-green-600 dark:text-green-400"
              : status.kind === "err"
                ? "text-red-600 dark:text-red-400"
                : "text-neutral-500")
          }
        >
          {pending ? "…" : status.text}
        </p>
      )}
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}
