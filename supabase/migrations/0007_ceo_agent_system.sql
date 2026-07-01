-- CEO multi-agent system: one row per pipeline run (agent_runs) + a timeline
-- of CEO<->agent signals for that run (agent_messages). Powers the animated
-- "master/slave" view in Admin -> AI Agent.

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'cron',        -- 'cron' | 'manual'
  status text not null default 'running',      -- running | created | skipped | error
  article_id uuid references public.articles(id) on delete set null,
  article_title text,
  reason text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists agent_runs_started_idx on public.agent_runs (started_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  agent text not null,        -- 'ceo' | 'topic_scout' | 'researcher' | 'writer' | 'quality' | 'seo' | 'image'
  direction text not null,    -- 'ceo_to_agent' | 'agent_to_ceo'
  status text not null default 'working',  -- working | done | fixed | failed
  message text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_run_idx on public.agent_messages (run_id, created_at);

-- Admin/server-only: no anon policies (service role bypasses RLS).
alter table public.agent_runs enable row level security;
alter table public.agent_messages enable row level security;
