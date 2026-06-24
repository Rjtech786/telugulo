-- Telugulo blog platform schema (additive; does NOT touch ApnaBot tables)
-- Existing ApnaBot tables in this project: users, reminders, conversations,
-- message_logs, chat_history. This migration only CREATEs new tables.

-- AUTHORS
create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  bio text,
  avatar text,
  social jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ARTICLES
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  title_meta text,
  meta_description text,
  body text,
  summary text,
  category text,
  image_url text,
  author_id uuid references public.authors(id) on delete set null,
  source_urls jsonb default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists articles_status_published_idx on public.articles (status, published_at desc);
create index if not exists articles_category_idx on public.articles (category);

-- SETTINGS (dashboard config: per-step models, toggles, tone, length, etc.)
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- API KEYS (ENCRYPTED at rest; one row per provider)
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  provider text unique not null,
  key_enc text,
  updated_at timestamptz not null default now()
);

-- ADS (custom ads manager)
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text,
  link text,
  category text,
  views integer not null default 0,
  clicks integer not null default 0,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- PERFORMANCE INSIGHTS (weekly winner analysis)
create table if not exists public.performance_insights (
  id uuid primary key default gen_random_uuid(),
  week text,
  top_articles jsonb,
  patterns text,
  suggestions text,
  created_at timestamptz not null default now()
);

-- Row Level Security: lock everything down by default.
-- Server (Next.js) uses the service_role key which BYPASSES RLS.
-- Only public-facing reads are exposed to anon below.
alter table public.authors enable row level security;
alter table public.articles enable row level security;
alter table public.settings enable row level security;
alter table public.api_keys enable row level security;
alter table public.ads enable row level security;
alter table public.performance_insights enable row level security;

-- Public site reads: published articles, all authors, active ads.
drop policy if exists "public read published articles" on public.articles;
create policy "public read published articles"
  on public.articles for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "public read authors" on public.authors;
create policy "public read authors"
  on public.authors for select
  to anon, authenticated
  using (true);

drop policy if exists "public read active ads" on public.ads;
create policy "public read active ads"
  on public.ads for select
  to anon, authenticated
  using (active = true);

-- settings, api_keys, performance_insights: NO anon/authenticated policies =>
-- no access except via service_role (server-only). Keeps keys + config private.

-- updated_at auto-touch trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_touch_updated_at on public.articles;
create trigger articles_touch_updated_at
  before update on public.articles
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch_updated_at on public.settings;
create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

drop trigger if exists api_keys_touch_updated_at on public.api_keys;
create trigger api_keys_touch_updated_at
  before update on public.api_keys
  for each row execute function public.touch_updated_at();
