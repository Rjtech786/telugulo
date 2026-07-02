-- NEWSROOM V3 ("Verify Mode") — self-correcting pipeline. See NEWSROOM_V3_SPEC.
-- pg_trgm for duplicate detection, pipeline_runs structured log, banned_phrases
-- self-learning table, per-agent configs, agent-scoped skill notes.

create extension if not exists pg_trgm;

-- Structured per-run log (extends agent_runs/agent_messages, which stay for
-- the live animated view).
create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete set null,
  trigger text,                -- 'cron' | 'manual'
  stage_logs jsonb default '[]'::jsonb,
  facts_table jsonb,
  reviewer_scores jsonb,       -- {fact, language, discover, loops}
  hard_validator_results jsonb,
  final_status text,           -- published | draft_failed | skipped_duplicate | skipped_off_niche | skipped | error
  failure_report jsonb,
  created_at timestamptz default now()
);
create index if not exists pipeline_runs_created_idx on public.pipeline_runs (created_at desc);
alter table public.pipeline_runs enable row level security;

-- Self-learning banned phrases (Language Editor inserts new finds).
create table if not exists public.banned_phrases (
  id serial primary key,
  phrase text unique not null,
  replacement text,
  reason text,
  created_at timestamptz default now()
);
alter table public.banned_phrases enable row level security;

insert into public.banned_phrases (phrase, replacement, reason) values
 ('వ్యాపార సాక్షరులు', null, 'machine-translation nonsense'),
 ('భద్రతా చీటీలు', null, 'machine-translation nonsense'),
 ('పంపయితో సంబంధం', null, 'machine-translation nonsense'),
 ('కృత్రిమ మేధ', 'AI', 'textbook Telugu — use English term'),
 ('అంతర్జాలం', 'internet', 'textbook Telugu — use English term'),
 ('వేదిక', 'platform', 'textbook Telugu — use English term'),
 ('నకలు', 'నకిలీ', 'spelling'),
 ('మద్యస్థ', 'మధ్యస్థ', 'spelling')
on conflict (phrase) do nothing;

-- Per-agent instructions/tier/enabled (layer on top of shared newsroom rules).
create table if not exists public.agent_configs (
  agent_key text primary key,
  display_name text,
  instructions text,
  model_tier text default 'mid',      -- cheap | mid | best
  enabled boolean default true,
  updated_at timestamptz default now()
);
alter table public.agent_configs enable row level security;

drop trigger if exists agent_configs_touch_updated_at on public.agent_configs;
create trigger agent_configs_touch_updated_at
before update on public.agent_configs
for each row execute function public.touch_updated_at();

insert into public.agent_configs (agent_key, display_name, model_tier, instructions) values
 ('topic_scout', 'Topic Scout', 'cheap', 'Pick tech/AI/apps/gadgets/mobile/internet topics only. Reject pure politics, diplomacy, general news. Prefer genuine India/Telugu relevance but never fabricate one.'),
 ('dup_guard', 'Duplicate Guard', 'cheap', 'Flag a topic as duplicate if we already covered the same story. Only a genuinely NEW development on an old story is allowed through.'),
 ('researcher', 'Researcher', 'best', 'Produce a facts table from at least 3 real sources. Every fact needs a source URL. If a number/date/name is not in the facts table, it does not exist.'),
 ('writer', 'Writer', 'best', 'Write ONLY from the facts table. Every paragraph must trace to at least one fact. Target the configured word range. Ending must be concrete (date/number/sharp observation). Propose zero internal links.'),
 ('fact_checker', 'Fact Checker', 'mid', 'For every claim (number, date, name, quote, company) find its matching fact in the facts table. Unsupported claims are critical issues. Check quote attribution and that any India angle really exists in the facts.'),
 ('language_editor', 'Language Editor', 'mid', 'Go sentence by sentence: would an ordinary Telugu speaker say this aloud naturally? Flag machine-translation nonsense, textbook Telugu, spelling errors, inconsistent transliteration, uniform sentence length, repetition.'),
 ('discover_checker', 'Discover Checker', 'mid', 'Score against the Google Discover checklist: entity-rich declarative headline, main entities in the first paragraph, concrete ending, real-publisher Sources, relevant internal links only, meta description 140-160 chars.'),
 ('fixer', 'Fixer', 'best', 'Rewrite the affected sentences fully to fix every reviewer issue without breaking flow. Never introduce new facts that are not in the facts table.'),
 ('image_agent', 'Image Agent', 'cheap', 'Hero image must be at least 1200px wide with Telugu alt text.'),
 ('ceo', 'CEO', 'cheap', 'Orchestrate the pipeline, give a short, specific final verdict.')
on conflict (agent_key) do nothing;

-- Agent-scoped skill notes ('all' = every agent).
alter table public.skill_notes add column if not exists agent_key text not null default 'all';

-- Title-similarity duplicate check (used by Duplicate Guard + hard validator).
create or replace function public.similar_published_titles(p_title text, p_threshold real default 0.45)
returns table(id uuid, title text, slug text, sim real)
language sql stable as $$
  select a.id, a.title, a.slug, similarity(a.title, p_title) as sim
  from public.articles a
  where a.status = 'published' and similarity(a.title, p_title) > p_threshold
  order by sim desc limit 5;
$$;
