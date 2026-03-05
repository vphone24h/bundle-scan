import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { toVietnamDate } from '@/lib/vietnamTime';

export interface DashboardStats {
  totalProducts: number;
  inStockProducts: number;
  soldProducts: number;
  totalImportValue: number;
  pendingDebt: number;
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
          totalImportValue: 0, pendingDebt: 0, todayProfit: 0,
          todayRevenue: 0, todaySold: 0, todayImports: 0,
        } as DashboardStats;
      }

      // 1. Try reading today's stats from daily_stats (pre-computed every 5 min)
      let dailyStatsQuery = supabase
        .from('daily_stats')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('stat_date', new Date().toISOString().split('T')[0]);

      if (shouldFilter && branchId) {
        dailyStatsQuery = dailyStatsQuery.eq('branch_id', branchId);
      } else {
        dailyStatsQuery = dailyStatsQuery.is('branch_id', null);
      }

      const { data: dailyStats } = await dailyStatsQuery.maybeSingle();

      // 2. Single server-side RPC: counts + sums in one DB call
      const { data: aggRaw } = await supabase.rpc('get_dashboard_aggregates', {
        p_tenant_id: tenant!.id,
        p_branch_id: shouldFilter && branchId ? branchId : null,
      });

      const agg = (aggRaw || {}) as Record<string, number>;
      const inStockCount = agg.in_stock || 0;
      const totalProducts = agg.total || 0;
      const soldProducts = agg.sold || 0;
      const totalImportValue = Number(agg.total_import_value || 0);
      const pendingDebt = Number(agg.pending_debt || 0);

      // 5. Use daily_stats for today metrics, or fallback to quick queries
      let todayRevenue = 0, todayProfit = 0, todaySold = 0, todayImports = 0;

      if (dailyStats) {
        todayRevenue = Number(dailyStats.total_revenue) || 0;
        todayProfit = Number(dailyStats.total_profit) || 0;
        todaySold = Number(dailyStats.total_sold_items) || 0;
        todayImports = Number(dailyStats.total_imports) || 0;
      } else {
        // Fallback: quick server-side queries for today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        let exportQuery = supabase
          .from('export_receipts')
          .select('total_amount, status')
          .neq('status', 'cancelled')
          .gte('export_date', todayStart.toISOString())
          .lte('export_date', todayEnd.toISOString());

        if (shouldFilter && branchId) {
          exportQuery = exportQuery.eq('branch_id', branchId);
        }

        const { data: todayExports } = await exportQuery;
        todayRevenue = todayExports?.reduce((sum, r) => sum + Number(r.total_amount), 0) || 0;
        todaySold = todayExports?.length || 0;

        let todayImportsQuery = supabase
          .from('import_receipts')
          .select('*', { count: 'exact', head: true })
          .gte('import_date', todayStart.toISOString())
          .lte('import_date', todayEnd.toISOString());

        if (shouldFilter && branchId) {
          todayImportsQuery = todayImportsQuery.eq('branch_id', branchId);
        }

        const { count: todayImportsCount } = await todayImportsQuery;
        todayImports = todayImportsCount || 0;
      }

      return {
        totalProducts: totalProducts || 0,
        inStockProducts: inStockCount || 0,
        soldProducts: soldProducts || 0,
        totalImportValue,
        pendingDebt,
        todayProfit,
        todayRevenue,
        todaySold,
        todayImports,
      } as DashboardStats;
    },
    enabled: !isTenantLoading && !branchLoading,
    staleTime: 2 * 60 * 1000, // 2 min - reads from pre-computed daily_stats
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    placeholderData: (previous) => previous,
  });
}

// Hook để lấy danh sách sản phẩm đã bán hôm nay
export function useTodaySoldProducts() {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    queryKey: ['today-sold-products', tenant?.id, branchId],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      let exportReceiptsQuery = supabase
        .from('export_receipts')
        .select('id')
        .eq('status', 'completed')
        .gte('export_date', todayStart.toISOString())
        .lte('export_date', todayEnd.toISOString());

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
    enabled: !isTenantLoading && !branchLoading,
    staleTime: 2 * 60 * 1000, // 2 min cache
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
    staleTime: 2 * 60 * 1000,
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
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previous) => previous,
  });
}
