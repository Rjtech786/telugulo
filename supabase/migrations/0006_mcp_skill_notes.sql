-- MCP add-on: agent skill-notes (self-learning memory) + MCP action audit log.
-- Agent writing instructions live in the existing `settings` table (key
-- 'agent_instructions'), so no table is needed for those.

create table if not exists public.skill_notes (
  id uuid primary key default gen_random_uuid(),
  problem_type text not null,
  solution_note text not null,
  times_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mcp_action_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  params jsonb,
  result text,
  created_at timestamptz not null default now()
);

create index if not exists mcp_action_log_created_idx on public.mcp_action_log (created_at desc);

-- Admin/server-only: no anon policies (service role bypasses RLS).
alter table public.skill_notes enable row level security;
alter table public.mcp_action_log enable row level security;
