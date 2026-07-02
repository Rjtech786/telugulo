"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Author } from "@/lib/authors";
import { createNewAuthor, removeAuthor } from "./actions";

export function AuthorsClient({
  authors,
  counts,
}: {
  authors: Author[];
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function newAuthor() {
    start(async () => {
      const { id } = await createNewAuthor();
      router.push(`/admin/authors/${id}`);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this author? Their articles will show as 'telugulo team' instead.")) return;
    start(async () => {
      await removeAuthor(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Authors</h1>
          <p className="text-sm text-neutral-500">
            Name, photo and bio shown on articles and author pages.
          </p>
        </div>
        <button
          onClick={newAuthor}
          disabled={pending}
          className="flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
        >
          {pending ? "…" : "+ New author"}
        </button>
      </div>

      {authors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          No authors yet.
        </div>
      ) : (
        <div className="space-y-2">
          {authors.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3"
            >
              {a.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.avatar}
                  alt=""
                  className="h-12 w-12 flex-none rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                  {a.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.name}</div>
                <div className="truncate text-xs text-neutral-500">
                  {a.slug ? `/author/${a.slug}` : "no slug"} · {counts[a.id] ?? 0} article(s)
                </div>
              </div>
              <div className="flex flex-none items-center gap-2 text-sm">
                <Link
                  href={`/admin/authors/${a.id}`}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 transition hover:bg-neutral-100"
                >
                  Edit
                </Link>
                <button
                  onClick={() => remove(a.id)}
                  disabled={pending}
                  className="rounded-lg px-2 py-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
