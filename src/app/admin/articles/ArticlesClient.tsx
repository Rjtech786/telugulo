"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateNow, publish, unpublish, remove } from "./actions";
import type { PipelineResult } from "@/lib/agent/pipeline";
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
  const [result, setResult] = useState<PipelineResult | null>(null);

  const drafts = articles.filter((a) => a.status === "draft");
  const published = articles.filter((a) => a.status === "published");

  function handleGenerate() {
    setResult(null);
    start(async () => {
      const r = await generateNow();
      setResult(r);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Articles</h1>
          <p className="text-sm text-neutral-500">
            Drafts are AI-written and human-reviewed. Nothing publishes
            automatically.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending ? "Generating… (1–2 min)" : "⚡ Generate now"}
        </button>
      </div>

      {result && (
        <div
          className={
            "rounded-xl border px-4 py-3 text-sm " +
            (result.status === "error"
              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400"
              : "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300")
          }
        >
          <div className="font-medium">
            {result.status === "created" && `✓ Created ${result.drafts.length} draft(s)`}
            {result.status === "skipped" && `Skipped: ${result.reason}`}
            {result.status === "error" && `Error: ${result.reason}`}
          </div>
          {result.log.length > 0 && (
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-neutral-500">
              {result.log.join("\n")}
            </pre>
          )}
        </div>
      )}

      <Section title={`Drafts (${drafts.length})`}>
        {drafts.length === 0 ? (
          <Empty text="No drafts. Hit “Generate now” or wait for the daily cron." />
        ) : (
          drafts.map((a) => (
            <ArticleCard key={a.id} a={a} pending={pending} start={start} router={router} />
          ))
        )}
      </Section>

      <Section title={`Published (${published.length})`}>
        {published.length === 0 ? (
          <Empty text="Nothing published yet." />
        ) : (
          published.map((a) => (
            <ArticleCard key={a.id} a={a} pending={pending} start={start} router={router} />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
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
          <button
            onClick={() => act(() => publish(a.id))}
            disabled={pending}
            className="rounded-lg bg-green-600 px-3 py-1.5 font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            Publish
          </button>
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
