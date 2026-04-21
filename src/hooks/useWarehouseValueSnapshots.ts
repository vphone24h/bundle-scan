import { useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useWarehouseValue, type WarehouseValueData } from './useWarehouseValue';
import { toast } from 'sonner';
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
      let checkQuery = supabase
        .from('warehouse_value_snapshots')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('snapshot_date', today);
      
      if (branchId) {
        checkQuery = checkQuery.eq('branch_id', branchId);
      } else {
        checkQuery = checkQuery.is('branch_id', null);
      }
      const { data: existing } = await checkQuery.maybeSingle();

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
  customTo?: string,
  groupBy: number = 1
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

  // Backfill mutation
  const queryClient = useQueryClient();
  const backfillMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase.rpc('backfill_warehouse_snapshots_v2', {
        _tid: tenant.id,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-snapshots'] });
      toast.success(`Đã khôi phục ${count} ngày dữ liệu lịch sử`);
    },
    onError: () => {
      toast.error('Không thể khôi phục dữ liệu lịch sử');
    },
  });

  return { chartData, isLoading, percentChange, backfillMutation };
}

/** Aggregate snapshots by groupBy days */
export function aggregateSnapshots(data: WarehouseSnapshot[], groupBy: number): WarehouseSnapshot[] {
  if (groupBy <= 1 || data.length === 0) return data;

  const result: WarehouseSnapshot[] = [];
  for (let i = 0; i < data.length; i += groupBy) {
    const chunk = data.slice(i, i + groupBy);
    const avg = (key: keyof Omit<WarehouseSnapshot, 'date'>) =>
      Math.round(chunk.reduce((s, c) => s + c[key], 0) / chunk.length);

    const startDate = chunk[0].date;
    const endDate = chunk[chunk.length - 1].date;
    const label = startDate === endDate
      ? startDate
      : groupBy >= 30
        ? `T${format(parseISO(startDate), 'MM/yy')}`
        : `${format(parseISO(startDate), 'dd/MM')}-${format(parseISO(endDate), 'dd/MM')}`;

    result.push({
      date: label,
      totalValue: avg('totalValue'),
      inventoryValue: avg('inventoryValue'),
      cashBalance: avg('cashBalance'),
      customerDebt: avg('customerDebt'),
      supplierDebt: avg('supplierDebt'),
    });
  }
  return result;
}
