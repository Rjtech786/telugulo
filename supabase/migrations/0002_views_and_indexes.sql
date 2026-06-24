-- View counter RPC (atomic increment) + author slug index.

create or replace function public.increment_article_views(article_id uuid)
returns void
language sql
as $$
  update public.articles set views = views + 1 where id = article_id;
$$;

create index if not exists authors_slug_idx on public.authors (slug);
create index if not exists articles_slug_idx on public.articles (slug);
