-- Drop old cron jobs
SELECT cron.unschedule('daily-backup-all-tenants');
SELECT cron.unschedule('daily-backup-job');

-- Create a function that dispatches individual backup calls per tenant
CREATE OR REPLACE FUNCTION public.dispatch_daily_backups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_url TEXT;
  v_key TEXT;
  v_today TEXT;
BEGIN
  v_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
  v_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1);
  
  -- Get today's date in Vietnam timezone
  v_today := to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
  
  FOR rec IN SELECT id FROM tenants LOOP
    PERFORM net.http_post(
      url := v_url || '/functions/v1/daily-backup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object('tenantId', rec.id, 'date', v_today, 'mode', 'daily')
    );
  END LOOP;
END;
$$;

-- Schedule dispatcher at 23:59 Vietnam time (16:59 UTC)
SELECT cron.schedule(
  'daily-backup-dispatcher',
  '59 16 * * *',
  $$SELECT public.dispatch_daily_backups()$$
);
