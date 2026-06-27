/** Shared admin form primitives — consistent, brand-aligned styling. */
import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";

export const selectCls =
  "rounded-lg border border-line bg-white px-2.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";

export function Card({
  title,
  desc,
  children,
  action,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
          {desc && <p className="mt-0.5 text-sm text-ink-soft">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

export function SaveBar({
  onSave,
  pending,
  status,
  label = "Save",
}: {
  onSave: () => void;
  pending: boolean;
  status: string | null;
  label?: string;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
      >
        {pending ? "Saving…" : label}
      </button>
      {status && <span className="text-sm font-medium text-green-600">{status}</span>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 transition hover:border-accent/30">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-mute">{hint}</span>}
      </span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          "relative inline-flex h-6 w-11 flex-none cursor-pointer rounded-full transition-colors " +
          (checked ? "bg-accent" : "bg-neutral-300")
        }
      >
        <span
          className={
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform " +
            (checked ? "translate-x-[22px]" : "translate-x-0.5")
          }
        />
      </span>
    </label>
  );
}
