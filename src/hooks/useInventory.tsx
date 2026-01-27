import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface InventoryItem {
  productId: string;
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
  avgImportPrice: number;
  totalImportCost: number;
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
  quantity: number;
  totalImportCost: number;
}

// Process products into inventory items - extracted for reuse
function processProductsToInventory(products: any[]): InventoryItem[] {
  const inventoryMap = new Map<string, InventoryItem>();
  // Track processed IMEIs with their status - prioritize 'in_stock' products
  const processedImeis = new Map<string, string>(); // imei -> status

  for (const product of products) {
    // Handle IMEI deduplication with priority for 'in_stock' status
    if (product.imei) {
      const existingStatus = processedImeis.get(product.imei);
      
      if (existingStatus) {
        // If we already have an 'in_stock' product with this IMEI, skip other statuses
        if (existingStatus === 'in_stock') continue;
        
        // If current product is 'in_stock' but we previously processed a 'sold' one,
        // we need to process this one instead (will be handled below)
        if (product.status === 'in_stock') {
          // Remove the old entry from inventory and reprocess with in_stock product
          // Find and remove old entry
          for (const [key, item] of inventoryMap.entries()) {
            if (item.products.some(p => p.imei === product.imei)) {
              // Decrease counts for the old 'sold' product
              item.totalSold = Math.max(0, item.totalSold - 1);
              item.totalImported = Math.max(0, item.totalImported - 1);
              item.stock = item.totalImported - item.totalSold;
              item.products = item.products.filter(p => p.imei !== product.imei);
              
              // Remove item if no products left
              if (item.products.length === 0 && item.stock <= 0) {
                inventoryMap.delete(key);
              }
              break;
            }
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
    };

    if (existing) {
      if (product.imei) {
        existing.totalImported += 1;
        if (product.status === 'sold') existing.totalSold += 1;
        existing.stock = existing.totalImported - existing.totalSold;
        existing.products.push(productDetail);
        existing.hasImei = true;
        existing.totalImportCost += Number(product.import_price);
        existing.avgImportPrice = existing.totalImportCost / existing.totalImported;
      } else {
        const quantity = product.quantity || 1;
        const totalCost = Number(product.total_import_cost || product.import_price);
        
        if (product.status === 'in_stock') {
          existing.totalImported += quantity;
          existing.stock += quantity;
          existing.totalImportCost += totalCost;
          existing.avgImportPrice = existing.totalImportCost / existing.totalImported;
          existing.products.push(productDetail);
        } else if (product.status === 'sold') {
          existing.totalSold += quantity;
        }
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
          totalSold: product.status === 'sold' ? 1 : 0,
          stock: product.status === 'sold' ? 0 : 1,
          avgImportPrice: Number(product.import_price),
          totalImportCost: Number(product.import_price),
          products: [productDetail],
        });
      } else {
        const quantity = product.quantity || 1;
        const totalCost = Number(product.total_import_cost || product.import_price);
        const stockQty = product.status === 'in_stock' ? quantity : 0;
        const soldQty = product.status === 'sold' ? quantity : 0;
        
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
          totalSold: soldQty,
          stock: stockQty,
          avgImportPrice: Number(product.import_price),
          totalImportCost: totalCost,
          products: product.status === 'in_stock' ? [productDetail] : [],
        });
      }
    }
  }

  return Array.from(inventoryMap.values()).filter(item => item.stock > 0);
}

export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id, name, sku, imei, import_price, import_date, 
          supplier_id, branch_id, category_id, status, 
          quantity, total_import_cost,
          categories(name),
          suppliers(name),
          branches(name)
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      return processProductsToInventory(products || []);
    },
    staleTime: 30000, // Cache 30 giây
    gcTime: 5 * 60 * 1000, // Giữ cache 5 phút
  });
}

// Tối ưu: dùng useMemo từ data đã có, không gọi lại useInventory
export function useInventoryStats() {
  const { data: inventory, isLoading, error } = useInventory();

  const stats = useMemo(() => {
    if (!inventory) {
      return {
        totalProducts: 0,
        totalStock: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
      };
    }

    return {
      totalProducts: inventory.length,
      totalStock: inventory.reduce((sum, item) => sum + item.stock, 0),
      lowStockItems: inventory.filter((item) => item.stock > 0 && item.stock <= 2).length,
      outOfStockItems: inventory.filter((item) => item.stock === 0).length,
    };
  }, [inventory]);

  return { stats, isLoading, error };
}

// Hook để lấy lịch sử nhập hàng của một sản phẩm
export function useProductImportHistory(productId: string | null) {
  return useQuery({
    queryKey: ['product-import-history', productId],
    queryFn: async () => {
      if (!productId) return [];

      // Đầu tiên lấy thông tin sản phẩm để biết nó có IMEI hay không
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('imei, name, sku')
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      if (product?.imei) {
        // Sản phẩm có IMEI - lấy từ product_imports
        const { data, error } = await supabase
          .from('product_imports')
          .select(`
            *,
            import_receipts(code, import_date),
            suppliers(name)
          `)
          .eq('product_id', productId)
          .order('import_date', { ascending: false });

        if (error) throw error;
        return data || [];
      } else {
        // Sản phẩm không IMEI - lấy từ bảng products theo name + sku, chỉ lấy status = 'in_stock'
        const { data: productRecords, error } = await supabase
          .from('products')
          .select(`
            id,
            import_price,
            import_date,
            quantity,
            import_receipt_id,
            supplier_id,
            status,
            import_receipts(code, import_date),
            suppliers(name)
          `)
          .eq('name', product.name)
          .eq('sku', product.sku)
          .eq('status', 'in_stock')
          .not('import_receipt_id', 'is', null)
          .order('import_date', { ascending: false });

        if (error) throw error;

        // Map dữ liệu thành format tương tự product_imports
        return (productRecords || []).map(record => ({
          id: record.id,
          product_id: record.id,
          import_price: record.import_price,
          import_date: record.import_date,
          quantity: record.quantity,
          import_receipt_id: record.import_receipt_id,
          supplier_id: record.supplier_id,
          import_receipts: record.import_receipts,
          suppliers: record.suppliers,
          note: null,
        }));
      }
    },
    enabled: !!productId,
  });
}
