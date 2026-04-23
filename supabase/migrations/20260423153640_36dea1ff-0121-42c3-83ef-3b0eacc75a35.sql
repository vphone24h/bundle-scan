
CREATE OR REPLACE FUNCTION public.batch_update_display_order(
  _table_name text,
  _items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  _id uuid;
  _order int;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _id := (item->>'id')::uuid;
    _order := (item->>'display_order')::int;
    
    IF _table_name = 'landing_products' THEN
      UPDATE public.landing_products SET display_order = _order WHERE id = _id;
    ELSIF _table_name = 'landing_product_categories' THEN
      UPDATE public.landing_product_categories SET display_order = _order WHERE id = _id;
    ELSIF _table_name = 'landing_articles' THEN
      UPDATE public.landing_articles SET display_order = _order WHERE id = _id;
    ELSIF _table_name = 'landing_article_categories' THEN
      UPDATE public.landing_article_categories SET display_order = _order WHERE id = _id;
    END IF;
  END LOOP;
END;
$$;
