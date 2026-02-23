import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DebtSettings {
  id: string;
  tenant_id: string;
  overdue_days: number;
  created_at: string;
  updated_at: string;
}

export function useDebtSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['debt-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_settings')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data as DebtSettings | null;
    },
    enabled: !!user?.id,
  });
}

export function useUpsertDebtSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (overdueDays: number) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data: existing } = await supabase
        .from('debt_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('debt_settings')
          .update({ overdue_days: overdueDays })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('debt_settings')
          .insert({ tenant_id: tenantId, overdue_days: overdueDays });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-settings'] });
    },
  });
}
