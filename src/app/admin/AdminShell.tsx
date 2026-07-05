"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, type ComponentType, type SVGProps } from "react";
import { signOut } from "./actions";
import {
  IconDashboard,
  IconArticles,
  IconSettings,
  IconKey,
  IconPlug,
  IconChart,
  IconMegaphone,
  IconGlobe,
  IconBolt,
  IconPage,
  IconUser,
  IconLogout,
  IconMenu,
  IconClose,
  IconCalendar,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: IconDashboard, exact: true },
  { href: "/admin/agent", label: "AI Agent", icon: IconBolt },
  { href: "/admin/articles", label: "Articles", icon: IconArticles },
  { href: "/admin/calendar", label: "Calendar", icon: IconCalendar },
  { href: "/admin/analytics", label: "Analytics", icon: IconChart },
  { href: "/admin/pages", label: "Pages", icon: IconPage },
  { href: "/admin/authors", label: "Authors", icon: IconUser },
  { href: "/admin/site", label: "Site Settings", icon: IconGlobe },
  { href: "/admin/settings", label: "AI Settings", icon: IconSettings },
  { href: "/admin/credentials", label: "Credentials", icon: IconKey },
  { href: "/admin/integrations", label: "Integrations", icon: IconPlug },
  { href: "/admin/ads", label: "Ads", icon: IconMegaphone },
];

function Sidebar({
  email,
  dark,
  toggleTheme,
  onNavigate,
}: {
  email: string;
  dark: boolean;
  toggleTheme: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="flex h-full flex-col">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-accent text-lg font-bold text-white">
            తె
          </span>
          <span className="leading-tight">
            <span className="block font-bold tracking-tight text-ink">telugulo</span>
            <span className="block text-[11px] text-ink-mute">admin panel</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={
                  "flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-accent-soft text-accent"
                    : "text-ink-soft hover:bg-surface hover:text-ink")
                }
              >
                <Icon className="h-5 w-5 flex-none" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + sign out (separated from nav) */}
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
              {email.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                {email.split("@")[0]}
              </span>
              <span className="block truncate text-xs text-ink-mute">{email}</span>
            </span>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title="Toggle theme"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              {dark ? "☀️" : "🌙"}
            </button>
            <form action={signOut}>
              <button
                aria-label="Sign out"
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <IconLogout className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
}

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);

  useEffect(() => {
    const isDark = localStorage.getItem("theme") === "dark" || 
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowPalette((prev) => !prev);
        setPaletteSearch("");
        setPaletteIndex(0);
      }
      if (e.key === "Escape") {
        setShowPalette(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredNav = NAV.filter(item => 
    item.label.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  const handlePaletteSelect = (href: string) => {
    setShowPalette(false);
    window.location.href = href;
  };

  useEffect(() => {
    setPaletteIndex(0);
  }, [paletteSearch, showPalette]);

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPaletteIndex((prev) => (prev + 1) % Math.max(1, filteredNav.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPaletteIndex((prev) => (prev - 1 + filteredNav.length) % Math.max(1, filteredNav.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredNav[paletteIndex]) {
        handlePaletteSelect(filteredNav[paletteIndex].href);
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">
        <Sidebar email={email} dark={dark} toggleTheme={toggleTheme} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"
            >
              <IconClose className="h-5 w-5" />
            </button>
            <Sidebar email={email} dark={dark} toggleTheme={toggleTheme} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"
            >
              <IconMenu className="h-6 w-6" />
            </button>
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
                తె
              </span>
              <span className="font-bold tracking-tight text-ink">telugulo admin</span>
            </span>
          </div>
          <button
            onClick={() => setShowPalette(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"
            aria-label="Open command palette"
          >
            🔍
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Command Palette Modal */}
      {showPalette && (
        <div className="fixed inset-0 z-[100] flex justify-center bg-black/60 pt-[15vh] backdrop-blur-sm">
          <div 
            className="absolute inset-0 bg-transparent" 
            onClick={() => setShowPalette(false)} 
          />
          <div className="relative z-10 flex h-fit w-full max-w-lg flex-col rounded-2xl border border-line bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2 border-b border-line pb-2.5 dark:border-neutral-800">
              <span className="text-lg">🔍</span>
              <input
                autoFocus
                type="text"
                placeholder="Search pages... (e.g. Overview, Articles)"
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                onKeyDown={handlePaletteKeyDown}
                className="w-full bg-transparent text-sm outline-none text-ink dark:text-white"
              />
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-400 dark:bg-neutral-800">ESC</span>
            </div>
            
            <div className="mt-3 max-h-[300px] overflow-y-auto space-y-1 scrollbar-thin">
              {filteredNav.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-neutral-400">No pages found</div>
              ) : (
                filteredNav.map((item, idx) => {
                  const Icon = item.icon;
                  const selected = idx === paletteIndex;
                  return (
                    <button
                      key={item.href}
                      onClick={() => handlePaletteSelect(item.href)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                        selected 
                          ? "bg-accent-soft text-accent" 
                          : "text-ink-soft hover:bg-surface hover:text-ink dark:hover:bg-neutral-800"
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      <span>{item.label}</span>
                      {selected && <span className="ml-auto text-[10px] opacity-70">Enter</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
