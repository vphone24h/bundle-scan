
CREATE OR REPLACE FUNCTION public.get_public_reviews(_limit integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  customer_name text,
  rating integer,
  content text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    sr.id,
    sr.customer_name,
    sr.rating::integer,
    sr.content,
    sr.created_at
  FROM staff_reviews sr
  WHERE sr.rating >= 4
    AND sr.content IS NOT NULL
    AND sr.content != ''
  ORDER BY sr.created_at DESC
  LIMIT _limit;
$$;
