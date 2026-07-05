"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { publish, unpublish, remove, createManualArticle } from "./actions";
import { startReverify } from "../agent/actions";
import { formatAdmin } from "@/lib/site";

type Row = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  image_url: string | null;
  status: "draft" | "published";
  views: number;
  created_at: string;
  published_at: string | null;
};

export function ArticlesClient({ articles }: { articles: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  function newManual() {
    start(async () => {
      const { id } = await createManualArticle();
      router.push(`/admin/articles/${id}`);
    });
  }

  // Filter & Sort
  const filtered = articles.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.slug ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.summary ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || a.category === category;
    const matchesStatus = status === "all" || a.status === status;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const sorted = [...filtered].sort((x, y) => {
    if (sort === "newest") return new Date(y.created_at).getTime() - new Date(x.created_at).getTime();
    if (sort === "oldest") return new Date(x.created_at).getTime() - new Date(y.created_at).getTime();
    if (sort === "views") return y.views - x.views;
    if (sort === "title") return x.title.localeCompare(y.title);
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const uniqueCategories = Array.from(new Set(articles.map((a) => a.category).filter(Boolean))) as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Articles</h1>
          <p className="text-sm text-neutral-500">
            AI se banane ke liye{" "}
            <Link href="/admin/agent" className="font-medium text-accent underline">
              AI Agent
            </Link>{" "}
            pe jao — ya khud manual likho.
          </p>
        </div>
        <button
          onClick={newManual}
          disabled={pending}
          className="flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
        >
          {pending ? "…" : "✍️ New (manual)"}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
        <input
          type="search"
          placeholder="Search articles..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] rounded-lg border border-neutral-200 bg-slate-50/50 px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-neutral-800 dark:bg-neutral-950"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm outline-none dark:border-neutral-800 dark:bg-neutral-900"
        >
          <option value="all">All Categories</option>
          {uniqueCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm outline-none dark:border-neutral-800 dark:bg-neutral-900"
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm outline-none dark:border-neutral-800 dark:bg-neutral-900"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="views">Most Views</option>
          <option value="title">Alphabetical</option>
        </select>
      </div>

      <div className="space-y-2">
        {paginated.length === 0 ? (
          <Empty text="No articles matched your criteria." />
        ) : (
          paginated.map((a) => (
            <ArticleCard key={a.id} a={a} pending={pending} start={start} router={router} />
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <span className="text-xs text-neutral-500">
            Showing {Math.min(sorted.length, (currentPage - 1) * itemsPerPage + 1)}–
            {Math.min(sorted.length, currentPage * itemsPerPage)} of {sorted.length} articles
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 dark:border-neutral-800 dark:hover:bg-neutral-800"
            >
              Previous
            </button>
            <span className="text-xs text-neutral-500 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 dark:border-neutral-800 dark:hover:bg-neutral-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
      {text}
    </div>
  );
}

function ArticleCard({
  a,
  pending,
  start,
  router,
}: {
  a: Row;
  pending: boolean;
  start: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
}) {
  function act(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      {a.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.image_url}
          alt=""
          className="h-14 w-24 flex-none rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-14 w-24 flex-none items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400 dark:bg-neutral-800">
          no image
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{a.title}</div>
        <div className="truncate text-xs text-neutral-500">
          {a.category} · {a.views} views · /{a.slug}
        </div>
        <div className="mt-0.5 text-xs tabular-nums text-neutral-400">
          {a.status === "published" ? "Published" : "Created"}:{" "}
          {formatAdmin(a.published_at ?? a.created_at)}
        </div>
      </div>
      <div className="flex flex-none items-center gap-2 text-sm">
        <Link
          href={`/admin/articles/${a.id}`}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Edit
        </Link>
        {a.status === "draft" ? (
          <>
            <button
              onClick={() =>
                start(async () => {
                  await startReverify(a.id);
                  router.push("/admin/agent"); // watch it live in Mission Control
                })
              }
              disabled={pending}
              title="AI reviewers se dobara check + pass hone par auto-publish"
              className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1.5 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
            >
              🛡️ Re-verify
            </button>
            <button
              onClick={() => act(() => publish(a.id))}
              disabled={pending}
              className="rounded-lg bg-green-600 px-3 py-1.5 font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              Publish
            </button>
          </>
        ) : (
          <button
            onClick={() => act(() => unpublish(a.id))}
            disabled={pending}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Unpublish
          </button>
        )}
        <button
          onClick={() => {
            if (confirm("Delete this article permanently?")) act(() => remove(a.id));
          }}
          disabled={pending}
          className="rounded-lg px-2 py-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
