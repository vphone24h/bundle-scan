import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';

export interface DetailedProfitItem {
  id: string;
  productName: string;
  sku: string;
  imei: string | null;
  branchId: string | null;
  branchName: string;
  importPrice: number;
  salePrice: number;
  quantity: number;
  profit: number;
  saleDate: string;
  status: 'sold' | 'returned';
  customerId: string | null;
  customerName: string | null;
  receiptCode: string;
}

export function useDetailedProfitReport(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  categoryId?: string;
  search?: string;
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;

  return useQuery({
    queryKey: ['detailed-profit-report', filters, isDataHidden],
    queryFn: async () => {
      // Chế độ test: trả về dữ liệu rỗng
      if (isDataHidden) {
        return {
          items: [] as DetailedProfitItem[],
          totals: { totalQuantity: 0, totalRevenue: 0, totalProfit: 0 },
        };
      }

      const startDate = filters?.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const endDate = filters?.endDate || new Date().toISOString().split('T')[0];

      // 1. Lấy dữ liệu bán hàng từ export_receipt_items
      let soldQuery = supabase
        .from('export_receipt_items')
        .select(`
          id,
          product_name,
          sku,
          imei,
          sale_price,
          status,
          product_id,
          category_id,
          receipt_id,
          export_receipts!inner(
            id,
            code,
            export_date,
            branch_id,
            customer_id,
            status,
            branches(name),
            customers(name)
          )
        `)
        .in('status', ['sold', 'returned'])
        .neq('export_receipts.status', 'cancelled')
        .gte('export_receipts.export_date', startDate)
        .lte('export_receipts.export_date', endDate + 'T23:59:59');

      if (filters?.branchId) {
        soldQuery = soldQuery.eq('export_receipts.branch_id', filters.branchId);
      }

      if (filters?.categoryId) {
        soldQuery = soldQuery.eq('category_id', filters.categoryId);
      }

      if (filters?.search) {
        soldQuery = soldQuery.or(`product_name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,imei.ilike.%${filters.search}%`);
      }

      const { data: soldItems, error: soldError } = await soldQuery;
      if (soldError) throw soldError;

      // 2. Lấy dữ liệu trả hàng từ export_returns
      let returnQuery = supabase
        .from('export_returns')
        .select(`
          id,
          code,
          product_name,
          sku,
          imei,
          import_price,
          sale_price,
          return_date,
          branch_id,
          customer_id,
          product_id,
          fee_type,
          branches(name),
          customers(name)
        `)
        .eq('fee_type', 'none')
        .gte('return_date', startDate)
        .lte('return_date', endDate + 'T23:59:59');

      if (filters?.branchId) {
        returnQuery = returnQuery.eq('branch_id', filters.branchId);
      }

      if (filters?.search) {
        returnQuery = returnQuery.or(`product_name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,imei.ilike.%${filters.search}%`);
      }

      const { data: returnItems, error: returnError } = await returnQuery;
      if (returnError) throw returnError;

      // 3. Lấy giá nhập của các sản phẩm
      const productIds = Array.from(
        new Set([
          ...(soldItems?.map(i => i.product_id).filter(Boolean) || []),
          ...(returnItems?.map((i: any) => i.product_id).filter(Boolean) || []),
        ])
      );
      let productsMap: Record<string, { import_price: number; quantity: number }> = {};
      
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, import_price, quantity, imei')
          .in('id', productIds);
        
        productsMap = (products || []).reduce((acc, p) => {
          acc[p.id] = { 
            import_price: Number(p.import_price),
            quantity: p.quantity || 1,
          };
          return acc;
        }, {} as Record<string, { import_price: number; quantity: number }>);
      }

      // 4. Xử lý dữ liệu bán hàng
      const results: DetailedProfitItem[] = [];
      const nonImeiGroupMap: Record<string, DetailedProfitItem> = {};

      soldItems?.forEach(item => {
        const receipt = item.export_receipts as any;
        const productInfo = item.product_id ? productsMap[item.product_id] : null;
        const importPrice = productInfo?.import_price || 0;
        const salePrice = Number(item.sale_price);
        const profit = salePrice - importPrice;

        if (item.imei) {
          results.push({
            id: item.id,
            productName: item.product_name,
            sku: item.sku,
            imei: item.imei,
            branchId: receipt?.branch_id,
            branchName: receipt?.branches?.name || 'N/A',
            importPrice,
            salePrice,
            quantity: 1,
            profit,
            saleDate: receipt?.export_date,
            status: 'sold',
            customerId: receipt?.customer_id,
            customerName: receipt?.customers?.name || null,
            receiptCode: receipt?.code || '',
          });
        } else {
          const groupKey = `${receipt?.id}-${item.sku}`;
          if (!nonImeiGroupMap[groupKey]) {
            nonImeiGroupMap[groupKey] = {
              id: groupKey,
              productName: item.product_name,
              sku: item.sku,
              imei: null,
              branchId: receipt?.branch_id,
              branchName: receipt?.branches?.name || 'N/A',
              importPrice,
              salePrice: 0,
              quantity: 0,
              profit: 0,
              saleDate: receipt?.export_date,
              status: 'sold',
              customerId: receipt?.customer_id,
              customerName: receipt?.customers?.name || null,
              receiptCode: receipt?.code || '',
            };
          }
          nonImeiGroupMap[groupKey].salePrice += salePrice;
          nonImeiGroupMap[groupKey].quantity += 1;
          nonImeiGroupMap[groupKey].profit += profit;
        }
      });

      Object.values(nonImeiGroupMap).forEach(group => {
        results.push(group);
      });

      // 5. Xử lý dữ liệu trả hàng
      returnItems?.forEach((item: any) => {
        const originalSalePrice = Number(item.sale_price);
        const productInfo = item.product_id ? productsMap[item.product_id] : null;
        const originalImportPrice = productInfo?.import_price || 0;
        const originalProfit = originalSalePrice - originalImportPrice;

        const profit = -originalProfit;

        results.push({
          id: `return-${item.id}`,
          productName: item.product_name,
          sku: item.sku,
          imei: item.imei,
          branchId: item.branch_id,
          branchName: (item.branches as any)?.name || 'N/A',
          importPrice: 0,
          salePrice: 0,
          quantity: 1,
          profit,
          saleDate: item.return_date,
          status: 'returned',
          customerId: item.customer_id,
          customerName: (item.customers as any)?.name || null,
          receiptCode: item.code,
        });
      });

      results.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

      const totals = results.reduce(
        (acc, item) => {
          acc.totalQuantity += item.quantity;
          acc.totalRevenue += item.salePrice;
          acc.totalProfit += item.profit;
          return acc;
        },
        { totalQuantity: 0, totalRevenue: 0, totalProfit: 0 }
      );

      return {
        items: results,
        totals,
      };
    },
    enabled: !isTenantLoading,
    refetchOnWindowFocus: false,
  });
}
