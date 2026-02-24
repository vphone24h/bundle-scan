-- Drop the OLD 2-parameter SQL version that conflicts with the newer 3-parameter plpgsql version
DROP FUNCTION IF EXISTS public.lookup_warranty_by_imei(text, uuid);
