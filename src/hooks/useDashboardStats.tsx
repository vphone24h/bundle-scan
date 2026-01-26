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
      // Get products stats
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('status, import_price, quantity, imei');

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

      // Chỉ tính giá trị kho cho sản phẩm còn tồn (in_stock)
      // Loại trừ IMEI trùng lặp
      const processedImeis = new Set<string>();
      const inStockProducts = (products || []).filter(p => {
        if (p.status !== 'in_stock') return false;
        // Skip duplicate IMEIs
        if ((p as any).imei) {
          if (processedImeis.has((p as any).imei)) {
            return false;
          }
          processedImeis.add((p as any).imei);
        }
        return true;
      });
      
      const stats: DashboardStats = {
        totalProducts: products?.length || 0,
        inStockProducts: inStockProducts.length,
        soldProducts: products?.filter(p => p.status === 'sold').length || 0,
        // Tổng giá trị kho = sum(quantity * import_price) cho sản phẩm còn tồn (đã loại trừ trùng)
        totalImportValue: inStockProducts.reduce((sum, p) => {
          const quantity = (p as any).quantity || 1;
          return sum + (Number(p.import_price) * quantity);
        }, 0),
        pendingDebt: receipts?.reduce((sum, r) => sum + Number(r.debt_amount), 0) || 0,
        totalSuppliers: suppliersCount || 0,
        totalCategories: categoriesCount || 0,
        recentImports: recentCount || 0,
      };

      return stats;
    },
  });
}
