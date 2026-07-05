"use client";

import { useState } from "react";
import Link from "next/link";

type SimpleArticle = {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: "draft" | "published";
  published_at: string;
  views: number;
};

const CATEGORIES: Record<string, { label: string; cls: string }> = {
  ai: { label: "AI", cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900/40" },
  mobile: { label: "Mobile", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/40" },
  apps: { label: "Apps", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40" },
  gadgets: { label: "Gadgets", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40" },
  internet: { label: "Internet", cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/40" },
  tech: { label: "Tech", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/40" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function CalendarView({ initialArticles }: { initialArticles: SimpleArticle[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar logic helper variables
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDaysInMonth = new Date(year, month, 0).getDate();

  // Create grid cells (42 total: 6 rows * 7 columns)
  const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Trailing days from previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const prevDay = prevDaysInMonth - i;
    const prevMonthDate = new Date(year, month - 1, prevDay);
    const dateStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-${String(prevDay).padStart(2, "0")}`;
    cells.push({ dateStr, dayNum: prevDay, isCurrentMonth: false });
  }

  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    cells.push({ dateStr, dayNum: i, isCurrentMonth: true });
  }

  // Leading days from next month to fill the 42 cells grid
  const remainingCells = 42 - cells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonthDate = new Date(year, month + 1, i);
    const dateStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    cells.push({ dateStr, dayNum: i, isCurrentMonth: false });
  }

  // Helper to match articles to date cells
  const getArticlesForDate = (dateStr: string) => {
    return initialArticles.filter((art) => art.published_at.substring(0, 10) === dateStr);
  };

  // Totals stats for current month view
  const currentMonthDatePrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const currentMonthArticles = initialArticles.filter(a => a.published_at.startsWith(currentMonthDatePrefix));
  const publishedCount = currentMonthArticles.filter(a => a.status === "published").length;
  const draftCount = currentMonthArticles.filter(a => a.status === "draft").length;
  const totalViews = currentMonthArticles.reduce((sum, a) => sum + a.views, 0);

  return (
    <div className="space-y-6">
      {/* Calendar Header Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-ink dark:text-white">
            {MONTHS[month]} {year}
          </h2>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
            {currentMonthArticles.length} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="rounded-lg border border-line p-2 hover:bg-surface dark:border-neutral-800 dark:hover:bg-neutral-800 text-ink dark:text-slate-300"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            onClick={handleToday}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface dark:border-neutral-800 dark:hover:bg-neutral-800 text-ink dark:text-slate-300"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="rounded-lg border border-line p-2 hover:bg-surface dark:border-neutral-800 dark:hover:bg-neutral-800 text-ink dark:text-slate-300"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      {/* Month Stats Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
          <div className="text-xs font-medium text-ink-mute uppercase tracking-tight">Total Posts</div>
          <div className="mt-1 text-2xl font-bold text-ink dark:text-white">{currentMonthArticles.length}</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
          <div className="text-xs font-medium text-ink-mute uppercase tracking-tight">Published</div>
          <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{publishedCount}</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
          <div className="text-xs font-medium text-ink-mute uppercase tracking-tight">Drafts</div>
          <div className="mt-1 text-2xl font-bold text-amber-500">{draftCount}</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
          <div className="text-xs font-medium text-ink-mute uppercase tracking-tight">Views This Month</div>
          <div className="mt-1 text-2xl font-bold text-accent">{totalViews.toLocaleString()}</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
        {/* Days of Week Row */}
        <div className="grid grid-cols-7 border-b border-line bg-surface dark:border-neutral-800 dark:bg-neutral-900/50 text-center text-xs font-bold uppercase tracking-wider text-ink-soft py-2.5">
          {WEEKDAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-line dark:divide-neutral-800 border-l border-t border-line dark:border-neutral-800">
          {cells.map((cell, idx) => {
            const dateArticles = getArticlesForDate(cell.dateStr);
            const isToday = new Date().toISOString().substring(0, 10) === cell.dateStr;

            return (
              <div
                key={idx}
                className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors ${
                  cell.isCurrentMonth
                    ? "bg-white dark:bg-neutral-900 hover:bg-slate-50/50 dark:hover:bg-neutral-800/40"
                    : "bg-slate-50/40 text-neutral-300 dark:bg-neutral-950/20 dark:text-neutral-600"
                } ${isToday ? "ring-2 ring-accent ring-inset" : ""}`}
              >
                {/* Day Number Header */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      isToday
                        ? "bg-accent text-white"
                        : cell.isCurrentMonth
                          ? "text-ink dark:text-slate-300"
                          : "text-ink-mute"
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                </div>

                {/* Day Articles Stack */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] scrollbar-thin">
                  {dateArticles.map((art) => {
                    const cat = CATEGORIES[art.category] ?? { label: art.category, cls: "bg-slate-100 text-slate-700 border-slate-200" };
                    return (
                      <Link
                        key={art.id}
                        href={`/admin/articles/${art.id}`}
                        className={`group block rounded px-1.5 py-0.5 text-[10px] font-medium border transition hover:brightness-95 ${cat.cls} truncate`}
                        title={`${art.title} (${art.status} · ${art.views} views)`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-1 h-1 rounded-full shrink-0 ${art.status === 'published' ? 'bg-green-500' : 'bg-amber-500'}`} />
                          <span className="truncate">{art.title}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
