import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';

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
  oldestImportDate: string | null;
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
  note: string | null;
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
      note: product.note || null,
    };

    if (existing) {
      if (product.imei) {
        existing.totalImported += 1;
        if (product.status === 'sold') {
          existing.totalSold += 1;
        } else if (product.status === 'in_stock') {
          // Chỉ cộng totalImportCost cho sản phẩm in_stock
          existing.totalImportCost += Number(product.import_price);
        }
        existing.stock = existing.totalImported - existing.totalSold;
        existing.products.push(productDetail);
        existing.hasImei = true;
        // avgImportPrice = giá trị kho / số lượng tồn
        existing.avgImportPrice = existing.stock > 0 
          ? existing.totalImportCost / existing.stock 
          : 0;
      } else {
        const quantity = product.quantity || 1;
        const totalCost = Number(product.total_import_cost || product.import_price);
        
        if (product.status === 'in_stock' && quantity > 0) {
          existing.totalImported += quantity;
          existing.stock += quantity;
          existing.totalImportCost += totalCost;
          existing.avgImportPrice = existing.stock > 0 ? existing.totalImportCost / existing.stock : 0;
          existing.products.push(productDetail);
        } else if (product.status === 'sold') {
          existing.totalSold += quantity;
        }
      }
    } else {
      if (product.imei) {
        // Chỉ khởi tạo totalImportCost nếu in_stock
        const isInStock = product.status === 'in_stock';
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
          stock: isInStock ? 1 : 0,
          avgImportPrice: isInStock ? Number(product.import_price) : 0,
          totalImportCost: isInStock ? Number(product.import_price) : 0,
          products: [productDetail],
        });
      } else {
        const quantity = product.quantity || 1;
        const totalCost = Number(product.total_import_cost || product.import_price);
        const isInStock = product.status === 'in_stock' && quantity > 0;
        const stockQty = isInStock ? quantity : 0;
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
          avgImportPrice: isInStock ? Number(product.import_price) : 0,
          totalImportCost: isInStock ? totalCost : 0,
          products: isInStock ? [productDetail] : [],
        });
      }
    }
  }

  return Array.from(inventoryMap.values()).filter(item => item.stock > 0);
}

export function useInventory() {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId, branchIds, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    queryKey: ['inventory', tenant?.id, branchIds, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) {
        return [] as InventoryItem[];
      }

      // Use server-side RPC for fast inventory summary
      const effectiveBranchIds = shouldFilter 
        ? (branchIds && branchIds.length > 0 ? branchIds : (branchId ? [branchId] : null))
        : null;

      const { data, error } = await supabase.rpc('get_inventory_summary', {
        p_tenant_id: tenant!.id,
        p_branch_ids: effectiveBranchIds,
      });

      if (error) throw error;

      // Map RPC results to InventoryItem format (without products array - loaded on demand)
      return (data || []).map((row: any) => ({
        productId: row.product_id,
        productName: row.product_name,
        sku: row.sku,
        branchId: row.branch_id,
        branchName: row.branch_name,
        categoryId: row.category_id,
        categoryName: row.category_name,
        hasImei: row.has_imei,
        totalImported: Number(row.total_imported),
        totalSold: Number(row.total_sold),
        stock: Number(row.stock),
        avgImportPrice: Number(row.avg_import_price),
        totalImportCost: Number(row.total_import_cost),
        products: [], // Products loaded on-demand via detail dialogs
        oldestImportDate: row.oldest_import_date || null,
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
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
export function useProductImportHistory(productId: string | null, branchId?: string | null) {
  return useQuery({
    queryKey: ['product-import-history', productId, branchId],
    queryFn: async () => {
      if (!productId) return [];

      // Đầu tiên lấy thông tin sản phẩm để biết nó có IMEI hay không
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('imei, name, sku')
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      // Luôn kiểm tra product_imports trước (cả IMEI và non-IMEI đều có thể lưu ở đây)
      let piQuery = supabase
        .from('product_imports')
        .select(`
          *,
          import_receipts(code, import_date),
          suppliers(name)
        `)
        .eq('product_id', productId)
        .order('import_date', { ascending: false });

      const { data: piData, error: piError } = await piQuery;
      if (piError) throw piError;

      if (product?.imei) {
        // Sản phẩm có IMEI - chỉ dùng product_imports
        return piData || [];
      }

      // Sản phẩm không IMEI - lấy từ cả product_imports VÀ bảng products
      // 1. Lấy từ product_imports theo product_id (cho sản phẩm đã có)
      const piRecords = (piData || []).map(record => ({
        id: record.id,
        product_id: record.product_id,
        import_price: record.import_price,
        import_date: record.import_date,
        quantity: record.quantity,
        import_receipt_id: record.import_receipt_id,
        supplier_id: record.supplier_id,
        import_receipts: record.import_receipts,
        suppliers: record.suppliers,
        note: record.note,
      }));

      // 2. Lấy từ bảng products theo name + sku (cho lần nhập đầu tiên)
      let prodQuery = supabase
        .from('products')
        .select(`
          id,
          import_price,
          import_date,
          quantity,
          import_receipt_id,
          supplier_id,
          status,
          branch_id,
          import_receipts(code, import_date),
          suppliers(name)
        `)
        .eq('name', product.name)
        .eq('sku', product.sku)
        .not('import_receipt_id', 'is', null)
        .order('import_date', { ascending: false });

      if (branchId) {
        prodQuery = prodQuery.eq('branch_id', branchId);
      }

      const { data: productRecords, error } = await prodQuery;
      if (error) throw error;

      // Loại bỏ các bản ghi products có import_receipt_id đã nằm trong product_imports
      const piReceiptIds = new Set(piRecords.map(r => r.import_receipt_id));
      const prodRecords = (productRecords || [])
        .filter(record => !piReceiptIds.has(record.import_receipt_id))
        .map(record => ({
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

      // Gộp cả 2 nguồn và sắp xếp theo ngày mới nhất
      const allRecords = [...piRecords, ...prodRecords].sort(
        (a, b) => new Date(b.import_date).getTime() - new Date(a.import_date).getTime()
      );

      return allRecords;
    },
    enabled: !!productId,
  });
}
