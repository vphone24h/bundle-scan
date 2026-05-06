import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
  children?: Category[];
}

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage when switching accounts/stores
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: { name: string; parent_id?: string | null }) => {
      // Get current tenant_id
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('categories')
        .insert([{ ...category, tenant_id: tenantId }])
        .select()
        .maybeSingle();

      if (error) {
        // If duplicate (unique violation) or RLS hides return, try to fetch existing one
        const { data: existing } = await supabase
          .from('categories')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('name', category.name)
          .limit(1)
          .maybeSingle();
        if (existing) return existing;
        throw error;
      }
      if (!data) {
        const { data: existing } = await supabase
          .from('categories')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('name', category.name)
          .limit(1)
          .maybeSingle();
        if (existing) return existing;
        throw new Error('Không tạo được danh mục');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; parent_id?: string | null }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
