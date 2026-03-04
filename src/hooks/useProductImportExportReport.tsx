import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
// fetchAllRows removed - using server-side limited queries

export interface ProductImportExportItem {
  productName: string;
  sku: string;
  categoryName: string;
  branchName: string;
  branchId: string | null;
  quantityImported: number;
  totalImportValue: number;
  quantityExported: number;
  totalExportValue: number;
  quantityReturned: number;
  totalReturnValue: number;
  netQuantity: number; // imported - exported - returned
}

export function useProductImportExportReport(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  sort?: 'import_high' | 'export_high' | 'return_high' | 'net_high' | 'net_low';
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();
  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    queryKey: ['product-import-export-report', tenant?.id, effectiveBranchId, filters, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) {
        return {
          items: [] as ProductImportExportItem[],
          summary: { totalImported: 0, totalExported: 0, totalReturned: 0, totalImportValue: 0, totalExportValue: 0, totalReturnValue: 0 },
        };
      }

      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const startISO = new Date(startDate + 'T00:00:00').toISOString();
      const endISO = new Date(endDate + 'T23:59:59.999').toISOString();

      const buildImportQuery = () => {
        let q = supabase
          .from('product_imports')
          .select(`
            import_price, quantity, product_id,
            products!inner(name, sku, category_id, categories(name)),
            import_receipts!inner(import_date, branch_id, status, branches(name))
          `)
          .neq('import_receipts.status', 'cancelled')
          .gte('import_receipts.import_date', startISO)
          .lte('import_receipts.import_date', endISO);
        if (effectiveBranchId) {
          q = q.eq('import_receipts.branch_id', effectiveBranchId);
        }
        return q;
      };

      const buildExportQuery = () => {
        let q = supabase
          .from('export_receipt_items')
          .select(`
            product_name, sku, sale_price, status, category_id,
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

      const buildReturnQuery = () => {
        let q = supabase
          .from('export_receipt_items')
          .select(`
            product_name, sku, sale_price, status, category_id,
            categories(name),
            export_receipts!inner(export_date, branch_id, branches(name))
          `)
          .eq('status', 'returned')
          .gte('export_receipts.export_date', startISO)
          .lte('export_receipts.export_date', endISO);
        if (effectiveBranchId) {
          q = q.eq('export_receipts.branch_id', effectiveBranchId);
        }
        return q;
      };

      const [importRes, exportRes, returnRes] = await Promise.all([
        buildImportQuery().limit(5000),
        buildExportQuery().limit(5000),
        buildReturnQuery().limit(5000),
      ]);
      if (importRes.error) throw importRes.error;
      if (exportRes.error) throw exportRes.error;
      if (returnRes.error) throw returnRes.error;
      const importData = importRes.data || [];
      const exportData = exportRes.data || [];
      const returnData = returnRes.data || [];

      // Aggregate by product name + sku + branch
      const productMap: Record<string, ProductImportExportItem> = {};

      const getKey = (name: string, sku: string, branchId: string | null) =>
        `${name}||${sku}||${branchId || ''}`;

      // Process imports
      importData.forEach(item => {
        const receipt = item.import_receipts as any;
        const product = item.products as any;
        const key = getKey(product?.name || '', product?.sku || '', receipt?.branch_id);
        const qty = item.quantity || 1;
        const price = Number(item.import_price) || 0;

        if (!productMap[key]) {
          productMap[key] = {
            productName: product?.name || '',
            sku: product?.sku || '',
            categoryName: product?.categories?.name || 'Chưa phân loại',
            branchName: receipt?.branches?.name || 'N/A',
            branchId: receipt?.branch_id,
            quantityImported: 0,
            totalImportValue: 0,
            quantityExported: 0,
            totalExportValue: 0,
            quantityReturned: 0,
            totalReturnValue: 0,
            netQuantity: 0,
          };
        }
        productMap[key].quantityImported += qty;
        productMap[key].totalImportValue += price * qty;
      });

      // Process exports
      exportData.forEach(item => {
        const receipt = item.export_receipts as any;
        const key = getKey(item.product_name, item.sku, receipt?.branch_id);
        const price = Number(item.sale_price) || 0;

        if (!productMap[key]) {
          productMap[key] = {
            productName: item.product_name,
            sku: item.sku,
            categoryName: (item.categories as any)?.name || 'Chưa phân loại',
            branchName: receipt?.branches?.name || 'N/A',
            branchId: receipt?.branch_id,
            quantityImported: 0,
            totalImportValue: 0,
            quantityExported: 0,
            totalExportValue: 0,
            quantityReturned: 0,
            totalReturnValue: 0,
            netQuantity: 0,
          };
        }
        productMap[key].quantityExported += 1;
        productMap[key].totalExportValue += price;
      });

      // Process returns
      returnData.forEach(item => {
        const receipt = item.export_receipts as any;
        const key = getKey(item.product_name, item.sku, receipt?.branch_id);
        const price = Number(item.sale_price) || 0;

        if (!productMap[key]) {
          productMap[key] = {
            productName: item.product_name,
            sku: item.sku,
            categoryName: (item.categories as any)?.name || 'Chưa phân loại',
            branchName: receipt?.branches?.name || 'N/A',
            branchId: receipt?.branch_id,
            quantityImported: 0,
            totalImportValue: 0,
            quantityExported: 0,
            totalExportValue: 0,
            quantityReturned: 0,
            totalReturnValue: 0,
            netQuantity: 0,
          };
        }
        productMap[key].quantityReturned += 1;
        productMap[key].totalReturnValue += price;
      });

      // Calculate net quantity
      Object.values(productMap).forEach(item => {
        item.netQuantity = item.quantityImported - item.quantityExported;
      });

      let items = Object.values(productMap);

      // Sort
      switch (filters?.sort) {
        case 'export_high': items.sort((a, b) => b.quantityExported - a.quantityExported); break;
        case 'return_high': items.sort((a, b) => b.quantityReturned - a.quantityReturned); break;
        case 'net_high': items.sort((a, b) => b.netQuantity - a.netQuantity); break;
        case 'net_low': items.sort((a, b) => a.netQuantity - b.netQuantity); break;
        case 'import_high':
        default: items.sort((a, b) => b.quantityImported - a.quantityImported); break;
      }

      const summary = {
        totalImported: items.reduce((s, i) => s + i.quantityImported, 0),
        totalExported: items.reduce((s, i) => s + i.quantityExported, 0),
        totalReturned: items.reduce((s, i) => s + i.quantityReturned, 0),
        totalImportValue: items.reduce((s, i) => s + i.totalImportValue, 0),
        totalExportValue: items.reduce((s, i) => s + i.totalExportValue, 0),
        totalReturnValue: items.reduce((s, i) => s + i.totalReturnValue, 0),
      };

      return { items, summary };
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}
