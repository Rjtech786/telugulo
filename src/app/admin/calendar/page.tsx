import { listArticles } from "@/lib/articles";
import { CalendarView } from "./CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const articles = await listArticles();
  
  // Format to simpler serializable data structure for client component
  const formatted = articles.map(a => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    category: a.category ?? "tech",
    status: a.status,
    published_at: a.published_at ?? a.created_at,
    views: a.views
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">Editorial Calendar</h1>
        <p className="text-sm text-ink-mute">
          Track daily articles, categories, and traffic performance in a monthly layout.
        </p>
      </div>
      <CalendarView initialArticles={formatted} />
    </div>
  );
}
