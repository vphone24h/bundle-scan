
-- Indexes for customers table to speed up CustomerListTab queries
CREATE INDEX IF NOT EXISTS idx_customers_tenant_created_at ON public.customers (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_preferred_branch ON public.customers (preferred_branch_id) WHERE preferred_branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_membership_tier ON public.customers (membership_tier);
CREATE INDEX IF NOT EXISTS idx_customers_crm_status ON public.customers (crm_status) WHERE crm_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_assigned_staff ON public.customers (assigned_staff_id) WHERE assigned_staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name_phone_search ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone_prefix ON public.customers (phone);

-- Index for customer_tag_assignments join
CREATE INDEX IF NOT EXISTS idx_customer_tag_assignments_tag_customer ON public.customer_tag_assignments (tag_id, customer_id);
