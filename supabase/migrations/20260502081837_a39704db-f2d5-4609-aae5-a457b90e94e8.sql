ALTER TABLE public.salary_template_commissions
  ADD COLUMN IF NOT EXISTS count_in_revenue_kpi boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.salary_template_commissions.count_in_revenue_kpi IS
  'Khi only_self_sold=true: nếu cờ này = false, doanh số của các đơn tự bán SẼ KHÔNG được cộng vào userRevenue/branchRevenue dùng tính KPI thưởng cho NV.';