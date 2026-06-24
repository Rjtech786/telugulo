-- Atomic counters for ads.

create or replace function public.increment_ad_clicks(ad_id uuid)
returns void language sql as $$
  update public.ads set clicks = clicks + 1 where id = ad_id;
$$;

create or replace function public.increment_ad_views(ad_id uuid)
returns void language sql as $$
  update public.ads set views = views + 1 where id = ad_id;
$$;
