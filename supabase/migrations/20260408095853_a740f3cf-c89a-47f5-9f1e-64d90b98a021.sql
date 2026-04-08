-- Drop the OLD 5-param version that uses timestamptz types (this is the one that was NOT dropped before)
DROP FUNCTION IF EXISTS public.get_report_stats_aggregated(uuid, timestamptz, timestamptz, uuid, uuid);

-- Also drop the text version just in case (from previous failed attempt)
DROP FUNCTION IF EXISTS public.get_report_stats_aggregated(uuid, text, text, uuid, uuid);