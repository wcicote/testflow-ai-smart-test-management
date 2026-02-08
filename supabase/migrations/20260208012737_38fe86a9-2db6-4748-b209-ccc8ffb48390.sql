-- Create trigger function to auto-update test_case status when execution is recorded
CREATE OR REPLACE FUNCTION public.sync_test_case_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update the test_case status to match the execution status
    UPDATE public.test_cases
    SET status = NEW.status,
        updated_at = now()
    WHERE id = NEW.test_case_id;
    
    RETURN NEW;
END;
$$;

-- Create trigger to run after insert on test_executions
DROP TRIGGER IF EXISTS trigger_sync_test_case_status ON public.test_executions;
CREATE TRIGGER trigger_sync_test_case_status
    AFTER INSERT ON public.test_executions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_test_case_status();