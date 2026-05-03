ALTER TABLE public.cash_book_categories
  DROP CONSTRAINT IF EXISTS cash_book_categories_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS cash_book_categories_tenant_name_type_key
  ON public.cash_book_categories (
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name),
    type
  );