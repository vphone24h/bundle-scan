import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
// fetchAllRows removed - using server-side limited queries

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

export interface StockProductRaw {
  name: string;
  sku: string;
  quantity: number;
  importDate: string | null;
  branchName: string;
  categoryName: string;
  importPrice: number;
  status: string;
  monthlySoldCount: number;
}

export function useProductReport(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  sort?: 'best' | 'worst' | 'stock_high' | 'stock_low' | 'profit' | 'revenue';
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

      // Current month range for reorder suggestions
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
      const monthStartISO = new Date(monthStart).toISOString();
      const monthEndISO = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      const buildSoldQuery = () => {
        let q = supabase
          .from('export_receipt_items')
          .select(`
            product_name, sku, sale_price, status, product_id, category_id, imei,
            categories(name),
            export_receipts!inner(export_date, branch_id, status, branches(name))
          `)
          .eq('status', 'sold')
          .neq('export_receipts.status', 'cancelled')
          .gte('export_receipts.export_date', startISO)
          .lte('export_receipts.export_date', endISO);

        if (effectiveBranchId) {
          q = q.eq('export_receipts.branch_id', effectiveBranchId);
        }
        return q;
      };

      const { data: soldItems, error: soldError } = await buildSoldQuery().limit(5000);
      if (soldError) throw soldError;

      // Get product import prices by product_id
      const productIds = Array.from(new Set(soldItems?.map(i => i.product_id).filter(Boolean) || []));
      let productsMap: Record<string, number> = {};
      if (productIds.length > 0) {
        for (let i = 0; i < productIds.length; i += 500) {
          const chunk = productIds.slice(i, i + 500);
          const { data: products } = await supabase.from('products').select('id, import_price').in('id', chunk);
          (products || []).forEach(p => { productsMap[p.id] = Number(p.import_price); });
        }
      }

      // For items without product_id, try to find import price by IMEI
      const orphanImeis = Array.from(new Set(
        soldItems?.filter(i => !i.product_id && i.imei).map(i => i.imei as string) || []
      ));
      let imeiPriceMap: Record<string, number> = {};
      if (orphanImeis.length > 0) {
        // Batch lookup in chunks of 500
        for (let i = 0; i < orphanImeis.length; i += 500) {
          const chunk = orphanImeis.slice(i, i + 500);
          const { data: imeiProducts } = await supabase
            .from('products')
            .select('imei, import_price')
            .in('imei', chunk)
            .gt('import_price', 0);
          imeiProducts?.forEach(p => {
            if (p.imei && p.import_price) {
              imeiPriceMap[p.imei] = Number(p.import_price);
            }
          });
        }
      }

      // Get current stock (in_stock + warranty)
      let stockQuery = supabase
        .from('products')
        .select('name, sku, quantity, import_price, total_import_cost, branch_id, category_id, import_date, status, branches(name), categories(name)')
        .in('status', ['in_stock', 'warranty'])
        .limit(10000);

      if (effectiveBranchId) {
        stockQuery = stockQuery.eq('branch_id', effectiveBranchId);
      }

      const { data: stockItems } = await stockQuery;

      // Get sold/deleted products to find "out of stock" items (products that existed but now have 0 in stock)
      let soldDeletedQuery = supabase
        .from('products')
        .select('name, sku, import_price, branch_id, category_id, import_date, status, branches(name), categories(name)')
        .in('status', ['sold', 'deleted'])
        .limit(10000);

      if (effectiveBranchId) {
        soldDeletedQuery = soldDeletedQuery.eq('branch_id', effectiveBranchId);
      }

      const { data: soldDeletedItems } = await soldDeletedQuery;

      // Get monthly sold counts for reorder suggestions
      let monthlySoldQuery = supabase
        .from('export_receipt_items')
        .select('product_name, sku, export_receipts!inner(branch_id, export_date, status)')
        .eq('status', 'sold')
        .neq('export_receipts.status', 'cancelled')
        .gte('export_receipts.export_date', monthStartISO)
        .lte('export_receipts.export_date', monthEndISO)
        .limit(10000);

      if (effectiveBranchId) {
        monthlySoldQuery = monthlySoldQuery.eq('export_receipts.branch_id', effectiveBranchId);
      }

      const { data: monthlySoldItems } = await monthlySoldQuery;

      // Build monthly sold count map: name||sku||branchId -> count
      const monthlySoldMap: Record<string, number> = {};
      monthlySoldItems?.forEach(item => {
        const receipt = item.export_receipts as any;
        const key = `${item.product_name}||${item.sku}||${receipt?.branch_id || ''}`;
        monthlySoldMap[key] = (monthlySoldMap[key] || 0) + 1;
      });

      // Aggregate sold data by product name+sku
      const productMap: Record<string, ProductReportItem> = {};

      soldItems?.forEach(item => {
        const receipt = item.export_receipts as any;
        const key = `${item.product_name}||${item.sku}||${receipt?.branch_id || ''}`;
        const importPrice = item.product_id
          ? (productsMap[item.product_id] || 0)
          : (item.imei ? (imeiPriceMap[item.imei] || 0) : 0);
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

      // Add stock info - use total_import_cost for accurate valuation
      const stockMap: Record<string, number> = {};
      const stockValueMap: Record<string, number> = {};
      stockItems?.forEach(item => {
        if (item.status !== 'in_stock') return;
        const key = `${item.name}||${item.sku}||${item.branch_id || ''}`;
        const qty = item.quantity || 1;
        stockMap[key] = (stockMap[key] || 0) + qty;
        const itemCost = Number(item.total_import_cost || item.import_price) || 0;
        stockValueMap[key] = (stockValueMap[key] || 0) + itemCost;

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
            currentStock: qty,
            importPrice: qty > 0 ? itemCost / qty : Number(item.import_price),
          };
        }
      });

      // Build raw stock products for alerts (include in_stock, warranty, sold, deleted)
      const stockProductsRaw: StockProductRaw[] = [
        ...(stockItems || []).map(item => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity || 1,
          importDate: item.import_date || null,
          branchName: (item.branches as any)?.name || 'N/A',
          categoryName: (item.categories as any)?.name || 'Chưa phân loại',
          importPrice: Number(item.import_price) || 0,
          status: item.status || 'in_stock',
          monthlySoldCount: monthlySoldMap[`${item.name}||${item.sku}||${item.branch_id || ''}`] || 0,
        })),
        ...(soldDeletedItems || []).map(item => ({
          name: item.name,
          sku: item.sku,
          quantity: 0,
          importDate: item.import_date || null,
          branchName: (item.branches as any)?.name || 'N/A',
          categoryName: (item.categories as any)?.name || 'Chưa phân loại',
          importPrice: Number(item.import_price) || 0,
          status: item.status || 'sold',
          monthlySoldCount: monthlySoldMap[`${item.name}||${item.sku}||${item.branch_id || ''}`] || 0,
        })),
      ];

      Object.keys(productMap).forEach(key => {
        if (stockMap[key]) {
          productMap[key].currentStock = stockMap[key];
          // Update importPrice to weighted average from actual stock data
          if (stockValueMap[key] && stockMap[key] > 0) {
            productMap[key].importPrice = stockValueMap[key] / stockMap[key];
          }
        }
      });

      let items = Object.values(productMap);

      // Sort
      switch (filters?.sort) {
        case 'worst': items.sort((a, b) => a.quantitySold - b.quantitySold); break;
        case 'stock_high': items.sort((a, b) => b.currentStock - a.currentStock); break;
        case 'stock_low': items.sort((a, b) => a.currentStock - b.currentStock); break;
        case 'profit': items.sort((a, b) => b.totalProfit - a.totalProfit); break;
        case 'revenue': items.sort((a, b) => b.totalRevenue - a.totalRevenue); break;
        case 'best':
        default: items.sort((a, b) => b.quantitySold - a.quantitySold); break;
      }

      // Calculate totalStockValue from actual stock values (not currentStock * importPrice)
      // to match inventory page's calculation
      const totalStockValue = Object.values(stockValueMap).reduce((sum, val) => sum + val, 0);

      const summary = {
        totalProducts: items.length,
        totalSold: items.reduce((s, i) => s + i.quantitySold, 0),
        totalRevenue: items.reduce((s, i) => s + i.totalRevenue, 0),
        totalProfit: items.reduce((s, i) => s + i.totalProfit, 0),
        totalStockValue,
      };

      return { items, summary, stockProductsRaw };
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}
