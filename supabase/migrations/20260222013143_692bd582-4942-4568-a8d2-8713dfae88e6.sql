
-- Fix: Add authenticated read policy for automation_execution_logs
CREATE POLICY "Authenticated users can read own logs"
  ON public.automation_execution_logs FOR SELECT
  USING (auth.uid() = user_id);
