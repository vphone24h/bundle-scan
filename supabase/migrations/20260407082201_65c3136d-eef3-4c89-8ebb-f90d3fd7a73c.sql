
-- Create function to check if user is company admin for a specific company
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_users
    WHERE user_id = _user_id
      AND platform_role = 'company_admin'
      AND (_company_id IS NULL OR company_id = _company_id)
  )
$$;

-- Create function to get company_id for a company admin
CREATE OR REPLACE FUNCTION public.get_admin_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.platform_users
  WHERE user_id = _user_id
    AND platform_role = 'company_admin'
  LIMIT 1
$$;
