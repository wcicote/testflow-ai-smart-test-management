-- Add numeric counters for human-readable IDs
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_number SERIAL;
ALTER TABLE public.test_suites ADD COLUMN IF NOT EXISTS suite_number SERIAL;
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS case_number SERIAL;
ALTER TABLE public.test_executions ADD COLUMN IF NOT EXISTS execution_number SERIAL;

-- Comment on columns for clarity
COMMENT ON COLUMN public.projects.project_number IS 'Human-readable project ID number';
COMMENT ON COLUMN public.test_suites.suite_number IS 'Human-readable suite ID number';
COMMENT ON COLUMN public.test_cases.case_number IS 'Human-readable test case ID number';
COMMENT ON COLUMN public.test_executions.execution_number IS 'Human-readable execution/bug ID number';
