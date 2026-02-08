import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  branch_id: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSuppliers() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['suppliers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!user?.id,
  });
}

/** Suppliers filtered by a specific branch_id (for import page etc.) */
export function useSuppliersByBranch(branchId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['suppliers', 'branch', branchId, user?.id],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('branch_id', branchId)
        .order('name');

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!user?.id && !!branchId,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplier: { name: string; phone?: string | null; address?: string | null; note?: string | null; branch_id?: string | null }) => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('suppliers')
        .insert([{ ...supplier, tenant_id: tenantId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; phone?: string | null; address?: string | null; note?: string | null }) => {
      // Explicitly exclude branch_id from updates - never allow changing branch
      const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}
