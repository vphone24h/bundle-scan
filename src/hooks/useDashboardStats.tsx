import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { getLocalDateString, getLocalDateRangeISO } from '@/lib/vietnamTime';

export interface DashboardStats {
  totalProducts: number;
  inStockProducts: number;
  soldProducts: number;
  totalImportValue: number;
  pendingDebt: number;
  totalStockQty: number;
  // Today stats
  todayProfit: number;
  todayRevenue: number;
  todaySold: number;
  todayImports: number;
}

export function useDashboardStats() {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    queryKey: ['dashboard-stats', tenant?.id, branchId, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) {
        return {
          totalProducts: 0, inStockProducts: 0, soldProducts: 0,
          totalImportValue: 0, pendingDebt: 0, totalStockQty: 0,
          todayProfit: 0, todayRevenue: 0, todaySold: 0, todayImports: 0,
        } as DashboardStats;
      }

      const todayStr = getLocalDateString();
      const { startISO: todayStartUTC, endISO: todayEndUTC } = getLocalDateRangeISO(todayStr, todayStr);
      const effectiveBranchId = shouldFilter && branchId ? branchId : null;

      let todayImportsQuery = supabase
        .from('import_receipts')
        .select('id', { count: 'exact' })
        .gte('import_date', todayStartUTC)
        .lte('import_date', todayEndUTC)
        .limit(0);

      if (effectiveBranchId) {
        todayImportsQuery = todayImportsQuery.eq('branch_id', effectiveBranchId);
      }

      // All 3 calls in parallel instead of sequential
      const [{ data: aggRaw }, { data: todayReportAgg, error: reportError }, { count: todayImportsCount, error: todayImportsError }] = await Promise.all([
        supabase.rpc('get_dashboard_aggregates', {
          p_tenant_id: tenant!.id,
          p_branch_id: effectiveBranchId,
        }),
        supabase.rpc('get_report_stats_aggregated' as any, {
          p_tenant_id: tenant!.id,
          p_start_iso: todayStartUTC,
          p_end_iso: todayEndUTC,
          p_branch_id: effectiveBranchId,
          p_category_id: null,
          p_is_repair: null,
        }),
        todayImportsQuery,
      ]);

      if (reportError) throw reportError;
      if (todayImportsError) throw todayImportsError;

      const agg = (aggRaw || {}) as Record<string, number>;
      const reportAgg = (todayReportAgg || {}) as Record<string, unknown>;

      return {
        totalProducts: agg.total || 0,
        inStockProducts: agg.in_stock || 0,
        soldProducts: agg.sold || 0,
        totalImportValue: Number(agg.total_import_value || 0),
        pendingDebt: Number(agg.pending_debt || 0),
        totalStockQty: Number(agg.total_stock_qty || 0),
        todayProfit: Number(reportAgg.netProfit || 0),
        todayRevenue: Number(reportAgg.netRevenue || 0),
        todaySold: Number(reportAgg.productsSold || 0),
        todayImports: todayImportsCount || 0,
      } as DashboardStats;
    },
    enabled: !isTenantLoading && !branchLoading,
    staleTime: 30 * 1000, // 30s — use cache on startup, refetch in background
    gcTime: 30 * 60 * 1000,
    placeholderData: (previous: any) => previous,
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,
    refetchOnMount: 'always',
  });
}

// Hook để lấy danh sách sản phẩm đã bán hôm nay
export function useTodaySoldProducts(enabled = true) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    queryKey: ['today-sold-products', tenant?.id, branchId],
    queryFn: async () => {
      const todayStr = getLocalDateString();
      const { startISO: todayStartUTC, endISO: todayEndUTC } = getLocalDateRangeISO(todayStr, todayStr);

      let exportReceiptsQuery = supabase
        .from('export_receipts')
        .select('id')
        .eq('status', 'completed')
        .gte('export_date', todayStartUTC)
        .lte('export_date', todayEndUTC);

      if (shouldFilter && branchId) {
        exportReceiptsQuery = exportReceiptsQuery.eq('branch_id', branchId);
      }

      const { data: todayReceipts, error: receiptsError } = await exportReceiptsQuery;
      if (receiptsError) throw receiptsError;

      const receiptIds = todayReceipts?.map(r => r.id) || [];
      if (receiptIds.length === 0) return [];

      const { data: soldItems, error: itemsError } = await supabase
        .from('export_receipt_items')
        .select('id, product_name, sku, imei, sale_price, created_at')
        .in('receipt_id', receiptIds)
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      return soldItems || [];
    },
    enabled: enabled && !isTenantLoading && !branchLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
}

// Lightweight hook: only fetch 5 recent products for Dashboard
export function useRecentProducts(limit = 5) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    queryKey: ['recent-products', tenant?.id, branchId, limit],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, import_price, status, categories(name)')
        .in('status', ['in_stock', 'sold'])
        .order('import_date', { ascending: false })
        .limit(limit);

      if (shouldFilter && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !isTenantLoading && !branchLoading,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previous) => previous,
  });
}

// Lightweight hook: only fetch 3 recent import receipts for Dashboard
export function useRecentImportReceipts(limit = 3) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    queryKey: ['recent-import-receipts', tenant?.id, branchId, limit],
    queryFn: async () => {
      let query = supabase
        .from('import_receipts')
        .select('id, code, import_date, total_amount, suppliers(name)')
        .order('import_date', { ascending: false })
        .limit(limit);

      if (shouldFilter && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !isTenantLoading && !branchLoading,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previous) => previous,
  });
}
