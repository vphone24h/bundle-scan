import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ProductGroup {
  id: string;
  tenant_id: string;
  name: string;
  sku_prefix: string | null;
  category_id: string | null;
  variant_1_label: string | null;
  variant_2_label: string | null;
  variant_3_label: string | null;
  variant_1_values: string[];
  variant_2_values: string[];
  variant_3_values: string[];
  created_at: string;
  updated_at: string;
}

async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export function useProductGroups(search?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['product-groups', user?.id, search],
    queryFn: async () => {
      let query = supabase
        .from('product_groups')
        .select('*')
        .order('name', { ascending: true });

      if (search && search.length >= 2) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ProductGroup[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateProductGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (group: {
      name: string;
      sku_prefix?: string;
      category_id?: string | null;
      variant_1_label?: string;
      variant_2_label?: string;
      variant_3_label?: string;
      variant_1_values?: string[];
      variant_2_values?: string[];
      variant_3_values?: string[];
    }) => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('product_groups')
        .insert([{ ...group, tenant_id: tenantId } as any])
        .select()
        .single();

      if (error) throw error;
      return data as unknown as ProductGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-groups'] });
    },
  });
}
