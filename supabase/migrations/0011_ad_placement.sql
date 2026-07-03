-- Track WHERE in the page an ad view/click happened (early/middle/late
-- in-article, end banner, popup) so placement can be picked by real
-- performance instead of a fixed hardcoded spot.

alter table public.ad_events add column if not exists placement text;
create index if not exists ad_events_placement_idx on public.ad_events (placement, event);
