import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InventoryItem {
  productName: string;
  sku: string;
  branchId: string | null;
  branchName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  hasImei: boolean;
  totalImported: number;
  totalSold: number;
  stock: number;
  products: ProductDetail[];
}

export interface ProductDetail {
  id: string;
  name: string;
  sku: string;
  imei: string | null;
  importPrice: number;
  importDate: string;
  supplierId: string | null;
  supplierName: string | null;
  branchId: string | null;
  branchName: string | null;
  status: 'in_stock' | 'sold' | 'returned';
}

export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name),
          suppliers(name),
          branches(name)
        `)
        .order('name', { ascending: true });

      if (error) throw error;

      // Group products by name + sku + branch_id
      const inventoryMap = new Map<string, InventoryItem>();

      products?.forEach((product) => {
        const key = `${product.name}|${product.sku}|${product.branch_id || 'no-branch'}`;
        
        const existing = inventoryMap.get(key);
        
        const productDetail: ProductDetail = {
          id: product.id,
          name: product.name,
          sku: product.sku,
          imei: product.imei,
          importPrice: product.import_price,
          importDate: product.import_date,
          supplierId: product.supplier_id,
          supplierName: product.suppliers?.name || null,
          branchId: product.branch_id,
          branchName: product.branches?.name || null,
          status: product.status,
        };

        if (existing) {
          existing.totalImported += 1;
          if (product.status === 'sold') {
            existing.totalSold += 1;
          }
          existing.stock = existing.totalImported - existing.totalSold;
          existing.products.push(productDetail);
          // Check if any product has IMEI
          if (product.imei) {
            existing.hasImei = true;
          }
        } else {
          inventoryMap.set(key, {
            productName: product.name,
            sku: product.sku,
            branchId: product.branch_id,
            branchName: product.branches?.name || null,
            categoryId: product.category_id,
            categoryName: product.categories?.name || null,
            hasImei: !!product.imei,
            totalImported: 1,
            totalSold: product.status === 'sold' ? 1 : 0,
            stock: product.status === 'sold' ? 0 : 1,
            products: [productDetail],
          });
        }
      });

      return Array.from(inventoryMap.values());
    },
  });
}

export function useInventoryStats() {
  const { data: inventory, isLoading, error } = useInventory();

  const stats = {
    totalProducts: 0,
    totalStock: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
  };

  if (inventory) {
    stats.totalProducts = inventory.length;
    stats.totalStock = inventory.reduce((sum, item) => sum + item.stock, 0);
    stats.lowStockItems = inventory.filter((item) => item.stock > 0 && item.stock <= 2).length;
    stats.outOfStockItems = inventory.filter((item) => item.stock === 0).length;
  }

  return { stats, isLoading, error };
}
