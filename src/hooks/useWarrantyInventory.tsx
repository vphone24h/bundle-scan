import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { InventoryItem, ProductDetail } from './useInventory';
import { toast } from '@/hooks/use-toast';

// Extended ProductDetail with warranty note
export interface WarrantyProductDetail extends ProductDetail {
  warrantyNote: string | null;
}

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

    const productDetail: ProductDetail & { warrantyNote: string | null } = {
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
      warrantyNote: product.warranty_note || null,
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
          oldestImportDate: product.import_date || null,
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
  const { branchId, branchIds, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    queryKey: ['warranty-inventory', tenant?.id, branchIds, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) {
        return [] as InventoryItem[];
      }

      let query = supabase
        .from('products')
        .select(`
          id, name, sku, imei, import_price, import_date, 
          supplier_id, branch_id, category_id, status, 
          quantity, total_import_cost, note, warranty_note,
          categories(name),
          suppliers(name),
          branches(name)
        `)
        .eq('status', 'warranty' as any)
        .order('name', { ascending: true });

      if (shouldFilter && branchIds && branchIds.length > 0) {
        query = query.in('branch_id', branchIds);
      } else if (shouldFilter && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: products, error } = await query;

      if (error) throw error;
      return processProductsToWarrantyInventory(products || []);
    },
    staleTime: 2 * 60 * 1000, // 2 min cache
    gcTime: 10 * 60 * 1000,
    enabled: !isTenantLoading && !branchLoading,
    refetchOnWindowFocus: false,
  });
}

// Hook to mark a product as under warranty
export function useMarkProductWarranty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, warrantyNote }: { productId: string; warrantyNote: string }) => {
      const { error } = await supabase
        .from('products')
        .update({ 
          status: 'warranty' as any,
          warranty_note: warrantyNote || null,
        })
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
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
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

// Hook to mark a product as defective and return to supplier
export function useMarkDefectiveReturn() {
  const queryClient = useQueryClient();
  const { data: tenant } = useCurrentTenant();

  return useMutation({
    mutationFn: async ({
      productId,
      paymentSource,
      note,
      importPrice,
      supplierId,
      productName,
      sku,
      imei,
      supplierName,
      branchId,
    }: {
      productId: string;
      paymentSource: string;
      note: string;
      importPrice: number;
      supplierId: string | null;
      productName: string;
      sku: string;
      imei: string | null;
      supplierName: string | null;
      branchId: string | null;
    }) => {
      const paymentSourceLabel = 
        paymentSource === 'cash' ? 'Tiền mặt' : 
        paymentSource === 'bank_card' ? 'Chuyển khoản' : 
        'Trừ công nợ NCC';

      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // 2. Update product status to 'deleted' with note
      const { error: productError } = await supabase
        .from('products')
        .update({ 
          status: 'deleted' as any,
          note: `[HÀNG LỖI] ${note}`,
        })
        .eq('id', productId);

      if (productError) throw productError;

      // 3. Create audit log entry
      if (tenant?.id) {
        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert({
            tenant_id: tenant.id,
            user_id: user?.id,
            branch_id: branchId,
            action_type: 'DEFECTIVE_RETURN',
            table_name: 'products',
            record_id: productId,
            description: `Xử lý hàng lỗi: ${productName} (${sku})${imei ? ` - IMEI: ${imei}` : ''} | Giá nhập: ${importPrice.toLocaleString('vi-VN')}đ | NCC: ${supplierName || 'Không xác định'} | Nguồn tiền hoàn: ${paymentSourceLabel} | Lý do: ${note}`,
            old_data: {
              product_id: productId,
              product_name: productName,
              sku: sku,
              imei: imei,
              import_price: importPrice,
              supplier_id: supplierId,
              supplier_name: supplierName,
              status: 'warranty',
            },
            new_data: {
              product_id: productId,
              product_name: productName,
              sku: sku,
              imei: imei,
              import_price: importPrice,
              supplier_id: supplierId,
              supplier_name: supplierName,
              status: 'deleted',
              defective_reason: note,
              payment_source: paymentSource,
              payment_source_label: paymentSourceLabel,
              refund_amount: importPrice,
            },
          });

        if (auditError) {
          console.error('Error creating audit log:', auditError);
        }
      }

      // 4. Create cash book entry for refund from supplier (Thu)
      if (paymentSource !== 'debt_reduction' && tenant?.id) {
        const { error: cashBookError } = await supabase
          .from('cash_book')
          .insert({
            tenant_id: tenant.id,
            branch_id: branchId,
            type: 'income' as any,
            category: 'Hoàn tiền hàng lỗi',
            description: `${productName}${imei ? ` (${imei})` : ''} - ${note}`,
            amount: importPrice,
            payment_source: paymentSource === 'cash' ? 'cash' : 'bank_card',
            reference_type: 'defective_return',
            reference_id: productId,
            is_business_accounting: false, // Not counted in profit
          });

        if (cashBookError) throw cashBookError;
      }

      // 5. If debt reduction, update supplier debt (reduce what we owe)
      if (paymentSource === 'debt_reduction' && supplierId && tenant?.id) {
        // Create a payment record to reduce debt
        const { error: debtError } = await supabase
          .from('debt_payments')
          .insert({
            tenant_id: tenant.id,
            branch_id: branchId,
            entity_type: 'supplier',
            entity_id: supplierId,
            payment_type: 'payment',
            amount: importPrice,
            description: `Trừ công nợ - Hàng lỗi: ${productName}${imei ? ` (${imei})` : ''} - ${note}`,
          });

        if (debtError) throw debtError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['warranty-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] });
      toast({
        title: 'Đã xử lý hàng lỗi',
        description: 'Sản phẩm đã được trả về NCC và ghi nhận dòng tiền',
      });
    },
    onError: (error) => {
      console.error('Error processing defective return:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xử lý hàng lỗi',
        variant: 'destructive',
      });
    },
  });
}
