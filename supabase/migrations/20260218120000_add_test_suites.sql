-- Create test_suites table
CREATE TABLE IF NOT EXISTS public.test_suites (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add suite_id to test_cases
ALTER TABLE public.test_cases 
ADD COLUMN IF NOT EXISTS suite_id UUID REFERENCES public.test_suites(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.test_suites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for test_suites
CREATE POLICY "Users can view test suites of their projects"
ON public.test_suites FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_suites.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create test suites in their projects"
ON public.test_suites FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_suites.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update test suites in their projects"
ON public.test_suites FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_suites.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete test suites in their projects"
ON public.test_suites FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_suites.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_test_suites_updated_at
BEFORE UPDATE ON public.test_suites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
