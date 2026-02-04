import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { InventoryItem, ProductDetail } from './useInventory';
import { toast } from '@/hooks/use-toast';

// Process products into inventory items for warranty view
function processProductsToWarrantyInventory(products: any[]): InventoryItem[] {
  const inventoryMap = new Map<string, InventoryItem>();
  const processedImeis = new Map<string, string>();

  for (const product of products) {
    // Handle IMEI deduplication
    if (product.imei) {
      const existingStatus = processedImeis.get(product.imei);
      if (existingStatus) continue;
      processedImeis.set(product.imei, product.status);
    }

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
      quantity: product.quantity || 1,
      totalImportCost: product.total_import_cost || product.import_price,
      note: product.note || null,
    };

    if (existing) {
      if (product.imei) {
        existing.totalImported += 1;
        existing.stock += 1;
        existing.products.push(productDetail);
        existing.totalImportCost += Number(product.import_price);
        existing.avgImportPrice = existing.totalImportCost / existing.totalImported;
      } else {
        const quantity = product.quantity || 1;
        const totalCost = Number(product.total_import_cost || product.import_price);
        existing.totalImported += quantity;
        existing.stock += quantity;
        existing.totalImportCost += totalCost;
        existing.avgImportPrice = existing.totalImportCost / existing.totalImported;
        existing.products.push(productDetail);
      }
    } else {
      if (product.imei) {
        inventoryMap.set(key, {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          branchId: product.branch_id,
          branchName: product.branches?.name || null,
          categoryId: product.category_id,
          categoryName: product.categories?.name || null,
          hasImei: true,
          totalImported: 1,
          totalSold: 0,
          stock: 1,
          avgImportPrice: Number(product.import_price),
          totalImportCost: Number(product.import_price),
          products: [productDetail],
        });
      } else {
        const quantity = product.quantity || 1;
        const totalCost = Number(product.total_import_cost || product.import_price);
        inventoryMap.set(key, {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          branchId: product.branch_id,
          branchName: product.branches?.name || null,
          categoryId: product.category_id,
          categoryName: product.categories?.name || null,
          hasImei: false,
          totalImported: quantity,
          totalSold: 0,
          stock: quantity,
          avgImportPrice: Number(product.import_price),
          totalImportCost: totalCost,
          products: [productDetail],
        });
      }
    }
  }

  return Array.from(inventoryMap.values());
}

// Hook to fetch warranty items
export function useWarrantyInventory() {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    queryKey: ['warranty-inventory', tenant?.id, branchId, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) {
        return [] as InventoryItem[];
      }

      let query = supabase
        .from('products')
        .select(`
          id, name, sku, imei, import_price, import_date, 
          supplier_id, branch_id, category_id, status, 
          quantity, total_import_cost, note,
          categories(name),
          suppliers(name),
          branches(name)
        `)
        .eq('status', 'warranty' as any)
        .order('name', { ascending: true });

      if (shouldFilter && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: products, error } = await query;

      if (error) throw error;
      return processProductsToWarrantyInventory(products || []);
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    enabled: !isTenantLoading && !branchLoading,
    refetchOnWindowFocus: false,
  });
}

// Hook to mark a product as under warranty
export function useMarkProductWarranty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .update({ status: 'warranty' as any })
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate both inventory and warranty queries
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['warranty-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Đã chuyển sang bảo hành',
        description: 'Sản phẩm đã được chuyển sang tab Hàng bảo hành',
      });
    },
    onError: (error) => {
      console.error('Error marking product as warranty:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể chuyển sản phẩm sang bảo hành',
        variant: 'destructive',
      });
    },
  });
}

// Hook to restore a product from warranty back to in_stock
export function useRestoreFromWarranty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .update({ status: 'in_stock' as any })
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['warranty-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Đã khôi phục',
        description: 'Sản phẩm đã được chuyển lại về tồn kho',
      });
    },
    onError: (error) => {
      console.error('Error restoring product from warranty:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể khôi phục sản phẩm',
        variant: 'destructive',
      });
    },
  });
}
