import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';

export interface ReportStats {
  totalSalesRevenue: number; // Tổng doanh thu bán hàng
  totalReturnRevenue: number; // Tổng doanh thu trả hàng
  netRevenue: number; // Doanh thu thuần
  businessProfit: number; // Lợi nhuận kinh doanh (giá bán - giá nhập)
  totalExpenses: number; // Tổng chi phí
  otherIncome: number; // Thu nhập khác
  netProfit: number; // Lợi nhuận thuần
  // Chi tiết
  salesCount: number;
  returnCount: number;
  productsSold: number;
  productsReturned: number;
  // Theo nguồn tiền
  paymentsBySource: {
    cash: number;
    bank_card: number;
    e_wallet: number;
    debt: number;
  };
  // Chi tiết chi phí
  expensesByCategory: Record<string, number>;
  // Chi tiết theo danh mục sản phẩm
  profitByCategory: {
    categoryId: string;
    categoryName: string;
    revenue: number;
    profit: number;
    count: number;
  }[];
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
        } as ReportStats;
      }

      // Use local timezone for date filtering (same as Dashboard)
      const getLocalDateString = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      };
      
      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || getLocalDateString(now);
      
      // Create proper local timezone boundaries for queries
      const startDateTime = new Date(startDate + 'T00:00:00');
      const endDateTime = new Date(endDate + 'T23:59:59.999');
      const startISO = startDateTime.toISOString();
      const endISO = endDateTime.toISOString();

      // 1. Lấy dữ liệu phiếu xuất và sản phẩm đã bán (CHỈ status = 'sold')
      let exportQuery = supabase
        .from('export_receipts')
        .select(`
          id,
          total_amount,
          status,
          export_date,
          branch_id,
          export_receipt_items(
            id,
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

      // Apply branch filter (priority: UI filter > user's assigned branch)
      if (effectiveBranchId) {
        exportQuery = exportQuery.eq('branch_id', effectiveBranchId);
      }

      const { data: exportReceipts, error: exportError } = await exportQuery;
      if (exportError) throw exportError;

      // 2. Lấy dữ liệu trả hàng KHÔNG CÓ PHÍ để tính lợi nhuận âm
      let returnQuery = supabase
        .from('export_returns')
        .select(`
          id,
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

      const { data: returnItems, error: returnError } = await returnQuery;
      if (returnError) throw returnError;

      // 3. Lấy giá nhập của các sản phẩm đã bán / trả để tính lợi nhuận
      const productIds = Array.from(
        new Set([
          ...(exportReceipts?.flatMap(r => r.export_receipt_items?.map(i => i.product_id).filter(Boolean)) || []),
          ...(returnItems?.map((i: any) => i.product_id).filter(Boolean) || []),
        ])
      );

      let productsMap: Record<string, number> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, import_price, category_id')
          .in('id', productIds);
        
        productsMap = (products || []).reduce((acc, p) => {
          acc[p.id] = Number(p.import_price);
          return acc;
        }, {} as Record<string, number>);
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

      const { data: cashBookEntries, error: cashBookError } = await cashBookQuery;
      if (cashBookError) throw cashBookError;

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

      // Tính lợi nhuận từ bán hàng
      exportReceipts?.forEach(receipt => {
        if (receipt.status !== 'cancelled') {
          salesCount++;
          
          receipt.export_receipt_items?.forEach(item => {
            const salePrice = Number(item.sale_price);
            const importPrice = item.product_id ? (productsMap[item.product_id] || 0) : 0;
            
            if (filters?.categoryId && item.category_id !== filters.categoryId) {
              return;
            }

            if (item.status === 'sold' || item.status === 'returned') {
              totalSalesRevenue += salePrice;
              businessProfit += (salePrice - importPrice);
              productsSold++;

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
        const importPrice = item.product_id ? (productsMap[item.product_id] || 0) : 0;
        const profit = salePrice - importPrice;
        
        totalReturnRevenue += salePrice;
        businessProfit -= profit;
        productsReturned++;
        returnCount++;
      });

      // Tính chi phí và thu nhập khác từ sổ quỹ
      let totalExpenses = 0;
      let otherIncome = 0;
      const expensesByCategory: Record<string, number> = {};

      cashBookEntries?.forEach(entry => {
        const amount = Number(entry.amount);
        if (entry.type === 'expense') {
          totalExpenses += amount;
          expensesByCategory[entry.category] = (expensesByCategory[entry.category] || 0) + amount;
        } else if (entry.type === 'income') {
          otherIncome += amount;
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

      // Use local timezone for date filtering (same as Dashboard)
      const getLocalDateString = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      };
      
      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || getLocalDateString(now);
      
      // Create proper local timezone boundaries for queries
      const startDateTime = new Date(startDate + 'T00:00:00');
      const endDateTime = new Date(endDate + 'T23:59:59.999');
      const startISO = startDateTime.toISOString();
      const endISO = endDateTime.toISOString();

      let query = supabase
        .from('export_receipts')
        .select(`
          id,
          total_amount,
          export_date,
          status,
          export_receipt_items(sale_price, status, product_id)
        `)
        .gte('export_date', startISO)
        .lte('export_date', endISO)
        .neq('status', 'cancelled');

      if (effectiveBranchId) {
        query = query.eq('branch_id', effectiveBranchId);
      }

      const { data: receipts, error } = await query;
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

      const { data: returnItems, error: returnError } = await returnQuery;
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
        const { data: products } = await supabase
          .from('products')
          .select('id, import_price')
          .in('id', productIds);
        
        productsMap = (products || []).reduce((acc, p) => {
          acc[p.id] = Number(p.import_price);
          return acc;
        }, {} as Record<string, number>);
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
            const importPrice = item.product_id ? (productsMap[item.product_id] || 0) : 0;
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
        const importPrice = ret.product_id ? (productsMap[ret.product_id] || 0) : 0;
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
