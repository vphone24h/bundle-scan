import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  note: string | null;
  is_default: boolean;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export function useBranches() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['branches', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, address, phone, note, is_default, tenant_id, created_at, updated_at')
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data as Branch[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 phút - branches ít thay đổi
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useDefaultBranch() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['default-branch', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, address, phone, note, is_default, tenant_id, created_at, updated_at')
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      return data as Branch | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branch: { name: string; address?: string; phone?: string; note?: string }) => {
      // Get current tenant_id
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('branches')
        .insert([{ ...branch, tenant_id: tenantId }])
        .select()
        .single();

      if (error) throw error;
      return data as Branch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Branch> & { id: string }) => {
      const { data, error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Branch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}
