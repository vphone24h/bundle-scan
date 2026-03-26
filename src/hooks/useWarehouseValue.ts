import { useMemo } from 'react';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { useCustomerDebts, useSupplierDebts } from './useDebt';
import { useCashBook } from './useCashBook';
import { useInventory } from './useInventory';

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

  const effectiveBranchId = branchId || (shouldFilter ? userBranchId : undefined);

  // 1. Inventory - reuse existing hook (already correct)
  const { data: inventory, isLoading: invLoading } = useInventory();

  // 2. Cash book - reuse existing hook
  const { data: cashBookEntries, isLoading: cashLoading } = useCashBook({
    branchId: effectiveBranchId,
  });

  // 3. Customer debts - reuse existing hook
  const { data: customerDebts, isLoading: custLoading } = useCustomerDebts(false);

  // 4. Supplier debts - reuse existing hook
  const { data: supplierDebts, isLoading: suppLoading } = useSupplierDebts(false);

  const isLoading = invLoading || cashLoading || custLoading || suppLoading || tenantLoading || branchLoading;

  const data = useMemo<WarehouseValueData | undefined>(() => {
    if (!inventory) return undefined;

    // Inventory value from existing inventory data (totalImportCost per item)
    const invByBranch = new Map<string, { name: string; value: number }>();
    let totalInventory = 0;
    inventory.forEach((item) => {
      if (effectiveBranchId && item.branchId !== effectiveBranchId) return;
      const cost = item.totalImportCost || 0;
      totalInventory += cost;
      if (item.branchId) {
        const existing = invByBranch.get(item.branchId);
        if (existing) {
          existing.value += cost;
        } else {
          invByBranch.set(item.branchId, {
            name: item.branchName || 'Không xác định',
            value: cost,
          });
        }
      }
    });

    // Cash balance from cash book entries
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

    // Customer debt totals
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

    // Supplier debt totals
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

    // Build branch breakdown
    const branchMap = new Map<string, BranchValue>();

    const ensureBranch = (bid: string, name: string) => {
      if (!branchMap.has(bid)) {
        branchMap.set(bid, {
          branchId: bid,
          branchName: name,
          inventoryValue: 0,
          cashBalance: 0,
          customerDebt: 0,
          supplierDebt: 0,
          totalValue: 0,
        });
      }
      return branchMap.get(bid)!;
    };

    invByBranch.forEach((val, bid) => {
      ensureBranch(bid, val.name).inventoryValue = val.value;
    });
    cashByBranch.forEach((val, bid) => {
      ensureBranch(bid, val.name).cashBalance = val.balance;
    });
    custByBranch.forEach((val, bid) => {
      const b = branchMap.get(bid);
      if (b) b.customerDebt = val;
    });
    suppByBranch.forEach((val, bid) => {
      const b = branchMap.get(bid);
      if (b) b.supplierDebt = val;
    });

    const branches: BranchValue[] = [];
    branchMap.forEach((b) => {
      b.totalValue = b.inventoryValue + b.cashBalance + b.customerDebt - b.supplierDebt;
      branches.push(b);
    });
    branches.sort((a, b) => b.totalValue - a.totalValue);

    return {
      inventoryValue: totalInventory,
      cashBalance: totalCash,
      customerDebt: totalCustDebt,
      supplierDebt: totalSuppDebt,
      totalValue: totalInventory + totalCash + totalCustDebt - totalSuppDebt,
      branches,
    };
  }, [inventory, cashBookEntries, customerDebts, supplierDebts, effectiveBranchId]);

  return { data, isLoading };
}
