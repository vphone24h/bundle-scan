import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Supplier } from './useSuppliers';

export interface DuplicateGroup {
  key: string; // name|phone|branch_id
  name: string;
  phone: string | null;
  branchId: string | null;
  suppliers: Supplier[];
}

/**
 * Detect duplicate suppliers: same name (case-insensitive) + same phone + same branch_id
 */
export function useDuplicateSuppliers(suppliers: Supplier[] | undefined) {
  return useMemo(() => {
    if (!suppliers || suppliers.length === 0) return [];

    const groupMap = new Map<string, Supplier[]>();

    for (const s of suppliers) {
      const key = `${s.name.trim().toLowerCase()}|${(s.phone || '').trim()}|${s.branch_id || ''}`;
      const group = groupMap.get(key) || [];
      group.push(s);
      groupMap.set(key, group);
    }

    const duplicates: DuplicateGroup[] = [];
    for (const [key, group] of groupMap.entries()) {
      if (group.length >= 2) {
        duplicates.push({
          key,
          name: group[0].name,
          phone: group[0].phone,
          branchId: group[0].branch_id,
          suppliers: group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        });
      }
    }

    return duplicates;
  }, [suppliers]);
}

export function useMergeSuppliers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ primaryId, duplicateIds }: { primaryId: string; duplicateIds: string[] }) => {
      const { error } = await supabase.rpc('merge_suppliers', {
        _primary_id: primaryId,
        _duplicate_ids: duplicateIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
    },
  });
}
