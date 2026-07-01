"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RichEditor } from "@/components/rich-editor";
import {
  saveArticle,
  publish,
  unpublish,
  uploadFeaturedImage,
  setFeaturedImageUrl,
  generateFeaturedImage,
  removeFeaturedImage,
} from "../actions";

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
  const [slugVal, setSlugVal] = useState(slug);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save(then?: () => Promise<unknown>) {
    setMsg(null);
    start(async () => {
      try {
        await saveArticle(id, { ...f, slug: slugVal });
        if (then) await then();
        setMsg({ ok: true, text: "Saved ✓" });
        router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit article</h1>
          <p className="text-sm text-neutral-500">
            /{slugVal} ·{" "}
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

      {msg && (
        <p className={"text-xs " + (msg.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
          {msg.text}
        </p>
      )}

      <FeaturedImage id={id} slug={slug} initialUrl={imageUrl} />

      <div className="grid gap-4">
        <Labeled label="Headline">
          <input className={field} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Labeled>
        <Labeled label="URL slug (article ka link)">
          <div className="flex items-center gap-1.5">
            <span className="flex-none text-sm text-neutral-400">telugulo.in/</span>
            <input
              className={field}
              value={slugVal}
              onChange={(e) => setSlugVal(e.target.value)}
              placeholder="my-article-url"
            />
          </div>
          <span className="mt-1 block text-xs text-neutral-400">
            Isse public URL banta hai. Change karoge to purana link 404 ho jaayega (letters, numbers, hyphens).
          </span>
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
        <div className="space-y-1">
          <span className="text-sm font-medium">Body</span>
          <RichEditor value={f.body} onChange={(v) => setF({ ...f, body: v })} />
        </div>
      </div>
    </div>
  );
}

function FeaturedImage({
  id,
  slug,
  initialUrl,
}: {
  id: string;
  slug: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [urlInput, setUrlInput] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function run(fn: () => Promise<{ url?: string | null }>, okText: string) {
    setMsg(null);
    start(async () => {
      try {
        const res = await fn();
        if (res && "url" in res) setUrl(res.url ?? null);
        setMsg({ kind: "ok", text: okText });
        router.refresh();
      } catch (e) {
        setMsg({ kind: "err", text: e instanceof Error ? e.message : "Failed" });
      }
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("id", id);
    fd.append("slug", slug);
    fd.append("file", file);
    run(() => uploadFeaturedImage(fd), "Uploaded ✓");
    e.target.value = "";
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Featured image</span>
        <span className="text-xs text-neutral-400">1200px+ landscape for Google Discover</span>
      </div>

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mb-3 max-h-64 w-full rounded-xl object-cover" />
      ) : (
        <div className="mb-3 flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400 dark:border-neutral-700">
          No featured image
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          ⬆ Upload
        </button>
        <button
          onClick={() => run(() => generateFeaturedImage(id), "Generated ✓")}
          disabled={pending}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          ✨ Generate with AI
        </button>
        {url && (
          <button
            onClick={() => run(() => removeFeaturedImage(id), "Removed")}
            disabled={pending}
            className="rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
          >
            Remove
          </button>
        )}
        {pending && <span className="text-xs text-neutral-400">working…</span>}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          className={`${field} flex-1`}
          placeholder="…or paste an image URL"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
        />
        <button
          onClick={() => run(() => setFeaturedImageUrl(id, urlInput), "Image set ✓")}
          disabled={pending || !urlInput.trim()}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Set
        </button>
      </div>

      {msg && (
        <p
          className={
            "mt-2 text-xs " +
            (msg.kind === "ok"
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400")
          }
        >
          {msg.text}
        </p>
      )}
    </section>
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
