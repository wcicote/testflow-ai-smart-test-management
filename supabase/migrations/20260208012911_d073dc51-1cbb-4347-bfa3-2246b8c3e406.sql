-- Drop the existing check constraint on test_cases status
ALTER TABLE public.test_cases DROP CONSTRAINT IF EXISTS test_cases_status_check;

-- Add new check constraint with passed and failed as valid options
ALTER TABLE public.test_cases
ADD CONSTRAINT test_cases_status_check 
CHECK (status IN ('draft', 'ready', 'running', 'passed', 'failed'));