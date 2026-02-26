import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';

export interface CustomPaymentSource {
  id: string;
  source_key: string;
  name: string;
}

export function useCustomPaymentSources() {
  const { data: tenant } = useCurrentTenant();

  return useQuery({
    queryKey: ['custom-payment-sources', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_payment_sources')
        .select('id, source_key, name')
        .order('created_at');

      if (error) throw error;
      return (data || []).map(s => ({ id: s.source_key, name: s.name, dbId: s.id }));
    },
    enabled: !!tenant?.id,
  });
}

export function useAddCustomPaymentSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourceKey, name }: { sourceKey: string; name: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get tenant_id
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('custom_payment_sources')
        .insert([{
          tenant_id: tenantId,
          source_key: sourceKey,
          name,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-payment-sources'] });
    },
  });
}

export function useDeleteCustomPaymentSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceKey: string) => {
      const { error } = await supabase
        .from('custom_payment_sources')
        .delete()
        .eq('source_key', sourceKey);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-payment-sources'] });
    },
  });
}
