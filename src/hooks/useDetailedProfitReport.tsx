import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { fetchAllRows } from '@/lib/fetchAllRows';

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

  // Debounce filters to avoid rapid re-fetching when switching presets
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [JSON.stringify(filters)]);

  return useQuery({
    queryKey: ['detailed-profit-report', debouncedFilters, isDataHidden],
    queryFn: async () => {
      // Chế độ test: trả về dữ liệu rỗng
      if (isDataHidden) {
        return {
          items: [] as DetailedProfitItem[],
          totals: { totalQuantity: 0, totalRevenue: 0, totalProfit: 0 },
        };
      }

      // Use local timezone for date filtering (same as Dashboard)
      const getLocalDateString = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      };
      
      const now = new Date();
      const startDate = debouncedFilters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = debouncedFilters?.endDate || getLocalDateString(now);
      
      // Create proper local timezone boundaries for queries
      const startDateTime = new Date(startDate + 'T00:00:00');
      const endDateTime = new Date(endDate + 'T23:59:59.999');
      const startISO = startDateTime.toISOString();
      const endISO = endDateTime.toISOString();

      const buildSoldQuery = () => {
        let q = supabase
          .from('export_receipt_items')
          .select(`
            id,
            product_name,
            sku,
            imei,
            sale_price,
            quantity,
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
          // Chỉ lấy đơn bán thực tế; trả hàng lấy từ bảng export_returns để tránh tính trùng
          .eq('status', 'sold')
          .neq('export_receipts.status', 'cancelled')
          .gte('export_receipts.export_date', startISO)
          .lte('export_receipts.export_date', endISO);

        if (debouncedFilters?.branchId) {
          q = q.eq('export_receipts.branch_id', debouncedFilters.branchId);
        }
        if (debouncedFilters?.categoryId) {
          q = q.eq('category_id', debouncedFilters.categoryId);
        }
        if (debouncedFilters?.search) {
          q = q.or(`product_name.ilike.%${debouncedFilters.search}%,sku.ilike.%${debouncedFilters.search}%,imei.ilike.%${debouncedFilters.search}%`);
        }
        return q.order('created_at', { ascending: false });
      };

      const soldItems = await fetchAllRows<any>(() => buildSoldQuery());

      // 2. Lấy TOÀN BỘ dữ liệu trả hàng từ export_returns (không giới hạn 1000 dòng)
      const buildReturnQuery = () => {
        let q = supabase
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
          .gte('return_date', startISO)
          .lte('return_date', endISO)
          .order('return_date', { ascending: false });

        if (debouncedFilters?.branchId) {
          q = q.eq('branch_id', debouncedFilters.branchId);
        }

        if (debouncedFilters?.search) {
          q = q.or(`product_name.ilike.%${debouncedFilters.search}%,sku.ilike.%${debouncedFilters.search}%,imei.ilike.%${debouncedFilters.search}%`);
        }

        return q;
      };

      const returnItems = await fetchAllRows<any>(() => buildReturnQuery());

      // 3. Lấy giá nhập của các sản phẩm
      const productIds = Array.from(
        new Set([
          ...(soldItems?.map(i => i.product_id).filter(Boolean) || []),
          ...(returnItems?.map((i: any) => i.product_id).filter(Boolean) || []),
        ])
      );
      let productsMap: Record<string, { import_price: number; quantity: number; category_id: string | null }> = {};
      
      if (productIds.length > 0) {
        // Batch fetch products in chunks of 500 to avoid Supabase default 1000 row limit
        const BATCH_SIZE = 500;
        const allProducts: any[] = [];
        for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
          const batch = productIds.slice(i, i + BATCH_SIZE);
          const { data: products } = await supabase
            .from('products')
            .select('id, import_price, quantity, imei, category_id')
            .in('id', batch)
            .limit(BATCH_SIZE);
          if (products) allProducts.push(...products);
        }
        
        productsMap = allProducts.reduce((acc, p) => {
          acc[p.id] = { 
            import_price: Number(p.import_price),
            quantity: p.quantity || 1,
            category_id: p.category_id,
          };
          return acc;
        }, {} as Record<string, { import_price: number; quantity: number; category_id: string | null }>);
      }

      // 4. Xử lý dữ liệu bán hàng
      const results: DetailedProfitItem[] = [];
      const nonImeiGroupMap: Record<string, DetailedProfitItem> = {};

      soldItems?.forEach(item => {
        const receipt = item.export_receipts as any;
        const productInfo = item.product_id ? productsMap[item.product_id] : null;
        const itemQty = Number(item.quantity ?? 1) || 1;
        const unitImportPrice = productInfo?.import_price || 0;
        const lineImportPrice = unitImportPrice * itemQty;
        const lineSalePrice = Number(item.sale_price) * itemQty;
        const lineProfit = lineSalePrice - lineImportPrice;

        if (item.imei) {
          results.push({
            id: item.id,
            productName: item.product_name,
            sku: item.sku,
            imei: item.imei,
            branchId: receipt?.branch_id,
            branchName: receipt?.branches?.name || 'N/A',
            importPrice: lineImportPrice,
            salePrice: lineSalePrice,
            quantity: itemQty,
            profit: lineProfit,
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
              importPrice: 0,
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
          nonImeiGroupMap[groupKey].importPrice += lineImportPrice;
          nonImeiGroupMap[groupKey].salePrice += lineSalePrice;
          nonImeiGroupMap[groupKey].quantity += itemQty;
          nonImeiGroupMap[groupKey].profit += lineProfit;
        }
      });

      Object.values(nonImeiGroupMap).forEach(group => {
        results.push(group);
      });

      // 5. Xử lý dữ liệu trả hàng
      returnItems?.forEach((item: any) => {
        const productInfo = item.product_id ? productsMap[item.product_id] : null;

        // Lọc theo danh mục nếu có filter
        if (debouncedFilters?.categoryId && productInfo?.category_id !== debouncedFilters.categoryId) {
          return;
        }

        const itemQty = Number(item.quantity ?? 1) || 1;
        const lineSalePrice = Number(item.sale_price) * itemQty;
        const lineImportPrice = (productInfo?.import_price || 0) * itemQty;
        const profit = -(lineSalePrice - lineImportPrice);

        results.push({
          id: `return-${item.id}`,
          productName: item.product_name,
          sku: item.sku,
          imei: item.imei,
          branchId: item.branch_id,
          branchName: (item.branches as any)?.name || 'N/A',
          importPrice: -lineImportPrice,
          salePrice: -lineSalePrice,
          quantity: itemQty,
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
          if (item.status === 'sold') {
            acc.totalQuantity += item.quantity;
          } else {
            // Số lượng thực bán = bán - trả
            acc.totalQuantity -= item.quantity;
          }
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
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
