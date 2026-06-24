import Link from "next/link";
import { listPublished } from "@/lib/public";
import { ArticleCard } from "@/components/article-card";

export const revalidate = 300; // ISR — refresh homepage every 5 min

export default async function HomePage() {
  const articles = await listPublished(30);

  return (
    <div className="space-y-6">
      <section className="py-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          తెలుగులో Tech & AI News
        </h1>
        <p className="mt-1 text-neutral-500">
          రోజూ కొత్త gadgets, apps, AI updates — simple Telugu lo.
        </p>
      </section>

      {articles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-16 text-center text-neutral-500 dark:border-neutral-700">
          <p>ఇంకా articles publish కాలేదు.</p>
          <Link href="/admin" className="mt-2 inline-block text-sm underline">
            Admin → Generate &amp; publish the first article
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
