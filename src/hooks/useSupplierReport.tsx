import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { fetchAllRows } from '@/lib/fetchAllRows';

export interface SupplierReportItem {
  supplierId: string;
  supplierName: string;
  phone: string | null;
  totalImportAmount: number;
  importCount: number;
  debtAmount: number;
  paidAmount: number;
  productCount: number;
  avgImportPrice: number;
  lastImportDate: string | null;
}

export function useSupplierReport(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  sort?: 'top_import' | 'top_debt' | 'top_count' | 'avg_price';
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();
  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    queryKey: ['supplier-report', tenant?.id, effectiveBranchId, filters, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) return { items: [] as SupplierReportItem[], summary: { totalSuppliers: 0, totalImportAmount: 0, totalDebt: 0, totalPaid: 0 } };

      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const startISO = new Date(startDate + 'T00:00:00').toISOString();
      const endISO = new Date(endDate + 'T23:59:59.999').toISOString();

      // Get import receipts
      let query = supabase
        .from('import_receipts')
        .select('id, supplier_id, total_amount, paid_amount, debt_amount, import_date, branch_id, status, suppliers(id, name, phone)')
        .neq('status', 'cancelled')
        .gte('import_date', startISO)
        .lte('import_date', endISO);

      if (effectiveBranchId) {
        query = query.eq('branch_id', effectiveBranchId);
      }

      const { data: receipts, error } = await query;
      if (error) throw error;

      // Get product counts per supplier
      const { data: productCounts } = await supabase
        .from('products')
        .select('supplier_id, id')
        .not('supplier_id', 'is', null);

      const productCountMap: Record<string, number> = {};
      productCounts?.forEach(p => {
        if (p.supplier_id) {
          productCountMap[p.supplier_id] = (productCountMap[p.supplier_id] || 0) + 1;
        }
      });

      // Aggregate by supplier
      const supplierMap: Record<string, SupplierReportItem> = {};

      receipts?.forEach(r => {
        const supplier = r.suppliers as any;
        if (!supplier) return;

        const id = supplier.id;
        if (!supplierMap[id]) {
          supplierMap[id] = {
            supplierId: id,
            supplierName: supplier.name,
            phone: supplier.phone,
            totalImportAmount: 0,
            importCount: 0,
            debtAmount: 0,
            paidAmount: 0,
            productCount: productCountMap[id] || 0,
            avgImportPrice: 0,
            lastImportDate: null,
          };
        }
        supplierMap[id].totalImportAmount += Number(r.total_amount);
        supplierMap[id].importCount += 1;
        supplierMap[id].debtAmount += Number(r.debt_amount || 0);
        supplierMap[id].paidAmount += Number(r.paid_amount || 0);

        const importDate = r.import_date;
        if (!supplierMap[id].lastImportDate || importDate > supplierMap[id].lastImportDate!) {
          supplierMap[id].lastImportDate = importDate;
        }
      });

      // Calculate avg import price
      Object.values(supplierMap).forEach(s => {
        if (s.importCount > 0) {
          s.avgImportPrice = s.totalImportAmount / s.importCount;
        }
      });

      let items = Object.values(supplierMap);

      // Sort
      switch (filters?.sort) {
        case 'top_debt': items.sort((a, b) => b.debtAmount - a.debtAmount); break;
        case 'top_count': items.sort((a, b) => b.importCount - a.importCount); break;
        case 'avg_price': items.sort((a, b) => b.avgImportPrice - a.avgImportPrice); break;
        case 'top_import':
        default: items.sort((a, b) => b.totalImportAmount - a.totalImportAmount); break;
      }

      const summary = {
        totalSuppliers: items.length,
        totalImportAmount: items.reduce((s, i) => s + i.totalImportAmount, 0),
        totalDebt: items.reduce((s, i) => s + i.debtAmount, 0),
        totalPaid: items.reduce((s, i) => s + i.paidAmount, 0),
      };

      return { items, summary };
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}
