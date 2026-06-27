-- Timestamped page-view events for real traffic analytics (today/yesterday,
-- daily series, top articles by range). Complements the all-time articles.views
-- counter, which we keep incrementing for backward compatibility.

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  article_id uuid references public.articles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_idx on public.page_views (created_at);
create index if not exists page_views_article_idx on public.page_views (article_id, created_at);

-- Analytics are admin-only: no anon policies. The service role (admin client)
-- bypasses RLS for both the public view-ping insert and the dashboard reads.
alter table public.page_views enable row level security;

-- Daily view counts (grouped by IST calendar day) for the last p_days days.
create or replace function public.daily_view_counts(p_days int default 14)
returns table(day date, views bigint)
language sql
stable
as $$
  select (created_at at time zone 'Asia/Kolkata')::date as day,
         count(*)::bigint as views
  from public.page_views
  where created_at >= (now() - make_interval(days => p_days))
  group by 1
  order by 1;
$$;

-- Top articles by view events since a given timestamp (e.g. start of today/week).
create or replace function public.top_articles_since(p_since timestamptz, p_limit int default 10)
returns table(article_id uuid, title text, slug text, category text, views bigint)
language sql
stable
as $$
  select a.id, a.title, a.slug, a.category, count(pv.id)::bigint as views
  from public.page_views pv
  join public.articles a on a.id = pv.article_id
  where pv.created_at >= p_since
  group by a.id, a.title, a.slug, a.category
  order by count(pv.id) desc
  limit p_limit;
$$;
