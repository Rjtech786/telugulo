import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          telugulo<span className="text-neutral-400">.in</span>
        </h1>
        <p className="max-w-md text-neutral-500">
          తెలుగులో AI &amp; Tech news — coming soon. The public blog is built in
          Phase 6.
        </p>
      </div>
      <Link
        href="/admin"
        className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Admin dashboard →
      </Link>
    </main>
  );
}
