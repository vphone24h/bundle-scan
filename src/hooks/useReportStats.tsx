import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { getLocalDateString, getLocalDateRangeISO } from '@/lib/vietnamTime';
import { fetchAllRows } from '@/lib/fetchAllRows';

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
  // Raw detail data for popup
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

  // Determine effective branch filter
  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    // Keyed by tenant AND branch to prevent cross-tenant/branch cache leakage
    queryKey: ['report-stats', tenant?.id, effectiveBranchId, filters, isDataHidden],
    queryFn: async () => {
      // Chế độ test: trả về dữ liệu rỗng
      if (isDataHidden) {
        return {
          totalSalesRevenue: 0,
          totalReturnRevenue: 0,
          netRevenue: 0,
          businessProfit: 0,
          totalExpenses: 0,
          otherIncome: 0,
          netProfit: 0,
          salesCount: 0,
          returnCount: 0,
          productsSold: 0,
          productsReturned: 0,
          paymentsBySource: { cash: 0, bank_card: 0, e_wallet: 0, debt: 0 },
          expensesByCategory: {},
          profitByCategory: [],
          salesDetails: [],
          returnDetails: [],
          expenseDetails: [],
          incomeDetails: [],
        } as ReportStats;
      }

      // Use browser local timezone for date filtering
      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || getLocalDateString(now);
      
      // Create proper local timezone boundaries for queries
      const { startISO, endISO } = getLocalDateRangeISO(startDate, endDate);

      const buildExportQuery = () => {
        let q = supabase
          .from('export_receipts')
          .select(`
            id,
            total_amount,
            status,
            export_date,
            branch_id,
            export_receipt_items(
              id,
              product_name,
              sku,
              imei,
              sale_price,
              status,
              product_id,
              category_id,
              categories(name)
            ),
            export_receipt_payments(
              payment_type,
              amount
            )
          `)
          .gte('export_date', startISO)
          .lte('export_date', endISO);

        if (effectiveBranchId) {
          q = q.eq('branch_id', effectiveBranchId);
        }
        return q;
      };

      const exportReceipts = await fetchAllRows<any>(() => buildExportQuery());

      // 2. Lấy dữ liệu trả hàng KHÔNG CÓ PHÍ để tính lợi nhuận âm
      let returnQuery = supabase
        .from('export_returns')
        .select(`
          id,
          product_name,
          imei,
          import_price,
          sale_price,
          return_date,
          branch_id,
          product_id,
          fee_type
        `)
        .eq('fee_type', 'none')
        .gte('return_date', startISO)
        .lte('return_date', endISO);

      if (effectiveBranchId) {
        returnQuery = returnQuery.eq('branch_id', effectiveBranchId);
      }

      const returnItems = await fetchAllRows<any>(() => returnQuery);

      // 3. Lấy giá nhập của các sản phẩm đã bán / trả để tính lợi nhuận
      const productIds = Array.from(
        new Set([
          ...(exportReceipts?.flatMap(r => r.export_receipt_items?.map(i => i.product_id).filter(Boolean)) || []),
          ...(returnItems?.map((i: any) => i.product_id).filter(Boolean) || []),
        ])
      );

      let productsMap: Record<string, number> = {};
      if (productIds.length > 0) {
        // Chunk to avoid 1000-row limit
        for (let i = 0; i < productIds.length; i += 500) {
          const chunk = productIds.slice(i, i + 500);
          const { data: products } = await supabase
            .from('products')
            .select('id, import_price, category_id')
            .in('id', chunk);
          
          (products || []).forEach(p => {
            productsMap[p.id] = Number(p.import_price);
          });
        }
      }

      // For items without product_id, try to find import price by IMEI
      const orphanImeis = Array.from(new Set(
        exportReceipts?.flatMap(r => 
          r.export_receipt_items?.filter(i => !i.product_id && i.imei).map(i => i.imei as string) || []
        ) || []
      ));
      let imeiPriceMap: Record<string, number> = {};
      if (orphanImeis.length > 0) {
        for (let i = 0; i < orphanImeis.length; i += 500) {
          const chunk = orphanImeis.slice(i, i + 500);
          const { data: imeiProducts } = await supabase
            .from('products')
            .select('imei, import_price')
            .in('imei', chunk)
            .gt('import_price', 0);
          imeiProducts?.forEach(p => {
            if (p.imei && p.import_price) {
              imeiPriceMap[p.imei] = Number(p.import_price);
            }
          });
        }
      }

      // 4. Lấy dữ liệu sổ quỹ (chi phí và thu nhập khác)
      let cashBookQuery = supabase
        .from('cash_book')
        .select('*')
        .eq('is_business_accounting', true)
        .gte('transaction_date', startISO)
        .lte('transaction_date', endISO);

      if (effectiveBranchId) {
        cashBookQuery = cashBookQuery.eq('branch_id', effectiveBranchId);
      }

      const cashBookEntries = await fetchAllRows<any>(() => cashBookQuery);

      // Tính toán các chỉ số
      let totalSalesRevenue = 0;
      let totalReturnRevenue = 0;
      let businessProfit = 0;
      let salesCount = 0;
      let returnCount = 0;
      let productsSold = 0;
      let productsReturned = 0;
      const paymentsBySource = { cash: 0, bank_card: 0, e_wallet: 0, debt: 0 };
      const profitByCategoryMap: Record<string, { categoryName: string; revenue: number; profit: number; count: number }> = {};
      const salesDetails: SaleDetailItem[] = [];
      const returnDetails: ReturnDetailItem[] = [];
      const expenseDetails: CashBookDetailItem[] = [];
      const incomeDetails: CashBookDetailItem[] = [];

      // Tính lợi nhuận từ bán hàng
      exportReceipts?.forEach(receipt => {
        if (receipt.status !== 'cancelled') {
          salesCount++;
          
          receipt.export_receipt_items?.forEach(item => {
            const salePrice = Number(item.sale_price);
            const importPrice = item.product_id
              ? (productsMap[item.product_id] || 0)
              : (item.imei ? (imeiPriceMap[item.imei] || 0) : 0);
            
            if (filters?.categoryId && item.category_id !== filters.categoryId) {
              return;
            }

            if (item.status === 'sold' || item.status === 'returned') {
              totalSalesRevenue += salePrice;
              businessProfit += (salePrice - importPrice);
              productsSold++;

              salesDetails.push({
                date: receipt.export_date,
                productName: (item as any).product_name || 'SP',
                sku: (item as any).sku || '',
                salePrice,
                importPrice,
                profit: salePrice - importPrice,
                branchName: '',
                categoryName: item.categories?.name || 'Chưa phân loại',
              });

              const catId = item.category_id || 'uncategorized';
              const catName = item.categories?.name || 'Chưa phân loại';
              if (!profitByCategoryMap[catId]) {
                profitByCategoryMap[catId] = { categoryName: catName, revenue: 0, profit: 0, count: 0 };
              }
              profitByCategoryMap[catId].revenue += salePrice;
              profitByCategoryMap[catId].profit += (salePrice - importPrice);
              profitByCategoryMap[catId].count++;
            }
          });

          receipt.export_receipt_payments?.forEach(payment => {
            const amount = Number(payment.amount);
            const source = payment.payment_type as keyof typeof paymentsBySource;
            if (paymentsBySource.hasOwnProperty(source)) {
              paymentsBySource[source] += amount;
            }
          });
        }
      });

      // Tính lợi nhuận âm từ trả hàng
      returnItems?.forEach((item: any) => {
        const salePrice = Number(item.sale_price);
        const importPrice = item.product_id
          ? (productsMap[item.product_id] || 0)
          : (item.imei ? (imeiPriceMap[item.imei] || 0) : 0);
        const profit = salePrice - importPrice;
        
        totalReturnRevenue += salePrice;
        businessProfit -= profit;
        productsReturned++;
        returnCount++;

        returnDetails.push({
          date: item.return_date,
          productName: item.product_name || 'Sản phẩm',
          imei: item.imei || null,
          salePrice,
          importPrice,
          profit,
          branchName: '',
        });
      });

      // Tính chi phí và thu nhập khác từ sổ quỹ
      let totalExpenses = 0;
      let otherIncome = 0;
      const expensesByCategory: Record<string, number> = {};

      cashBookEntries?.forEach(entry => {
        const amount = Number(entry.amount);
        const detailItem: CashBookDetailItem = {
          date: entry.transaction_date,
          description: entry.description,
          category: entry.category,
          amount,
          paymentSource: entry.payment_source,
          branchName: '',
        };
        if (entry.type === 'expense') {
          totalExpenses += amount;
          expensesByCategory[entry.category] = (expensesByCategory[entry.category] || 0) + amount;
          expenseDetails.push(detailItem);
        } else if (entry.type === 'income') {
          otherIncome += amount;
          incomeDetails.push(detailItem);
        }
      });

      const netRevenue = totalSalesRevenue - totalReturnRevenue;
      const netProfit = (businessProfit + otherIncome) - totalExpenses;

      const profitByCategory = Object.entries(profitByCategoryMap).map(([categoryId, data]) => ({
        categoryId,
        ...data,
      })).sort((a, b) => b.profit - a.profit);

      return {
        totalSalesRevenue,
        totalReturnRevenue,
        netRevenue,
        businessProfit,
        totalExpenses,
        otherIncome,
        netProfit,
        salesCount,
        returnCount,
        productsSold,
        productsReturned,
        paymentsBySource,
        expensesByCategory,
        profitByCategory,
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

// Hook để lấy dữ liệu biểu đồ theo thời gian
export function useReportChartData(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  // Determine effective branch filter
  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    // Keyed by tenant AND branch to prevent cross-tenant/branch cache leakage
    queryKey: ['report-chart-data', tenant?.id, effectiveBranchId, filters, isDataHidden],
    queryFn: async () => {
      // Chế độ test: trả về dữ liệu rỗng
      if (isDataHidden) return [] as { date: string; revenue: number; profit: number; count: number }[];

      // Use browser local timezone for date filtering
      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || getLocalDateString(now);
      
      // Create proper local timezone boundaries for queries
      const { startISO, endISO } = getLocalDateRangeISO(startDate, endDate);

      let query = supabase
        .from('export_receipts')
        .select(`
          id,
          total_amount,
          export_date,
          status,
          export_receipt_items(sale_price, status, product_id, imei)
        `)
        .gte('export_date', startISO)
        .lte('export_date', endISO)
        .neq('status', 'cancelled');

      if (effectiveBranchId) {
        query = query.eq('branch_id', effectiveBranchId);
      }

      const { data: receipts, error } = await query.limit(5000);
      if (error) throw error;

      // Lấy trả hàng KHÔNG CÓ PHÍ để trừ lợi nhuận
      let returnQuery = supabase
        .from('export_returns')
        .select('id, sale_price, import_price, return_date, branch_id, fee_type, product_id')
        .eq('fee_type', 'none')
        .gte('return_date', startISO)
        .lte('return_date', endISO);

      if (effectiveBranchId) {
        returnQuery = returnQuery.eq('branch_id', effectiveBranchId);
      }

      const { data: returnItems, error: returnError } = await returnQuery.limit(5000);
      if (returnError) throw returnError;

      // Lấy giá nhập
      const productIds = Array.from(
        new Set([
          ...(receipts?.flatMap(r => r.export_receipt_items?.map(i => i.product_id).filter(Boolean)) || []),
          ...(returnItems?.map((i: any) => i.product_id).filter(Boolean) || []),
        ])
      );

      let productsMap: Record<string, number> = {};
      if (productIds.length > 0) {
        for (let i = 0; i < productIds.length; i += 500) {
          const chunk = productIds.slice(i, i + 500);
          const { data: products } = await supabase
            .from('products')
            .select('id, import_price')
            .in('id', chunk);
          
          (products || []).forEach(p => {
            productsMap[p.id] = Number(p.import_price);
          });
        }
      }

      // IMEI fallback for orphan items
      const chartOrphanImeis = Array.from(new Set(
        receipts?.flatMap(r =>
          r.export_receipt_items?.filter(i => !i.product_id && i.imei).map(i => i.imei as string) || []
        ) || []
      ));
      let chartImeiPriceMap: Record<string, number> = {};
      if (chartOrphanImeis.length > 0) {
        for (let i = 0; i < chartOrphanImeis.length; i += 500) {
          const chunk = chartOrphanImeis.slice(i, i + 500);
          const { data: imeiProducts } = await supabase
            .from('products')
            .select('imei, import_price')
            .in('imei', chunk)
            .gt('import_price', 0);
          imeiProducts?.forEach(p => {
            if (p.imei && p.import_price) {
              chartImeiPriceMap[p.imei] = Number(p.import_price);
            }
          });
        }
      }

      // Nhóm dữ liệu theo ngày/tuần/tháng
      const groupBy = filters?.groupBy || 'day';
      const dataMap: Record<string, { date: string; revenue: number; profit: number; count: number }> = {};

      const getKey = (d: Date) => {
        if (groupBy === 'day') return d.toISOString().split('T')[0];
        if (groupBy === 'week') {
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          return weekStart.toISOString().split('T')[0];
        }
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };

      receipts?.forEach(receipt => {
        const date = new Date(receipt.export_date);
        const key = getKey(date);

        if (!dataMap[key]) {
          dataMap[key] = { date: key, revenue: 0, profit: 0, count: 0 };
        }

        receipt.export_receipt_items?.forEach(item => {
          if (item.status === 'sold' || item.status === 'returned') {
            const salePrice = Number(item.sale_price);
            const importPrice = item.product_id
              ? (productsMap[item.product_id] || 0)
              : (item.imei ? (chartImeiPriceMap[item.imei] || 0) : 0);
            dataMap[key].revenue += salePrice;
            dataMap[key].profit += (salePrice - importPrice);
            dataMap[key].count++;
          }
        });
      });

      // Trừ dữ liệu trả hàng
      returnItems?.forEach((ret: any) => {
        const date = new Date(ret.return_date);
        const key = getKey(date);
        if (!dataMap[key]) {
          dataMap[key] = { date: key, revenue: 0, profit: 0, count: 0 };
        }

        const salePrice = Number(ret.sale_price);
        const importPrice = ret.product_id
          ? (productsMap[ret.product_id] || 0)
          : (ret.imei ? (chartImeiPriceMap[ret.imei] || 0) : 0);
        const originalProfit = salePrice - importPrice;

        dataMap[key].profit -= originalProfit;
        dataMap[key].count += 1;
      });

      return Object.values(dataMap).sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}
