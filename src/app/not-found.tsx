import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-xl font-bold text-white">
        తె
      </span>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">404</h1>
        <p className="mt-1 text-ink-soft">
          ఈ page దొరకలేదు — page not found.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
      >
        హోమ్‌కి వెళ్లండి →
      </Link>
    </main>
  );
}
