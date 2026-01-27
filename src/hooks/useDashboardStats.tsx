import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Get products stats - lấy thêm total_import_cost, name, sku, branch_id để tính đúng như Tồn kho
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('status, import_price, quantity, imei, total_import_cost, name, sku, branch_id');

      if (productsError) throw productsError;

      // Get suppliers count
      const { count: suppliersCount, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true });

      if (suppliersError) throw suppliersError;

      // Get categories count
      const { count: categoriesCount, error: categoriesError } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true });

      if (categoriesError) throw categoriesError;

      // Get pending debt
      const { data: receipts, error: receiptsError } = await supabase
        .from('import_receipts')
        .select('debt_amount')
        .eq('status', 'completed');

      if (receiptsError) throw receiptsError;

      // Get recent imports (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count: recentCount, error: recentError } = await supabase
        .from('import_receipts')
        .select('*', { count: 'exact', head: true })
        .gte('import_date', sevenDaysAgo.toISOString());

      if (recentError) throw recentError;

      // Tính giá trị kho ĐÚNG như logic ở useInventory
      // Gộp nhóm theo name + sku + branch_id, ưu tiên sản phẩm in_stock khi có IMEI trùng
      const inventoryMap = new Map<string, { stock: number; totalImportCost: number }>();
      // Track processed IMEIs with their status - prioritize 'in_stock' products
      const processedImeis = new Map<string, string>(); // imei -> status

      for (const product of (products || [])) {
        // Handle IMEI deduplication with priority for 'in_stock' status
        if (product.imei) {
          const existingStatus = processedImeis.get(product.imei);
          
          if (existingStatus) {
            // If we already have an 'in_stock' product with this IMEI, skip other statuses
            if (existingStatus === 'in_stock') continue;
            
            // If current product is 'in_stock' but we previously processed a 'sold' one,
            // we need to remove old entry and reprocess
            if (product.status === 'in_stock') {
              // Find and remove old entry's contribution
              const oldKey = `${product.name}|${product.sku}|${product.branch_id || 'no-branch'}`;
              const oldItem = inventoryMap.get(oldKey);
              if (oldItem) {
                // The old 'sold' product didn't contribute to stock anyway (status !== 'in_stock')
                // So we just need to update the IMEI tracking
              }
            } else {
              // Both are not 'in_stock', skip duplicate
              continue;
            }
          }
          
          processedImeis.set(product.imei, product.status);
        }

        const key = `${product.name}|${product.sku}|${product.branch_id || 'no-branch'}`;
        const existing = inventoryMap.get(key);

        if (product.imei) {
          // Sản phẩm có IMEI: mỗi IMEI = 1 đơn vị
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
          // Sản phẩm không IMEI: dùng quantity và total_import_cost
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

      // Tính tổng giá trị kho = tổng totalImportCost của các sản phẩm có stock > 0
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
  });
}
