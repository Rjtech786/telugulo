-- Advanced ads: AI-composed copy + keyword targeting.
-- Owner provides image + link + keywords; an AI step writes the ad copy, and
-- ads are shown on articles whose content matches/relates to the keywords.

alter table public.ads add column if not exists keywords text[] not null default '{}';
alter table public.ads add column if not exists headline text;
alter table public.ads add column if not exists description text;
alter table public.ads add column if not exists cta text;

-- Helps the public targeting query that filters active ads.
create index if not exists ads_active_idx on public.ads (active);
