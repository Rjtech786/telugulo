"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveArticle, publish, unpublish } from "../actions";

type Props = {
  id: string;
  status: "draft" | "published";
  slug: string;
  imageUrl: string | null;
  initial: {
    title: string;
    title_meta: string;
    meta_description: string;
    summary: string;
    body: string;
    category: string;
  };
};

const field =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";

export function EditForm({ id, status, slug, imageUrl, initial }: Props) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [pending, start] = useTransition();
  const [status_, setStatus_] = useState<string | null>(null);

  function save(then?: () => Promise<unknown>) {
    start(async () => {
      await saveArticle(id, f);
      if (then) await then();
      setStatus_("Saved ✓");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit article</h1>
          <p className="text-sm text-neutral-500">
            /{slug} ·{" "}
            <span className={status === "published" ? "text-green-600" : "text-amber-600"}>
              {status}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => save()}
            disabled={pending}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {status === "draft" ? (
            <button
              onClick={() => save(() => publish(id))}
              disabled={pending}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              Save &amp; Publish
            </button>
          ) : (
            <button
              onClick={() => save(() => unpublish(id))}
              disabled={pending}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Save &amp; Unpublish
            </button>
          )}
        </div>
      </div>

      {status_ && <p className="text-xs text-green-600 dark:text-green-400">{status_}</p>}

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="max-h-60 rounded-xl object-cover" />
      )}

      <div className="grid gap-4">
        <Labeled label="Headline">
          <input className={field} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Labeled>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="SEO title (title_meta)">
            <input className={field} value={f.title_meta} onChange={(e) => setF({ ...f, title_meta: e.target.value })} />
          </Labeled>
          <Labeled label="Category">
            <input className={field} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </Labeled>
        </div>
        <Labeled label="Meta description">
          <input className={field} value={f.meta_description} onChange={(e) => setF({ ...f, meta_description: e.target.value })} />
        </Labeled>
        <Labeled label="Summary">
          <textarea className={field} rows={2} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        </Labeled>
        <Labeled label="Body">
          <textarea className={`${field} font-mono`} rows={20} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        </Labeled>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
