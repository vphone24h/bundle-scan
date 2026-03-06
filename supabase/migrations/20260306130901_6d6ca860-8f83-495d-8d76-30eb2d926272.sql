
-- Drop the OLD overload that reads from stale materialized view
DROP FUNCTION IF EXISTS public.get_customer_debt_summary(uuid);

-- Drop stale materialized view if exists
DROP MATERIALIZED VIEW IF EXISTS public.mv_customer_debt;
