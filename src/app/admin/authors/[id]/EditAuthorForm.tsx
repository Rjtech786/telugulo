"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveAuthor,
  removeAuthor,
  uploadAuthorAvatar,
  setAuthorAvatarUrl,
  removeAuthorAvatar,
} from "../actions";

const field =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";

export function EditAuthorForm({
  id,
  avatarUrl,
  initial,
}: {
  id: string;
  avatarUrl: string | null;
  initial: { name: string; slug: string; bio: string };
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      try {
        await saveAuthor(id, f);
        setMsg({ ok: true, text: "Saved ✓" });
        router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
      }
    });
  }

  function remove() {
    if (!confirm("Delete this author? Their articles will show as 'telugulo team' instead.")) return;
    start(async () => {
      await removeAuthor(id);
      router.push("/admin/authors");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Edit author</h1>
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

      <Avatar id={id} initialUrl={avatarUrl} />

      <div className="grid gap-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Name</span>
          <input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">URL slug</span>
          <div className="flex items-center gap-1.5">
            <span className="flex-none text-sm text-neutral-400">telugulo.in/author/</span>
            <input className={field} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
          </div>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            className={field}
            rows={3}
            value={f.bio}
            onChange={(e) => setF({ ...f, bio: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

function Avatar({ id, initialUrl }: { id: string; initialUrl: string | null }) {
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
    fd.append("file", file);
    run(() => uploadAuthorAvatar(fd), "Uploaded ✓");
    e.target.value = "";
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-20 w-20 flex-none rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 flex-none items-center justify-center rounded-full border border-dashed border-neutral-300 text-xs text-neutral-400">
            No photo
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            ⬆ Upload photo
          </button>
          {url && (
            <button
              onClick={() => run(() => removeAuthorAvatar(id), "Removed")}
              disabled={pending}
              className="rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${field} flex-1`}
          placeholder="…or paste an image URL"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
        />
        <button
          onClick={() => run(() => setAuthorAvatarUrl(id, urlInput), "Photo set ✓")}
          disabled={pending || !urlInput.trim()}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 disabled:opacity-40"
        >
          Set
        </button>
      </div>

      {msg && (
        <p className={"mt-2 text-xs " + (msg.kind === "ok" ? "text-green-600" : "text-red-600")}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
