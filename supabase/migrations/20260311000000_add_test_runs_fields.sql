-- Drop constraint on test_executions status
ALTER TABLE public.test_executions DROP CONSTRAINT test_executions_status_check;

-- Add new constraint allowing not_executed, passed, failed, blocked, untested
ALTER TABLE public.test_executions ADD CONSTRAINT test_executions_status_check CHECK (status IN ('not_executed', 'passed', 'failed', 'blocked', 'untested'));

-- Add test_run_id to test_executions if missing
ALTER TABLE public.test_executions ADD COLUMN IF NOT EXISTS test_run_id UUID REFERENCES public.test_runs(id) ON DELETE CASCADE;

-- Add executed_at to test_executions
ALTER TABLE public.test_executions ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP WITH TIME ZONE;

-- Modify test_runs table to support new requirements
ALTER TABLE public.test_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.test_runs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE;

-- Drop check constraint on priority and test_type on test_cases to prevent issues or adjust it if needed
-- Wait, let's just make sure test_runs status has no restrictive check, or add it.
-- Actually, running status check:
-- ALTER TABLE public.test_runs ADD CONSTRAINT test_runs_status_check CHECK (status IN ('running', 'paused', 'completed'));

-- Add origin, automation_framework, automation_script to test_cases if missing
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS automation_script TEXT;
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS automation_framework TEXT CHECK (automation_framework IN ('cypress', 'playwright'));
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual' CHECK (origin IN ('manual', 'ai'));
