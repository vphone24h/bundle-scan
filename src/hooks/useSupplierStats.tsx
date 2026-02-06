import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SupplierStat {
  supplierId: string;
  supplierName: string;
  totalImportValue: number;
  totalDebt: number;
  receiptCount: number;
  avgReceiptValue: number;
}

export function useSupplierStats(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['supplier-stats', user?.id, filters?.startDate, filters?.endDate, filters?.branchId],
    queryFn: async () => {
      let query = supabase
        .from('import_receipts')
        .select('id, supplier_id, total_amount, debt_amount, import_date, branch_id, suppliers(id, name)')
        .eq('status', 'completed');

      if (filters?.startDate) {
        query = query.gte('import_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('import_date', filters.endDate);
      }
      if (filters?.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate by supplier
      const supplierMap = new Map<string, SupplierStat>();

      for (const receipt of data || []) {
        const supplierId = receipt.supplier_id;
        if (!supplierId) continue;

        const supplierData = receipt.suppliers as any;
        const supplierName = supplierData?.name || 'Không rõ';

        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, {
            supplierId,
            supplierName,
            totalImportValue: 0,
            totalDebt: 0,
            receiptCount: 0,
            avgReceiptValue: 0,
          });
        }

        const stat = supplierMap.get(supplierId)!;
        stat.totalImportValue += Number(receipt.total_amount) || 0;
        stat.totalDebt += Number(receipt.debt_amount) || 0;
        stat.receiptCount += 1;
      }

      // Calculate averages
      for (const stat of supplierMap.values()) {
        stat.avgReceiptValue = stat.receiptCount > 0 ? stat.totalImportValue / stat.receiptCount : 0;
      }

      return Array.from(supplierMap.values());
    },
    enabled: !!user?.id,
  });
}
