import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';

export interface BranchValue {
  branchId: string;
  branchName: string;
  inventoryValue: number;
  cashBalance: number;
  customerDebt: number;
  supplierDebt: number;
  totalValue: number;
}

export interface WarehouseValueData {
  inventoryValue: number;
  cashBalance: number;
  customerDebt: number;
  supplierDebt: number;
  totalValue: number;
  branches: BranchValue[];
}

export function useWarehouseValue(branchId?: string) {
  const { data: tenant, isLoading: tenantLoading } = useCurrentTenant();
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  const effectiveBranchId = branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    queryKey: ['warehouse-value', tenant?.id, effectiveBranchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_total_warehouse_value' as any, {
        p_tenant_id: tenant!.id,
        p_branch_id: effectiveBranchId || null,
      });

      if (error) throw error;

      const d = data as any;
      return {
        inventoryValue: Number(d.inventoryValue || 0),
        cashBalance: Number(d.cashBalance || 0),
        customerDebt: Number(d.customerDebt || 0),
        supplierDebt: Number(d.supplierDebt || 0),
        totalValue: Number(d.totalValue || 0),
        branches: ((d.branches || []) as any[]).map((b: any) => ({
          branchId: b.branchId,
          branchName: b.branchName,
          inventoryValue: Number(b.inventoryValue || 0),
          cashBalance: Number(b.cashBalance || 0),
          customerDebt: Number(b.customerDebt || 0),
          supplierDebt: Number(b.supplierDebt || 0),
          totalValue: Number(b.totalValue || 0),
        })),
      } as WarehouseValueData;
    },
    enabled: !tenantLoading && !branchLoading && !!tenant?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
