-- Add bug_status column to test_executions for tracking resolution
ALTER TABLE public.test_executions 
ADD COLUMN IF NOT EXISTS bug_status text DEFAULT 'open' 
CHECK (bug_status IN ('open', 'in_progress', 'resolved'));

-- Create bug_evidences table for storing evidence files
CREATE TABLE public.bug_evidences (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    test_execution_id uuid NOT NULL REFERENCES public.test_executions(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    file_type text NOT NULL CHECK (file_type IN ('image', 'video')),
    file_name text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on bug_evidences
ALTER TABLE public.bug_evidences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view evidences of their test executions
CREATE POLICY "Users can view bug evidences of their projects" 
ON public.bug_evidences 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM test_executions te
    JOIN test_cases tc ON tc.id = te.test_case_id
    JOIN projects p ON p.id = tc.project_id
    WHERE te.id = bug_evidences.test_execution_id 
    AND p.user_id = auth.uid()
));

-- Policy: Users can insert evidences for their test executions
CREATE POLICY "Users can insert bug evidences for their projects" 
ON public.bug_evidences 
FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM test_executions te
    JOIN test_cases tc ON tc.id = te.test_case_id
    JOIN projects p ON p.id = tc.project_id
    WHERE te.id = bug_evidences.test_execution_id 
    AND p.user_id = auth.uid()
));

-- Policy: Users can delete evidences of their projects
CREATE POLICY "Users can delete bug evidences of their projects" 
ON public.bug_evidences 
FOR DELETE 
USING (EXISTS (
    SELECT 1 FROM test_executions te
    JOIN test_cases tc ON tc.id = te.test_case_id
    JOIN projects p ON p.id = tc.project_id
    WHERE te.id = bug_evidences.test_execution_id 
    AND p.user_id = auth.uid()
));

-- Allow users to delete their test executions (for bug deletion)
CREATE POLICY "Users can delete test executions of their projects" 
ON public.test_executions 
FOR DELETE 
USING (EXISTS (
    SELECT 1 FROM test_cases tc
    JOIN projects p ON p.id = tc.project_id
    WHERE tc.id = test_executions.test_case_id 
    AND p.user_id = auth.uid()
));

-- Allow users to update test executions (for status changes)
CREATE POLICY "Users can update test executions of their projects" 
ON public.test_executions 
FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM test_cases tc
    JOIN projects p ON p.id = tc.project_id
    WHERE tc.id = test_executions.test_case_id 
    AND p.user_id = auth.uid()
));

-- Create storage bucket for bug evidences
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bug-evidences', 'bug-evidences', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bug evidences bucket
CREATE POLICY "Anyone can view bug evidence files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'bug-evidences');

CREATE POLICY "Authenticated users can upload bug evidence files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'bug-evidences' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their bug evidence files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'bug-evidences' AND auth.role() = 'authenticated');