import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';

export interface SupplierReturnItem {
  supplierId: string;
  supplierName: string;
  phone: string | null;
  returnCount: number;
  totalReturnValue: number;
  avgReturnValue: number;
  returnReasons: Record<string, number>;
  lastReturnDate: string | null;
  products: {
    productName: string;
    sku: string;
    imei: string | null;
    importPrice: number;
    refundAmount: number;
    returnDate: string;
    note: string | null;
  }[];
}

export function useSupplierReturnReport(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  sort?: 'top_count' | 'top_value' | 'recent';
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();
  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    queryKey: ['supplier-return-report', tenant?.id, effectiveBranchId, filters, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) return {
        items: [] as SupplierReturnItem[],
        summary: { totalSuppliers: 0, totalReturns: 0, totalReturnValue: 0, avgReturnValue: 0 },
      };

      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Use local timezone offset for consistency
      const startISO = new Date(startDate + 'T00:00:00').toISOString();
      const endISO = new Date(endDate + 'T23:59:59.999').toISOString();

      let query = supabase
        .from('import_returns')
        .select('id, code, return_date, product_id, supplier_id, branch_id, product_name, sku, imei, import_price, total_refund_amount, note, suppliers(id, name, phone)')
        .gte('return_date', startISO)
        .lte('return_date', endISO);

      if (effectiveBranchId) {
        query = query.eq('branch_id', effectiveBranchId);
      }

      const { data: returns, error } = await query;
      if (error) throw error;

      // Aggregate by supplier
      const supplierMap: Record<string, SupplierReturnItem> = {};

      returns?.forEach(r => {
        const supplier = r.suppliers as any;
        if (!supplier) return;

        const id = supplier.id;
        if (!supplierMap[id]) {
          supplierMap[id] = {
            supplierId: id,
            supplierName: supplier.name,
            phone: supplier.phone,
            returnCount: 0,
            totalReturnValue: 0,
            avgReturnValue: 0,
            returnReasons: {},
            lastReturnDate: null,
            products: [],
          };
        }

        supplierMap[id].returnCount += 1;
        supplierMap[id].totalReturnValue += Number(r.total_refund_amount);

        // Track reasons from notes
        const reason = r.note?.trim() || 'Không ghi lý do';
        supplierMap[id].returnReasons[reason] = (supplierMap[id].returnReasons[reason] || 0) + 1;

        // Track last return date
        if (!supplierMap[id].lastReturnDate || r.return_date > supplierMap[id].lastReturnDate!) {
          supplierMap[id].lastReturnDate = r.return_date;
        }

        supplierMap[id].products.push({
          productName: r.product_name,
          sku: r.sku,
          imei: r.imei,
          importPrice: Number(r.import_price),
          refundAmount: Number(r.total_refund_amount),
          returnDate: r.return_date,
          note: r.note,
        });
      });

      // Calculate averages
      Object.values(supplierMap).forEach(s => {
        if (s.returnCount > 0) {
          s.avgReturnValue = s.totalReturnValue / s.returnCount;
        }
      });

      let items = Object.values(supplierMap);

      // Sort
      switch (filters?.sort) {
        case 'top_value': items.sort((a, b) => b.totalReturnValue - a.totalReturnValue); break;
        case 'recent': items.sort((a, b) => (b.lastReturnDate || '').localeCompare(a.lastReturnDate || '')); break;
        case 'top_count':
        default: items.sort((a, b) => b.returnCount - a.returnCount); break;
      }

      const totalReturns = items.reduce((s, i) => s + i.returnCount, 0);
      const totalReturnValue = items.reduce((s, i) => s + i.totalReturnValue, 0);

      const summary = {
        totalSuppliers: items.length,
        totalReturns,
        totalReturnValue,
        avgReturnValue: totalReturns > 0 ? totalReturnValue / totalReturns : 0,
      };

      return { items, summary };
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}
