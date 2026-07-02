"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StaticPage } from "@/lib/pages";
import { removePage } from "./actions";
import { formatAdmin } from "@/lib/site";

export function PagesClient({ pages }: { pages: StaticPage[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove(id: string) {
    if (!confirm("Delete this page permanently? Its footer link and URL will stop working.")) return;
    start(async () => {
      await removePage(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pages</h1>
        <p className="text-sm text-neutral-500">
          The footer/legal pages shown on the public site (About, Contact, Privacy, ...).
        </p>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          No pages yet.
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.title}</div>
                <div className="truncate text-xs text-neutral-500">/{p.slug}</div>
                <div className="mt-0.5 text-xs tabular-nums text-neutral-400">
                  Updated: {formatAdmin(p.updated_at)}
                </div>
              </div>
              <div className="flex flex-none items-center gap-2 text-sm">
                <Link
                  href={`/admin/pages/${p.id}`}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 transition hover:bg-neutral-100"
                >
                  Edit
                </Link>
                <button
                  onClick={() => remove(p.id)}
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
