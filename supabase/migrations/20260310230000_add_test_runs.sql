-- Create test_runs table
CREATE TABLE IF NOT EXISTS public.test_runs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    run_number SERIAL,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    suite_id UUID REFERENCES public.test_suites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    executed_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add test_run_id to test_executions
ALTER TABLE public.test_executions
ADD COLUMN IF NOT EXISTS test_run_id UUID REFERENCES public.test_runs(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for test_runs
CREATE POLICY "Users can view test runs of their projects"
ON public.test_runs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_runs.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create test runs in their projects"
ON public.test_runs FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_runs.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update test runs in their projects"
ON public.test_runs FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_runs.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete test runs in their projects"
ON public.test_runs FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_runs.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Comment on column
COMMENT ON COLUMN public.test_runs.run_number IS 'Human-readable test run ID number';
