import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { getLocalDateString, getLocalDateRangeISO } from '@/lib/vietnamTime';

import type { SaleDetailItem, ReturnDetailItem, CashBookDetailItem } from '@/components/reports/ReportStatDetailDialog';

export interface ReportStats {
  totalSalesRevenue: number;
  totalReturnRevenue: number;
  netRevenue: number;
  businessProfit: number;
  totalExpenses: number;
  otherIncome: number;
  netProfit: number;
  salesCount: number;
  returnCount: number;
  productsSold: number;
  productsReturned: number;
  paymentsBySource: {
    cash: number;
    bank_card: number;
    e_wallet: number;
    debt: number;
  };
  expensesByCategory: Record<string, number>;
  profitByCategory: {
    categoryId: string;
    categoryName: string;
    revenue: number;
    profit: number;
    count: number;
  }[];
  // Raw detail data for popup (limited)
  salesDetails: SaleDetailItem[];
  returnDetails: ReturnDetailItem[];
  expenseDetails: CashBookDetailItem[];
  incomeDetails: CashBookDetailItem[];
}

export function useReportStats(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  categoryId?: string;
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    queryKey: ['report-stats', tenant?.id, effectiveBranchId, filters, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) {
        return {
          totalSalesRevenue: 0, totalReturnRevenue: 0, netRevenue: 0,
          businessProfit: 0, totalExpenses: 0, otherIncome: 0, netProfit: 0,
          salesCount: 0, returnCount: 0, productsSold: 0, productsReturned: 0,
          paymentsBySource: { cash: 0, bank_card: 0, e_wallet: 0, debt: 0 },
          expensesByCategory: {}, profitByCategory: [],
          salesDetails: [], returnDetails: [], expenseDetails: [], incomeDetails: [],
        } as ReportStats;
      }

      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || getLocalDateString(now);
      const { startISO, endISO } = getLocalDateRangeISO(startDate, endDate);

      // 1. Server-side aggregation via RPC (handles millions of rows)
      const { data: aggData, error: aggError } = await supabase.rpc(
        'get_report_stats_aggregated' as any,
        {
          p_tenant_id: tenant!.id,
          p_start_iso: startISO,
          p_end_iso: endISO,
          p_branch_id: effectiveBranchId || null,
          p_category_id: filters?.categoryId || null,
        }
      );

      if (aggError) throw aggError;

      const agg = (aggData || {}) as any;

      // 2. Fetch LIMITED detail data for click-to-detail popups (latest 200 items)
      let salesDetailQuery = supabase
        .from('export_receipt_items')
        .select(`
          product_name, sku, sale_price, status, product_id, category_id,
          categories(name),
          export_receipts!inner(export_date, branch_id, status),
          products(import_price)
        `)
        .in('status', ['sold', 'returned'])
        .neq('export_receipts.status', 'cancelled')
        .gte('export_receipts.export_date', startISO)
        .lte('export_receipts.export_date', endISO)
        .order('created_at', { ascending: false })
        .limit(200);

      if (effectiveBranchId) {
        salesDetailQuery = salesDetailQuery.eq('export_receipts.branch_id', effectiveBranchId);
      }
      if (filters?.categoryId) {
        salesDetailQuery = salesDetailQuery.eq('category_id', filters.categoryId);
      }

      let returnDetailQuery = supabase
        .from('export_returns')
        .select('product_name, imei, import_price, sale_price, return_date, branch_id, fee_type, product_id, products(import_price)')
        .eq('fee_type', 'none')
        .gte('return_date', startISO)
        .lte('return_date', endISO)
        .order('return_date', { ascending: false })
        .limit(200);

      if (effectiveBranchId) {
        returnDetailQuery = returnDetailQuery.eq('branch_id', effectiveBranchId);
      }

      let cashDetailQuery = supabase
        .from('cash_book')
        .select('transaction_date, description, category, amount, payment_source, type')
        .eq('is_business_accounting', true)
        .gte('transaction_date', startISO)
        .lte('transaction_date', endISO)
        .order('transaction_date', { ascending: false })
        .limit(200);

      if (effectiveBranchId) {
        cashDetailQuery = cashDetailQuery.eq('branch_id', effectiveBranchId);
      }

      const [{ data: salesRaw }, { data: returnsRaw }, { data: cashRaw }] = await Promise.all([
        salesDetailQuery,
        returnDetailQuery,
        cashDetailQuery,
      ]);

      // Build detail arrays for popup
      const salesDetails: SaleDetailItem[] = (salesRaw || []).map((item: any) => {
        const salePrice = Number(item.sale_price);
        const importPrice = Number(item.products?.import_price || 0);
        return {
          date: item.export_receipts?.export_date || '',
          productName: item.product_name || 'SP',
          sku: item.sku || '',
          salePrice,
          importPrice,
          profit: salePrice - importPrice,
          branchName: '',
          categoryName: item.categories?.name || 'Chưa phân loại',
        };
      });

      const returnDetails: ReturnDetailItem[] = (returnsRaw || []).map((item: any) => ({
        date: item.return_date,
        productName: item.product_name || 'Sản phẩm',
        imei: item.imei || null,
        salePrice: Number(item.sale_price),
        importPrice: Number(item.import_price || 0),
        profit: Number(item.sale_price) - Number(item.import_price || 0),
        branchName: '',
      }));

      const expenseDetails: CashBookDetailItem[] = [];
      const incomeDetails: CashBookDetailItem[] = [];
      (cashRaw || []).forEach((entry: any) => {
        const detail: CashBookDetailItem = {
          date: entry.transaction_date,
          description: entry.description,
          category: entry.category,
          amount: Number(entry.amount),
          paymentSource: entry.payment_source,
          branchName: '',
        };
        if (entry.type === 'expense') expenseDetails.push(detail);
        else if (entry.type === 'income') incomeDetails.push(detail);
      });

      return {
        totalSalesRevenue: Number(agg.totalSalesRevenue || 0),
        totalReturnRevenue: Number(agg.totalReturnRevenue || 0),
        netRevenue: Number(agg.netRevenue || 0),
        businessProfit: Number(agg.businessProfit || 0),
        totalExpenses: Number(agg.totalExpenses || 0),
        otherIncome: Number(agg.otherIncome || 0),
        netProfit: Number(agg.netProfit || 0),
        salesCount: Number(agg.salesCount || 0),
        returnCount: Number(agg.returnCount || 0),
        productsSold: Number(agg.productsSold || 0),
        productsReturned: Number(agg.productsReturned || 0),
        paymentsBySource: {
          cash: Number(agg.paymentsBySource?.cash || 0),
          bank_card: Number(agg.paymentsBySource?.bank_card || 0),
          e_wallet: Number(agg.paymentsBySource?.e_wallet || 0),
          debt: Number(agg.paymentsBySource?.debt || 0),
        },
        expensesByCategory: (agg.expensesByCategory || {}) as Record<string, number>,
        profitByCategory: ((agg.profitByCategory || []) as any[]).map(c => ({
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          revenue: Number(c.revenue || 0),
          profit: Number(c.profit || 0),
          count: Number(c.count || 0),
        })),
        salesDetails,
        returnDetails,
        expenseDetails,
        incomeDetails,
      } as ReportStats;
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}

// Hook để lấy dữ liệu biểu đồ theo thời gian - NOW USING SERVER-SIDE RPC
export function useReportChartData(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    queryKey: ['report-chart-data', tenant?.id, effectiveBranchId, filters, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) return [] as { date: string; revenue: number; profit: number; count: number }[];

      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || getLocalDateString(now);
      const { startISO, endISO } = getLocalDateRangeISO(startDate, endDate);

      const { data, error } = await supabase.rpc(
        'get_report_chart_aggregated' as any,
        {
          p_tenant_id: tenant!.id,
          p_start_iso: startISO,
          p_end_iso: endISO,
          p_branch_id: effectiveBranchId || null,
          p_group_by: filters?.groupBy || 'day',
        }
      );

      if (error) throw error;

      return ((data || []) as any[]).map(d => ({
        date: d.date,
        revenue: Number(d.revenue || 0),
        profit: Number(d.profit || 0),
        count: Number(d.count || 0),
      }));
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}
