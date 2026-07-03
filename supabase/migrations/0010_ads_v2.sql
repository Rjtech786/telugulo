-- Ads v2: ad types (card/banner/popup), multi-image carousel, and
-- timestamped ad_events for the analytics dashboard (daily trend + CTR).

alter table public.ads add column if not exists type text not null default 'card' check (type in ('card', 'banner', 'popup'));
alter table public.ads add column if not exists images text[] not null default '{}';

-- Backfill: legacy single image_url becomes the first carousel image.
update public.ads
set images = array[image_url]
where image_url is not null and array_length(images, 1) is null;

create table if not exists public.ad_events (
  id bigint generated always as identity primary key,
  ad_id uuid references public.ads(id) on delete cascade,
  event text not null check (event in ('view', 'click')),
  created_at timestamptz not null default now()
);
create index if not exists ad_events_ad_idx on public.ad_events (ad_id, created_at);
create index if not exists ad_events_created_idx on public.ad_events (created_at);
-- Admin-only: no anon policies (service role bypasses RLS).
alter table public.ad_events enable row level security;

create or replace function public.daily_ad_events(p_days int default 14)
returns table(day date, views bigint, clicks bigint)
language sql
stable
as $$
  select (created_at at time zone 'Asia/Kolkata')::date as day,
         count(*) filter (where event = 'view')::bigint as views,
         count(*) filter (where event = 'click')::bigint as clicks
  from public.ad_events
  where created_at >= (now() - make_interval(days => p_days))
  group by 1
  order by 1;
$$;
