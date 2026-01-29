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
  totalSuppliers: number;
  totalCategories: number;
  recentImports: number;
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
          totalSuppliers: 0,
          totalCategories: 0,
          recentImports: 0,
        } as DashboardStats;
      }

      // Get products stats - lấy thêm total_import_cost, name, sku, branch_id để tính đúng như Tồn kho
      let productsQuery = supabase
        .from('products')
        .select('status, import_price, quantity, imei, total_import_cost, name, sku, branch_id');

      // Apply branch filter for non-Super Admin users
      if (shouldFilter && branchId) {
        productsQuery = productsQuery.eq('branch_id', branchId);
      }

      const { data: products, error: productsError } = await productsQuery;

      if (productsError) throw productsError;

      // Get suppliers count (no branch filter - global data)
      const { count: suppliersCount, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true });

      if (suppliersError) throw suppliersError;

      // Get categories count (no branch filter - global data)
      const { count: categoriesCount, error: categoriesError } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true });

      if (categoriesError) throw categoriesError;

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

      // Get recent imports (last 7 days) with branch filter
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      let recentQuery = supabase
        .from('import_receipts')
        .select('*', { count: 'exact', head: true })
        .gte('import_date', sevenDaysAgo.toISOString());

      if (shouldFilter && branchId) {
        recentQuery = recentQuery.eq('branch_id', branchId);
      }

      const { count: recentCount, error: recentError } = await recentQuery;

      if (recentError) throw recentError;

      // Tính giá trị kho ĐÚNG như logic ở useInventory
      const inventoryMap = new Map<string, { stock: number; totalImportCost: number }>();
      const processedImeis = new Map<string, string>();

      for (const product of (products || [])) {
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
        totalSuppliers: suppliersCount || 0,
        totalCategories: categoriesCount || 0,
        recentImports: recentCount || 0,
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
