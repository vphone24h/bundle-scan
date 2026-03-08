
-- 1. Add entity_code to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS entity_code text;

-- 2. Add entity_code to customers  
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS entity_code text;

-- 3. Create sequence-like function for supplier codes
CREATE OR REPLACE FUNCTION public.generate_supplier_entity_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next_num integer;
BEGIN
  IF NEW.entity_code IS NULL OR NEW.entity_code = '' THEN
    SELECT COALESCE(MAX(
      CASE WHEN entity_code ~ '^NCC-[0-9]+$' 
        THEN CAST(substring(entity_code from 5) AS integer)
        ELSE 0 
      END
    ), 0) + 1 INTO _next_num
    FROM public.suppliers
    WHERE tenant_id = NEW.tenant_id;
    
    NEW.entity_code := 'NCC-' || LPAD(_next_num::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create sequence-like function for customer codes
CREATE OR REPLACE FUNCTION public.generate_customer_entity_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next_num integer;
BEGIN
  IF NEW.entity_code IS NULL OR NEW.entity_code = '' THEN
    SELECT COALESCE(MAX(
      CASE WHEN entity_code ~ '^KH-[0-9]+$' 
        THEN CAST(substring(entity_code from 4) AS integer)
        ELSE 0 
      END
    ), 0) + 1 INTO _next_num
    FROM public.customers
    WHERE tenant_id = NEW.tenant_id;
    
    NEW.entity_code := 'KH-' || LPAD(_next_num::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Create triggers
CREATE TRIGGER trg_supplier_entity_code
  BEFORE INSERT ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_supplier_entity_code();

CREATE TRIGGER trg_customer_entity_code
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_customer_entity_code();

-- 6. Backfill existing suppliers
WITH numbered AS (
  SELECT id, tenant_id, 
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) as rn
  FROM public.suppliers
  WHERE entity_code IS NULL
)
UPDATE public.suppliers s
SET entity_code = 'NCC-' || LPAD(n.rn::text, 6, '0')
FROM numbered n
WHERE s.id = n.id;

-- 7. Backfill existing customers
WITH numbered AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) as rn
  FROM public.customers
  WHERE entity_code IS NULL
)
UPDATE public.customers c
SET entity_code = 'KH-' || LPAD(n.rn::text, 6, '0')
FROM numbered n
WHERE c.id = n.id;

-- 8. Create debt_offsets table
CREATE TABLE public.debt_offsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  customer_entity_id uuid NOT NULL,
  supplier_entity_id uuid NOT NULL,
  customer_name text NOT NULL,
  supplier_name text NOT NULL,
  customer_debt_before numeric NOT NULL DEFAULT 0,
  supplier_debt_before numeric NOT NULL DEFAULT 0,
  offset_amount numeric NOT NULL,
  customer_debt_after numeric NOT NULL DEFAULT 0,
  supplier_debt_after numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Enable RLS
ALTER TABLE public.debt_offsets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant debt offsets"
  ON public.debt_offsets FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert own tenant debt offsets"
  ON public.debt_offsets FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));
