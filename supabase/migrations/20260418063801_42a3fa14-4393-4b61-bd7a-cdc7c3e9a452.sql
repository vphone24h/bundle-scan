-- Cho phép company_admin xem và duyệt payment_requests của các tenants thuộc công ty mình
CREATE POLICY "Company admins can view company payments"
ON public.payment_requests
FOR SELECT
TO authenticated
USING (
  public.is_company_admin(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = payment_requests.tenant_id
      AND t.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Company admins can update company payments"
ON public.payment_requests
FOR UPDATE
TO authenticated
USING (
  public.is_company_admin(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = payment_requests.tenant_id
      AND t.company_id = public.get_user_company_id()
  )
);