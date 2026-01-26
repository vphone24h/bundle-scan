import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InventoryItem {
  productId: string; // ID của sản phẩm chính (hoặc sản phẩm đầu tiên trong nhóm)
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
  avgImportPrice: number; // Giá nhập trung bình
  totalImportCost: number; // Tổng chi phí nhập
  products: ProductDetail[]; // Cho sản phẩm có IMEI
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
      // Track processed IMEIs to avoid duplicates
      const processedImeis = new Set<string>();

      products?.forEach((product) => {
        // Skip duplicate IMEIs (chỉ xử lý IMEI đầu tiên gặp)
        if (product.imei) {
          if (processedImeis.has(product.imei)) {
            return; // Skip this duplicate IMEI
          }
          processedImeis.add(product.imei);
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
          // Sản phẩm có IMEI: cộng dồn từng cái
          if (product.imei) {
            existing.totalImported += 1;
            if (product.status === 'sold') {
              existing.totalSold += 1;
            }
            existing.stock = existing.totalImported - existing.totalSold;
            existing.products.push(productDetail);
            existing.hasImei = true;
            // Cập nhật giá TB cho IMEI products
            existing.totalImportCost += Number(product.import_price);
            existing.avgImportPrice = existing.totalImportCost / existing.totalImported;
          } else {
            // Sản phẩm không IMEI: cộng dồn số lượng nếu có nhiều bản ghi
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
            // Sản phẩm có IMEI
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
            // Sản phẩm không IMEI - đã có quantity và total_import_cost trong DB
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
              avgImportPrice: Number(product.import_price), // Đã là giá TB
              totalImportCost: totalCost,
              products: product.status === 'in_stock' ? [productDetail] : [],
            });
          }
        }
      });

      // Lọc bỏ sản phẩm có tồn kho = 0
      return Array.from(inventoryMap.values()).filter(item => item.stock > 0);
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
