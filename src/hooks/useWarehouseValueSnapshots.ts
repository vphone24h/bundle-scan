import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useWarehouseValue, type WarehouseValueData } from './useWarehouseValue';
import { startOfDay, subDays, format } from 'date-fns';

export interface WarehouseSnapshot {
  date: string;
  totalValue: number;
  inventoryValue: number;
  cashBalance: number;
  customerDebt: number;
  supplierDebt: number;
}

// Save today's snapshot if it doesn't exist
function useSaveSnapshot(data: WarehouseValueData | undefined, branchId?: string) {
  const { data: tenant } = useCurrentTenant();

  useEffect(() => {
    if (!data || !tenant?.id) return;
    const today = format(new Date(), 'yyyy-MM-dd');

    const save = async () => {
      const { data: existing } = await supabase
        .from('warehouse_value_snapshots')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('snapshot_date', today)
        .is('branch_id', branchId ?? null)
        .maybeSingle();

      if (existing) return;

      // Save total snapshot
      await supabase.from('warehouse_value_snapshots').insert({
        tenant_id: tenant.id,
        branch_id: branchId ?? null,
        snapshot_date: today,
        inventory_value: data.inventoryValue,
        cash_balance: data.cashBalance,
        customer_debt: data.customerDebt,
        supplier_debt: data.supplierDebt,
        total_value: data.totalValue,
      });

      // Save per-branch snapshots
      if (!branchId && data.branches.length > 0) {
        for (const branch of data.branches) {
          const { data: branchExisting } = await supabase
            .from('warehouse_value_snapshots')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('snapshot_date', today)
            .eq('branch_id', branch.branchId)
            .maybeSingle();

          if (!branchExisting) {
            await supabase.from('warehouse_value_snapshots').insert({
              tenant_id: tenant.id,
              branch_id: branch.branchId,
              snapshot_date: today,
              inventory_value: branch.inventoryValue,
              cash_balance: branch.cashBalance,
              customer_debt: branch.customerDebt,
              supplier_debt: branch.supplierDebt,
              total_value: branch.totalValue,
            });
          }
        }
      }
    };

    save();
  }, [data, tenant?.id, branchId]);
}

export function useWarehouseValueSnapshots(
  days: number,
  branchId?: string,
  customFrom?: string,
  customTo?: string
) {
  const { data: tenant } = useCurrentTenant();
  const { data: currentData } = useWarehouseValue(branchId);

  // Save snapshot on load
  useSaveSnapshot(currentData, undefined);

  const fromDate = customFrom || format(subDays(startOfDay(new Date()), days - 1), 'yyyy-MM-dd');
  const toDate = customTo || format(new Date(), 'yyyy-MM-dd');

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['warehouse-snapshots', tenant?.id, branchId, fromDate, toDate],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('warehouse_value_snapshots')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('snapshot_date', fromDate)
        .lte('snapshot_date', toDate)
        .order('snapshot_date', { ascending: true });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      } else {
        query = query.is('branch_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const chartData = useMemo<WarehouseSnapshot[]>(() => {
    if (!snapshots?.length) {
      // If no historical data, show current data as today's point
      if (currentData) {
        return [{
          date: format(new Date(), 'yyyy-MM-dd'),
          totalValue: currentData.totalValue,
          inventoryValue: currentData.inventoryValue,
          cashBalance: currentData.cashBalance,
          customerDebt: currentData.customerDebt,
          supplierDebt: currentData.supplierDebt,
        }];
      }
      return [];
    }

    return snapshots.map((s) => ({
      date: s.snapshot_date,
      totalValue: Number(s.total_value),
      inventoryValue: Number(s.inventory_value),
      cashBalance: Number(s.cash_balance),
      customerDebt: Number(s.customer_debt),
      supplierDebt: Number(s.supplier_debt),
    }));
  }, [snapshots, currentData]);

  // Calculate % change
  const percentChange = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].totalValue;
    const last = chartData[chartData.length - 1].totalValue;
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }, [chartData]);

  return { chartData, isLoading, percentChange };
}
