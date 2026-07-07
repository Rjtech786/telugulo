-- Migration to convert Newsroom V3 pipeline to a database-driven dynamic pipeline.
-- Renames agent_configs to agent_registry and creates pipeline_steps.

-- 1. Rename table agent_configs to agent_registry if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_configs') THEN
    ALTER TABLE public.agent_configs RENAME TO agent_registry;
  END IF;
END $$;

-- 2. Add columns input_schema, output_schema, and created_at to agent_registry if they don't exist
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS input_schema jsonb;
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS output_schema jsonb;
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Ensure display_name and instructions are not null (migrate any nulls first)
UPDATE public.agent_registry SET display_name = COALESCE(display_name, agent_key) WHERE display_name IS NULL;
UPDATE public.agent_registry SET instructions = COALESCE(instructions, '') WHERE instructions IS NULL;

ALTER TABLE public.agent_registry ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE public.agent_registry ALTER COLUMN instructions SET NOT NULL;

-- 3. Update the touch_updated_at trigger for agent_registry
DROP TRIGGER IF EXISTS agent_configs_touch_updated_at ON public.agent_registry;
DROP TRIGGER IF EXISTS agent_registry_touch_updated_at ON public.agent_registry;

CREATE TRIGGER agent_registry_touch_updated_at
BEFORE UPDATE ON public.agent_registry
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Create the pipeline_steps table
CREATE TABLE IF NOT EXISTS public.pipeline_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_order integer NOT NULL,           -- execution order (steps with same order run in parallel)
  agent_key text NOT NULL REFERENCES public.agent_registry(agent_key) ON DELETE CASCADE,
  depends_on text[] DEFAULT '{}',        -- array of agent_keys that must complete before this runs
  is_blocking boolean DEFAULT true,      -- if true, failure here stops the pipeline (hard gate)
  enabled boolean DEFAULT true,          -- can disable a step without deleting it
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on pipeline_steps (allows read/write to authenticated/service role only by default)
ALTER TABLE public.pipeline_steps ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger for pipeline_steps
DROP TRIGGER IF EXISTS pipeline_steps_touch_updated_at ON public.pipeline_steps;
CREATE TRIGGER pipeline_steps_touch_updated_at
BEFORE UPDATE ON public.pipeline_steps
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Seed pipeline_steps table with default V3 sequence
INSERT INTO public.pipeline_steps (step_order, agent_key, depends_on, is_blocking, enabled) VALUES
  (1, 'dup_guard', '{}', true, true),
  (2, 'topic_scout', '{"dup_guard"}', true, true),
  (3, 'researcher', '{"topic_scout"}', true, true),
  (4, 'writer', '{"researcher"}', true, true),
  (5, 'fact_checker', '{"writer"}', true, true),
  (5, 'language_editor', '{"writer"}', true, true),
  (5, 'discover_checker', '{"writer"}', true, true),
  (6, 'fixer', '{"fact_checker", "language_editor", "discover_checker"}', true, true),
  (7, 'image_agent', '{"fixer"}', false, true)
ON CONFLICT DO NOTHING;
