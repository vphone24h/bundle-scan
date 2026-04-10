-- Create security definer function to check if company has override config
CREATE OR REPLACE FUNCTION public.company_has_payment_config_key(
  _company_id uuid,
  _config_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payment_config
    WHERE company_id = _company_id
      AND config_key = _config_key
  );
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view payment config for their scope" ON public.payment_config;

-- Recreate without self-referencing subquery
CREATE POLICY "Users can view payment config for their scope"
ON public.payment_config
FOR SELECT
USING (
  (company_id IS NULL AND (is_platform_admin(auth.uid()) OR get_user_company_id() IS NULL))
  OR (company_id = get_user_company_id())
  OR (company_id IS NULL AND NOT company_has_payment_config_key(get_user_company_id(), config_key))
);