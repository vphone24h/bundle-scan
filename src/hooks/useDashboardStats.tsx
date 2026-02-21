import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';

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
    // Keyed by tenant AND branch to prevent cross-tenant/branch cache leakage
    queryKey: ['dashboard-stats', tenant?.id, branchId, isDataHidden],
    queryFn: async () => {
      // If data is hidden, return empty stats
      if (isDataHidden) {
        return {
          totalProducts: 0,
          inStockProducts: 0,
          soldProducts: 0,
          totalImportValue: 0,
          pendingDebt: 0,
          todayProfit: 0,
          todayRevenue: 0,
          todaySold: 0,
          todayImports: 0,
        } as DashboardStats;
      }

      // Get products stats - lấy thêm total_import_cost, name, sku, branch_id để tính đúng như Tồn kho
      let productsQuery = supabase
        .from('products')
        .select('id, status, import_price, quantity, imei, total_import_cost, name, sku, branch_id');

      // Apply branch filter for non-Super Admin users
      if (shouldFilter && branchId) {
        productsQuery = productsQuery.eq('branch_id', branchId);
      }

      const { data: products, error: productsError } = await productsQuery;

      if (productsError) throw productsError;

      // Get today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      const todayDateStr = todayStart.toISOString().split('T')[0];

      // Get today's export receipts (for revenue and sold count)
      let exportReceiptsQuery = supabase
        .from('export_receipts')
        .select(`
          id,
          total_amount,
          export_date,
          status,
          export_receipt_items(
            id,
            sale_price,
            status,
            product_id
          )
        `)
        .gte('export_date', todayStart.toISOString())
        .lte('export_date', todayEnd.toISOString());

      if (shouldFilter && branchId) {
        exportReceiptsQuery = exportReceiptsQuery.eq('branch_id', branchId);
      }

      const { data: todayExportReceipts, error: exportReceiptsError } = await exportReceiptsQuery;
      if (exportReceiptsError) throw exportReceiptsError;

      // Get today's returns WITHOUT fee (to subtract profit)
      let returnQuery = supabase
        .from('export_returns')
        .select('id, import_price, sale_price, product_id, fee_type')
        .eq('fee_type', 'none')
        .gte('return_date', todayStart.toISOString())
        .lte('return_date', todayEnd.toISOString());

      if (shouldFilter && branchId) {
        returnQuery = returnQuery.eq('branch_id', branchId);
      }

      const { data: todayReturns, error: returnError } = await returnQuery;
      if (returnError) throw returnError;

      // Get import prices for sold items to calculate profit
      const productIds = Array.from(new Set([
        ...(todayExportReceipts?.flatMap(r => r.export_receipt_items?.map(i => i.product_id).filter(Boolean)) || []),
        ...(todayReturns?.map(r => r.product_id).filter(Boolean) || []),
      ]));
      
      let productImportPrices: Record<string, number> = {};
      
      if (productIds.length > 0) {
        const { data: soldProducts, error: soldProductsError } = await supabase
          .from('products')
          .select('id, import_price')
          .in('id', productIds);
        
        if (soldProductsError) throw soldProductsError;
        productImportPrices = (soldProducts || []).reduce((acc, p) => {
          acc[p.id] = Number(p.import_price);
          return acc;
        }, {} as Record<string, number>);
      }

      // Calculate today's business profit from sales
      let todayBusinessProfit = 0;
      let todaySold = 0;
      let todayRevenue = 0;

      todayExportReceipts?.forEach(receipt => {
        if (receipt.status !== 'cancelled') {
          todayRevenue += Number(receipt.total_amount);
          
          receipt.export_receipt_items?.forEach(item => {
            if (item.status === 'sold' || item.status === 'returned') {
              const salePrice = Number(item.sale_price);
              const importPrice = item.product_id ? (productImportPrices[item.product_id] || 0) : 0;
              todayBusinessProfit += (salePrice - importPrice);
              todaySold++;
            }
          });
        }
      });

      // Subtract profit from returns without fee
      todayReturns?.forEach(ret => {
        const salePrice = Number(ret.sale_price);
        const importPrice = ret.product_id ? (productImportPrices[ret.product_id] || 0) : 0;
        const originalProfit = salePrice - importPrice;
        todayBusinessProfit -= originalProfit;
      });

      // Get today's cash book entries (expenses and other income with is_business_accounting = true)
      let cashBookQuery = supabase
        .from('cash_book')
        .select('type, amount')
        .eq('is_business_accounting', true)
        .gte('transaction_date', todayStart.toISOString())
        .lte('transaction_date', todayEnd.toISOString());

      if (shouldFilter && branchId) {
        cashBookQuery = cashBookQuery.eq('branch_id', branchId);
      }

      const { data: cashBookEntries, error: cashBookError } = await cashBookQuery;
      if (cashBookError) throw cashBookError;

      let todayExpenses = 0;
      let todayOtherIncome = 0;

      cashBookEntries?.forEach(entry => {
        const amount = Number(entry.amount);
        if (entry.type === 'expense') {
          todayExpenses += amount;
        } else if (entry.type === 'income') {
          todayOtherIncome += amount;
        }
      });

      // Calculate NET PROFIT same as Reports: (Business Profit + Other Income) - Expenses
      const todayProfit = (todayBusinessProfit + todayOtherIncome) - todayExpenses;

      // Get today's imports count
      let todayImportsQuery = supabase
        .from('import_receipts')
        .select('*', { count: 'exact', head: true })
        .gte('import_date', todayStart.toISOString())
        .lte('import_date', todayEnd.toISOString());

      if (shouldFilter && branchId) {
        todayImportsQuery = todayImportsQuery.eq('branch_id', branchId);
      }

      const { count: todayImportsCount, error: todayImportsError } = await todayImportsQuery;
      if (todayImportsError) throw todayImportsError;

      // Get pending debt with branch filter
      let receiptsQuery = supabase
        .from('import_receipts')
        .select('debt_amount')
        .eq('status', 'completed');

      if (shouldFilter && branchId) {
        receiptsQuery = receiptsQuery.eq('branch_id', branchId);
      }

      const { data: receipts, error: receiptsError } = await receiptsQuery;

      if (receiptsError) throw receiptsError;

      // Lấy chi phí thực từ product_imports cho non-IMEI (đồng bộ với useInventory)
      const nonImeiProductIds = (products || [])
        .filter(p => !p.imei && p.status === 'in_stock')
        .map(p => p.id);

      let piCostMap = new Map<string, { totalCost: number; totalQty: number }>();
      if (nonImeiProductIds.length > 0) {
        const { data: piData } = await supabase
          .from('product_imports')
          .select('product_id, import_price, quantity')
          .in('product_id', nonImeiProductIds);

        if (piData && piData.length > 0) {
          for (const pi of piData) {
            const existing = piCostMap.get(pi.product_id);
            const cost = (pi.quantity || 1) * (pi.import_price || 0);
            if (existing) {
              existing.totalCost += cost;
              existing.totalQty += (pi.quantity || 1);
            } else {
              piCostMap.set(pi.product_id, { totalCost: cost, totalQty: pi.quantity || 1 });
            }
          }
        }
      }

      // Override total_import_cost = currentQty × avgPrice (đồng bộ useInventory)
      const correctedProducts = (products || []).map(p => {
        if (!p.imei && piCostMap.has(p.id)) {
          const piCost = piCostMap.get(p.id)!;
          const avgPrice = piCost.totalQty > 0 ? piCost.totalCost / piCost.totalQty : Number(p.import_price);
          const currentQty = p.quantity || 0;
          return { ...p, total_import_cost: currentQty * avgPrice, import_price: avgPrice };
        }
        return p;
      });

      // Tính giá trị kho ĐÚNG như logic ở useInventory
      const inventoryMap = new Map<string, { stock: number; totalImportCost: number }>();
      const processedImeis = new Map<string, string>();

      for (const product of correctedProducts) {
        if (product.imei) {
          const existingStatus = processedImeis.get(product.imei);
          
          if (existingStatus) {
            if (existingStatus === 'in_stock') continue;
            if (product.status === 'in_stock') {
              // Process this one instead
            } else {
              continue;
            }
          }
          
          processedImeis.set(product.imei, product.status);
        }

        const key = `${product.name}|${product.sku}|${product.branch_id || 'no-branch'}`;
        const existing = inventoryMap.get(key);

        if (product.imei) {
          if (existing) {
            if (product.status === 'in_stock') {
              existing.stock += 1;
              existing.totalImportCost += Number(product.import_price);
            }
          } else {
            inventoryMap.set(key, {
              stock: product.status === 'in_stock' ? 1 : 0,
              totalImportCost: product.status === 'in_stock' ? Number(product.import_price) : 0,
            });
          }
        } else {
          const quantity = product.quantity || 1;
          const totalCost = Number(product.total_import_cost || (product.import_price * quantity));

          if (existing) {
            if (product.status === 'in_stock') {
              existing.stock += quantity;
              existing.totalImportCost += totalCost;
            }
          } else {
            inventoryMap.set(key, {
              stock: product.status === 'in_stock' ? quantity : 0,
              totalImportCost: product.status === 'in_stock' ? totalCost : 0,
            });
          }
        }
      }

      let totalImportValue = 0;
      let inStockCount = 0;
      inventoryMap.forEach((item) => {
        if (item.stock > 0) {
          totalImportValue += item.totalImportCost;
          inStockCount += item.stock;
        }
      });

      const stats: DashboardStats = {
        totalProducts: products?.length || 0,
        inStockProducts: inStockCount,
        soldProducts: products?.filter(p => p.status === 'sold').length || 0,
        totalImportValue,
        pendingDebt: receipts?.reduce((sum, r) => sum + Number(r.debt_amount), 0) || 0,
        todayProfit,
        todayRevenue,
        todaySold,
        todayImports: todayImportsCount || 0,
      };

      return stats;
    },
    // Chờ tenant data và branch filter sẵn sàng
    enabled: !isTenantLoading && !branchLoading,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    // Keep previous stats to avoid blank screen + spinner during transient refetches
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
      // Get today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get today's completed export receipts
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

      // Get sold items from today's receipts
      const { data: soldItems, error: itemsError } = await supabase
        .from('export_receipt_items')
        .select('id, product_name, sku, imei, sale_price, created_at')
        .in('receipt_id', receiptIds)
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      return soldItems || [];
    },
    enabled: !isTenantLoading && !branchLoading,
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
