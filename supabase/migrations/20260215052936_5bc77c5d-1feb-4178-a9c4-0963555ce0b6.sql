
-- Rate limiting table for edge functions
CREATE TABLE IF NOT EXISTS public.edge_function_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  ip_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.edge_function_rate_limits (function_name, ip_address, created_at DESC);

-- Auto-cleanup old records (older than 2 hours)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.edge_function_rate_limits WHERE created_at < now() - INTERVAL '2 hours';
$$;

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(_function_name text, _ip_address text, _max_requests integer, _window_minutes integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  -- Count recent requests
  SELECT COUNT(*) INTO _count
  FROM public.edge_function_rate_limits
  WHERE function_name = _function_name
    AND ip_address = _ip_address
    AND created_at > now() - (_window_minutes || ' minutes')::interval;

  IF _count >= _max_requests THEN
    RETURN false;
  END IF;

  -- Log this request
  INSERT INTO public.edge_function_rate_limits (function_name, ip_address)
  VALUES (_function_name, _ip_address);

  -- Periodic cleanup (1% chance per request)
  IF random() < 0.01 THEN
    PERFORM public.cleanup_rate_limits();
  END IF;

  RETURN true;
END;
$$;

-- No RLS needed - only accessed via SECURITY DEFINER functions
ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = no direct access from clients
