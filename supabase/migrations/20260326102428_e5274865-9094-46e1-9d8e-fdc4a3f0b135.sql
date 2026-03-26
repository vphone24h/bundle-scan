
-- Auto-merge branches: if same name + tenant exists, return existing instead of inserting
CREATE OR REPLACE FUNCTION public.auto_merge_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- Find existing branch with same name and tenant
  SELECT id INTO existing_id
  FROM public.branches
  WHERE tenant_id = NEW.tenant_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(NEW.name))
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- Update existing branch with new info if provided
    UPDATE public.branches SET
      phone = COALESCE(NULLIF(TRIM(NEW.phone), ''), phone),
      address = COALESCE(NULLIF(TRIM(NEW.address), ''), address),
      updated_at = now()
    WHERE id = existing_id;
    
    -- Return NULL to skip the insert
    RETURN NULL;
  END IF;

  -- No duplicate, proceed with insert
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_merge_branch
  BEFORE INSERT ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_merge_branch();

-- Auto-merge categories: if same name + tenant + parent exists, skip insert
CREATE OR REPLACE FUNCTION public.auto_merge_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
BEGIN
  SELECT id INTO existing_id
  FROM public.categories
  WHERE tenant_id = NEW.tenant_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(NEW.name))
    AND (parent_id IS NOT DISTINCT FROM NEW.parent_id)
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_merge_category
  BEFORE INSERT ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_merge_category();
