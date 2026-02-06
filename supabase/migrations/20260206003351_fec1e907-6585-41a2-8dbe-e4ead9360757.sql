-- Create projects table
CREATE TABLE public.projects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test_cases table
CREATE TABLE public.test_cases (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    system_requirement TEXT,
    steps TEXT,
    expected_result TEXT,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    test_type TEXT NOT NULL DEFAULT 'manual' CHECK (test_type IN ('manual', 'automated')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'running')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test_executions table
CREATE TABLE public.test_executions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
    notes TEXT,
    bug_description TEXT,
    executed_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
ON public.projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for test_cases (via project ownership)
CREATE POLICY "Users can view test cases of their projects"
ON public.test_cases FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_cases.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create test cases in their projects"
ON public.test_cases FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_cases.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update test cases in their projects"
ON public.test_cases FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_cases.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete test cases in their projects"
ON public.test_cases FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = test_cases.project_id
        AND projects.user_id = auth.uid()
    )
);

-- RLS Policies for test_executions (via test case -> project ownership)
CREATE POLICY "Users can view test executions of their projects"
ON public.test_executions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.test_cases
        JOIN public.projects ON projects.id = test_cases.project_id
        WHERE test_cases.id = test_executions.test_case_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create test executions in their projects"
ON public.test_executions FOR INSERT
WITH CHECK (
    auth.uid() = executed_by AND
    EXISTS (
        SELECT 1 FROM public.test_cases
        JOIN public.projects ON projects.id = test_cases.project_id
        WHERE test_cases.id = test_executions.test_case_id
        AND projects.user_id = auth.uid()
    )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_test_cases_updated_at
BEFORE UPDATE ON public.test_cases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();