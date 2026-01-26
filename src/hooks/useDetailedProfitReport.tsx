import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  return useQuery({
    queryKey: ['detailed-profit-report', filters],
    queryFn: async () => {
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
        .eq('status', 'sold')
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
          branches(name),
          customers(name)
        `)
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

      // 3. Lấy giá nhập của các sản phẩm đã bán
      const productIds = soldItems?.map(i => i.product_id).filter(Boolean) || [];
      let productsMap: Record<string, number> = {};
      
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, import_price')
          .in('id', productIds);
        
        productsMap = (products || []).reduce((acc, p) => {
          acc[p.id] = Number(p.import_price);
          return acc;
        }, {} as Record<string, number>);
      }

      // 4. Xử lý dữ liệu bán hàng
      const results: DetailedProfitItem[] = [];

      // Gộp các sản phẩm không có IMEI theo receipt + product_name + sku
      const nonImeiGroupMap: Record<string, DetailedProfitItem> = {};

      soldItems?.forEach(item => {
        const receipt = item.export_receipts as any;
        const importPrice = item.product_id ? (productsMap[item.product_id] || 0) : 0;
        const salePrice = Number(item.sale_price);
        const profit = salePrice - importPrice;

        if (item.imei) {
          // Sản phẩm có IMEI - thêm từng dòng
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
          // Sản phẩm không IMEI - gộp theo receipt + sku
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

      // Thêm các nhóm không IMEI vào results
      Object.values(nonImeiGroupMap).forEach(group => {
        results.push(group);
      });

      // 5. Xử lý dữ liệu trả hàng (lợi nhuận âm)
      returnItems?.forEach(item => {
        const importPrice = Number(item.import_price);
        const salePrice = Number(item.sale_price);
        const profit = -(salePrice - importPrice); // Lợi nhuận âm

        results.push({
          id: `return-${item.id}`,
          productName: item.product_name,
          sku: item.sku,
          imei: item.imei,
          branchId: item.branch_id,
          branchName: (item.branches as any)?.name || 'N/A',
          importPrice,
          salePrice,
          quantity: item.imei ? 1 : 1, // Trả hàng thường là 1 sản phẩm
          profit,
          saleDate: item.return_date,
          status: 'returned',
          customerId: item.customer_id,
          customerName: (item.customers as any)?.name || null,
          receiptCode: item.code,
        });
      });

      // 6. Sắp xếp theo ngày giảm dần
      results.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

      // 7. Tính tổng
      const totals = results.reduce(
        (acc, item) => {
          acc.totalQuantity += item.quantity;
          acc.totalRevenue += item.salePrice * (item.status === 'returned' ? -1 : 1);
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
  });
}
