-- Remove old cron job for platform email automations
SELECT cron.unschedule(7);

-- Create new cron job at 19:00 Vietnam time (12:00 UTC)
SELECT cron.schedule(
  'run-platform-email-automations-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url:='https://rodpbhesrwykmpywiiyd.supabase.co/functions/v1/run-platform-email-automations',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvZHBiaGVzcnd5a21weXdpaXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjM4MDMsImV4cCI6MjA4NDk5OTgwM30.P7Kc0pxkUdyHi8AgDBlRmPqxg0MWr2C_J_EUqORQY_s"}'::jsonb,
    body:='{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);