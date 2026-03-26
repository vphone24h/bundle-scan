import { useMemo } from 'react';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { useCustomerDebts, useSupplierDebts } from './useDebt';
import { useCashBook } from './useCashBook';
import { useInventory } from './useInventory';
import { useBranches } from './useBranches';

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
  const { isLoading: tenantLoading } = useCurrentTenant();
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();
  const { data: branches } = useBranches();

  const effectiveBranchId = branchId || (shouldFilter ? userBranchId : undefined);

  const { data: inventory, isLoading: invLoading } = useInventory();
  const { data: cashBookEntries, isLoading: cashLoading } = useCashBook({ branchId: effectiveBranchId });
  const { data: customerDebts, isLoading: custLoading } = useCustomerDebts(false);
  const { data: supplierDebts, isLoading: suppLoading } = useSupplierDebts(false);

  const isLoading = invLoading || cashLoading || custLoading || suppLoading || tenantLoading || branchLoading;

  const data = useMemo<WarehouseValueData | undefined>(() => {
    if (!inventory || !branches) return undefined;

    // Build valid branch set from tenant's actual branches
    const validBranches = new Map<string, string>();
    branches.forEach((b) => validBranches.set(b.id, b.name));

    // Inventory value
    const invByBranch = new Map<string, number>();
    let totalInventory = 0;
    inventory.forEach((item) => {
      if (effectiveBranchId && item.branchId !== effectiveBranchId) return;
      const cost = item.totalImportCost || 0;
      totalInventory += cost;
      if (item.branchId && validBranches.has(item.branchId)) {
        invByBranch.set(item.branchId, (invByBranch.get(item.branchId) || 0) + cost);
      }
    });

    // Cash balance
    const cashByBranch = new Map<string, number>();
    let totalCash = 0;
    (cashBookEntries || []).forEach((entry) => {
      const amount = entry.type === 'income' ? entry.amount : -entry.amount;
      totalCash += amount;
      if (entry.branch_id && validBranches.has(entry.branch_id)) {
        cashByBranch.set(entry.branch_id, (cashByBranch.get(entry.branch_id) || 0) + amount);
      }
    });

    // Customer debt
    const custByBranch = new Map<string, number>();
    let totalCustDebt = 0;
    (customerDebts || []).forEach((d) => {
      const remaining = d.remaining_amount || 0;
      if (remaining <= 0) return;
      if (effectiveBranchId && d.branch_id !== effectiveBranchId) return;
      totalCustDebt += remaining;
      if (d.branch_id && validBranches.has(d.branch_id)) {
        custByBranch.set(d.branch_id, (custByBranch.get(d.branch_id) || 0) + remaining);
      }
    });

    // Supplier debt
    const suppByBranch = new Map<string, number>();
    let totalSuppDebt = 0;
    (supplierDebts || []).forEach((d) => {
      const remaining = d.remaining_amount || 0;
      if (remaining <= 0) return;
      if (effectiveBranchId && d.branch_id !== effectiveBranchId) return;
      totalSuppDebt += remaining;
      if (d.branch_id && validBranches.has(d.branch_id)) {
        suppByBranch.set(d.branch_id, (suppByBranch.get(d.branch_id) || 0) + remaining);
      }
    });

    // Build branches - only from valid tenant branches
    const branchList: BranchValue[] = [];
    validBranches.forEach((name, bid) => {
      if (effectiveBranchId && bid !== effectiveBranchId) return;
      const inv = invByBranch.get(bid) || 0;
      const cash = cashByBranch.get(bid) || 0;
      const cust = custByBranch.get(bid) || 0;
      const supp = suppByBranch.get(bid) || 0;
      branchList.push({
        branchId: bid,
        branchName: name,
        inventoryValue: inv,
        cashBalance: cash,
        customerDebt: cust,
        supplierDebt: supp,
        totalValue: inv + cash + cust - supp,
      });
    });
    branchList.sort((a, b) => b.totalValue - a.totalValue);

    return {
      inventoryValue: totalInventory,
      cashBalance: totalCash,
      customerDebt: totalCustDebt,
      supplierDebt: totalSuppDebt,
      totalValue: totalInventory + totalCash + totalCustDebt - totalSuppDebt,
      branches: branchList,
    };
  }, [inventory, cashBookEntries, customerDebts, supplierDebts, effectiveBranchId, branches]);

  return { data, isLoading };
}
