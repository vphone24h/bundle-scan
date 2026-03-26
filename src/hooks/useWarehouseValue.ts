import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { useCustomerDebts, useSupplierDebts } from './useDebt';
import { useCashBook } from './useCashBook';

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

  // 1. Inventory value from RPC
  const { data: invData, isLoading: invLoading } = useQuery({
    queryKey: ['warehouse-inventory-value', tenant?.id, effectiveBranchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_total_warehouse_value' as any, {
        p_tenant_id: tenant!.id,
        p_branch_id: effectiveBranchId || null,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !tenantLoading && !branchLoading && !!tenant?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // 2. Cash book - reuse existing hook (all entries, no date filter)
  const { data: cashBookEntries, isLoading: cashLoading } = useCashBook({
    branchId: effectiveBranchId,
  });

  // 3. Customer debts - reuse existing hook
  const { data: customerDebts, isLoading: custLoading } = useCustomerDebts(false);

  // 4. Supplier debts - reuse existing hook
  const { data: supplierDebts, isLoading: suppLoading } = useSupplierDebts(false);

  const isLoading = invLoading || cashLoading || custLoading || suppLoading || tenantLoading || branchLoading;

  const data = useMemo<WarehouseValueData | undefined>(() => {
    if (!invData) return undefined;

    // Cash balance from cash book entries (same logic as CashBookPage)
    const cashByBranch = new Map<string, { name: string; balance: number }>();
    let totalCash = 0;
    (cashBookEntries || []).forEach((entry) => {
      const amount = entry.type === 'income' ? entry.amount : -entry.amount;
      totalCash += amount;
      if (entry.branch_id) {
        const existing = cashByBranch.get(entry.branch_id);
        if (existing) {
          existing.balance += amount;
        } else {
          cashByBranch.set(entry.branch_id, {
            name: entry.branches?.name || 'Không xác định',
            balance: amount,
          });
        }
      }
    });

    // Customer debt totals (remaining_amount = what customers owe us)
    const custByBranch = new Map<string, number>();
    let totalCustDebt = 0;
    (customerDebts || []).forEach((d) => {
      const remaining = d.remaining_amount || 0;
      if (remaining <= 0) return;
      totalCustDebt += remaining;
      if (d.branch_id) {
        custByBranch.set(d.branch_id, (custByBranch.get(d.branch_id) || 0) + remaining);
      }
    });

    // Supplier debt totals (remaining_amount = what we owe suppliers)
    const suppByBranch = new Map<string, number>();
    let totalSuppDebt = 0;
    (supplierDebts || []).forEach((d) => {
      const remaining = d.remaining_amount || 0;
      if (remaining <= 0) return;
      totalSuppDebt += remaining;
      if (d.branch_id) {
        suppByBranch.set(d.branch_id, (suppByBranch.get(d.branch_id) || 0) + remaining);
      }
    });

    // Inventory per branch from RPC
    const invBranches = (invData.branches || []) as any[];
    const totalInventory = Number(invData.totalInventory || 0);

    // Build branch breakdown
    const branchMap = new Map<string, BranchValue>();
    invBranches.forEach((b: any) => {
      branchMap.set(b.branchId, {
        branchId: b.branchId,
        branchName: b.branchName,
        inventoryValue: Number(b.inventoryValue || 0),
        cashBalance: 0,
        customerDebt: 0,
        supplierDebt: 0,
        totalValue: 0,
      });
    });

    // Merge cash balance into branches
    cashByBranch.forEach((val, bid) => {
      const existing = branchMap.get(bid);
      if (existing) {
        existing.cashBalance = val.balance;
      } else {
        branchMap.set(bid, {
          branchId: bid,
          branchName: val.name,
          inventoryValue: 0,
          cashBalance: val.balance,
          customerDebt: 0,
          supplierDebt: 0,
          totalValue: 0,
        });
      }
    });

    // Merge customer debt
    custByBranch.forEach((val, bid) => {
      const existing = branchMap.get(bid);
      if (existing) {
        existing.customerDebt = val;
      }
    });

    // Merge supplier debt
    suppByBranch.forEach((val, bid) => {
      const existing = branchMap.get(bid);
      if (existing) {
        existing.supplierDebt = val;
      }
    });

    // Calculate total values
    const branches: BranchValue[] = [];
    branchMap.forEach((b) => {
      b.totalValue = b.inventoryValue + b.cashBalance + b.customerDebt - b.supplierDebt;
      branches.push(b);
    });
    branches.sort((a, b) => b.totalValue - a.totalValue);

    const totalValue = totalInventory + totalCash + totalCustDebt - totalSuppDebt;

    return {
      inventoryValue: totalInventory,
      cashBalance: totalCash,
      customerDebt: totalCustDebt,
      supplierDebt: totalSuppDebt,
      totalValue,
      branches,
    };
  }, [invData, cashBookEntries, customerDebts, supplierDebts]);

  return { data, isLoading };
}
