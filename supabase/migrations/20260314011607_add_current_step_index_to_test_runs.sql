ALTER TABLE public.test_runs ADD COLUMN IF NOT EXISTS current_step_index INTEGER DEFAULT 0;
