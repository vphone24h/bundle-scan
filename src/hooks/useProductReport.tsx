import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';

export interface ProductReportItem {
  productName: string;
  sku: string;
  categoryName: string;
  branchName: string;
  branchId: string | null;
  quantitySold: number;
  totalRevenue: number;
  totalProfit: number;
  currentStock: number;
  importPrice: number;
}

export function useProductReport(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  sort?: 'best' | 'worst' | 'stock_high' | 'stock_low' | 'profit';
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();
  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    queryKey: ['product-report', tenant?.id, effectiveBranchId, filters, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) return { items: [] as ProductReportItem[], summary: { totalProducts: 0, totalSold: 0, totalRevenue: 0, totalProfit: 0, totalStockValue: 0 } };

      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const startISO = new Date(startDate + 'T00:00:00').toISOString();
      const endISO = new Date(endDate + 'T23:59:59.999').toISOString();

      // Get sold items
      let soldQuery = supabase
        .from('export_receipt_items')
        .select(`
          product_name, sku, sale_price, status, product_id, category_id,
          categories(name),
          export_receipts!inner(export_date, branch_id, status, branches(name))
        `)
        .eq('status', 'sold')
        .neq('export_receipts.status', 'cancelled')
        .gte('export_receipts.export_date', startISO)
        .lte('export_receipts.export_date', endISO);

      if (effectiveBranchId) {
        soldQuery = soldQuery.eq('export_receipts.branch_id', effectiveBranchId);
      }

      const { data: soldItems, error: soldError } = await soldQuery;
      if (soldError) throw soldError;

      // Get product import prices
      const productIds = Array.from(new Set(soldItems?.map(i => i.product_id).filter(Boolean) || []));
      let productsMap: Record<string, number> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase.from('products').select('id, import_price').in('id', productIds);
        productsMap = (products || []).reduce((acc, p) => { acc[p.id] = Number(p.import_price); return acc; }, {} as Record<string, number>);
      }

      // Get current stock
      let stockQuery = supabase
        .from('products')
        .select('name, sku, quantity, import_price, branch_id, category_id, branches(name), categories(name)')
        .eq('status', 'in_stock');

      if (effectiveBranchId) {
        stockQuery = stockQuery.eq('branch_id', effectiveBranchId);
      }

      const { data: stockItems } = await stockQuery;

      // Aggregate sold data by product name+sku
      const productMap: Record<string, ProductReportItem> = {};

      soldItems?.forEach(item => {
        const receipt = item.export_receipts as any;
        const key = `${item.product_name}||${item.sku}||${receipt?.branch_id || ''}`;
        const importPrice = item.product_id ? (productsMap[item.product_id] || 0) : 0;
        const salePrice = Number(item.sale_price);

        if (!productMap[key]) {
          productMap[key] = {
            productName: item.product_name,
            sku: item.sku,
            categoryName: (item.categories as any)?.name || 'Chưa phân loại',
            branchName: receipt?.branches?.name || 'N/A',
            branchId: receipt?.branch_id,
            quantitySold: 0,
            totalRevenue: 0,
            totalProfit: 0,
            currentStock: 0,
            importPrice,
          };
        }
        productMap[key].quantitySold += 1;
        productMap[key].totalRevenue += salePrice;
        productMap[key].totalProfit += (salePrice - importPrice);
      });

      // Add stock info
      const stockMap: Record<string, number> = {};
      stockItems?.forEach(item => {
        const key = `${item.name}||${item.sku}||${item.branch_id || ''}`;
        stockMap[key] = (stockMap[key] || 0) + (item.quantity || 1);

        // Also ensure products with stock but no sales appear
        if (!productMap[key]) {
          productMap[key] = {
            productName: item.name,
            sku: item.sku,
            categoryName: (item.categories as any)?.name || 'Chưa phân loại',
            branchName: (item.branches as any)?.name || 'N/A',
            branchId: item.branch_id,
            quantitySold: 0,
            totalRevenue: 0,
            totalProfit: 0,
            currentStock: item.quantity || 1,
            importPrice: Number(item.import_price),
          };
        }
      });

      Object.keys(productMap).forEach(key => {
        if (stockMap[key]) {
          productMap[key].currentStock = stockMap[key];
        }
      });

      let items = Object.values(productMap);

      // Sort
      switch (filters?.sort) {
        case 'worst': items.sort((a, b) => a.quantitySold - b.quantitySold); break;
        case 'stock_high': items.sort((a, b) => b.currentStock - a.currentStock); break;
        case 'stock_low': items.sort((a, b) => a.currentStock - b.currentStock); break;
        case 'profit': items.sort((a, b) => b.totalProfit - a.totalProfit); break;
        case 'best':
        default: items.sort((a, b) => b.quantitySold - a.quantitySold); break;
      }

      const summary = {
        totalProducts: items.length,
        totalSold: items.reduce((s, i) => s + i.quantitySold, 0),
        totalRevenue: items.reduce((s, i) => s + i.totalRevenue, 0),
        totalProfit: items.reduce((s, i) => s + i.totalProfit, 0),
        totalStockValue: items.reduce((s, i) => s + (i.currentStock * i.importPrice), 0),
      };

      return { items, summary };
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}
