import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CustomerSource {
  id: string;
  tenant_id: string | null;
  name: string;
  is_default: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useCustomerSources() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['customer_sources', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_sources')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as CustomerSource[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,
  });
}

export function useCreateCustomerSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Get tenant_id
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Get max display_order
      const { data: maxOrder } = await supabase
        .from('customer_sources')
        .select('display_order')
        .eq('tenant_id', tenantId)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const newOrder = (maxOrder?.display_order || 10) + 1;

      const { data, error } = await supabase
        .from('customer_sources')
        .insert([{ 
          name: name.trim(), 
          tenant_id: tenantId,
          display_order: newOrder,
          is_default: false
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Nguồn khách hàng này đã tồn tại');
        }
        throw error;
      }
      return data as CustomerSource;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer_sources'] });
    },
  });
}

export function useDeleteCustomerSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customer_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer_sources'] });
    },
  });
}
