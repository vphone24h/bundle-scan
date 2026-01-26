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
        // KHÔNG được rollback / sửa dòng bán cũ.
        // Khi trả hàng, export_receipt_items.status thường bị set = 'returned',
        // nhưng báo cáo vẫn phải giữ dòng bán (thời điểm bán).
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
      // CHỈ lấy trả hàng KHÔNG CÓ PHÍ (fee_type = 'none') để hiển thị lợi nhuận âm
      // Trả hàng có phí sẽ tạo phiếu nhập mới, không ảnh hưởng báo cáo
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
        .eq('fee_type', 'none') // Chỉ lấy trả hàng hoàn tiền đầy đủ
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

      // 3. Lấy giá nhập (trung bình) của các sản phẩm đã bán
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
          // import_price đã là giá trung bình cho sản phẩm không IMEI
          acc[p.id] = { 
            import_price: Number(p.import_price),
            quantity: p.quantity || 1,
          };
          return acc;
        }, {} as Record<string, { import_price: number; quantity: number }>);
      }

      // 4. Xử lý dữ liệu bán hàng
      const results: DetailedProfitItem[] = [];

      // Gộp các sản phẩm không có IMEI theo receipt + product_name + sku
      const nonImeiGroupMap: Record<string, DetailedProfitItem> = {};

      soldItems?.forEach(item => {
        const receipt = item.export_receipts as any;
        // Sử dụng giá nhập trung bình từ products table
        const productInfo = item.product_id ? productsMap[item.product_id] : null;
        const importPrice = productInfo?.import_price || 0;
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

      // 5. Xử lý dữ liệu trả hàng đủ tiền (fee_type = 'none')
      // Nguyên tắc: tạo phát sinh mới tại thời điểm trả hàng
      // - Doanh thu = 0
      // - Giá vốn = 0
      // - Lợi nhuận = -(lãi lúc bán)
      // NOTE: export_returns.import_price hiện có thể = 0, nên phải tính lãi lúc bán dựa trên product_id.
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
          importPrice: 0, // Giá vốn = 0 trong báo cáo trả hàng
          salePrice: 0,   // Doanh thu = 0 trong báo cáo trả hàng
          quantity: 1,
          profit,         // Chỉ hiển thị lợi nhuận âm
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
      // Trả hàng đủ tiền: Doanh thu = 0, chỉ trừ lợi nhuận
      const totals = results.reduce(
        (acc, item) => {
          acc.totalQuantity += item.quantity;
          // Doanh thu: không bị ảnh hưởng bởi trả hàng (salePrice đã = 0 cho returned)
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
  });
}
