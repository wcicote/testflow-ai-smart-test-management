-- Add new column
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'manual' CHECK (automation_status IN ('manual', 'automated', 'hybrid'));

-- Before we can change the check constraint, we need to update existing test_type data to match the new constraint
UPDATE public.test_cases SET test_type = 'functional' WHERE test_type IN ('manual', 'automated') OR test_type IS NULL;

-- Also update existing automation_status based on automation_script
UPDATE public.test_cases SET automation_status = CASE WHEN automation_script IS NOT NULL AND trim(automation_script) <> '' THEN 'automated' ELSE 'manual' END;

-- Drop the old constraint
ALTER TABLE public.test_cases DROP CONSTRAINT IF EXISTS test_cases_test_type_check;

-- Add the new constraint
ALTER TABLE public.test_cases ADD CONSTRAINT test_cases_test_type_check CHECK (test_type IN ('functional', 'security', 'performance', 'usability'));
