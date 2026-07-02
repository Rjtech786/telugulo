"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePage, removePage } from "../actions";

const field =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";

export function EditPageForm({
  id,
  slug,
  initial,
}: {
  id: string;
  slug: string;
  initial: { title: string; content: string };
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      try {
        await savePage(id, f);
        setMsg({ ok: true, text: "Saved ✓ — live in a few seconds" });
        router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
      }
    });
  }

  function remove() {
    if (!confirm("Delete this page permanently? Its footer link and URL will stop working.")) return;
    start(async () => {
      await removePage(id);
      router.push("/admin/pages");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit page</h1>
          <p className="text-sm text-neutral-500">telugulo.in/{slug}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={remove}
            disabled={pending}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {msg && (
        <p className={"text-xs " + (msg.ok ? "text-green-600" : "text-red-600")}>{msg.text}</p>
      )}

      <div className="grid gap-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Title</span>
          <input
            className={field}
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Content (Markdown)</span>
          <textarea
            className={`${field} font-mono`}
            rows={18}
            value={f.content}
            onChange={(e) => setF({ ...f, content: e.target.value })}
          />
          <span className="mt-1 block text-xs text-neutral-400">
            Supports ## headings, **bold**, - lists and [link text](/url) links.
          </span>
        </label>
      </div>
    </div>
  );
}
