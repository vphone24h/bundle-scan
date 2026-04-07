import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminCompanyId } from './useAdminCompanyId';

export interface AdGateSettings {
  id: string;
  is_enabled: boolean;
  display_duration_seconds: number;
  is_skippable: boolean;
  skip_after_seconds: number;
  pinned_ad_id: string | null;
  clicks_per_ad: number;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAdGateSettings() {
  const { companyId, isPlatformAdmin } = useAdminCompanyId();

  return useQuery({
    queryKey: ['ad-gate-settings', companyId],
    queryFn: async () => {
      let query = supabase
        .from('ad_gate_settings')
        .select('*');
      
      if (isPlatformAdmin) {
        query = query.is('company_id', null);
      } else {
        query = query.eq('company_id', companyId!);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as AdGateSettings | null;
    },
  });
}

export function useUpdateAdGateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId, isPlatformAdmin } = useAdminCompanyId();

  return useMutation({
    mutationFn: async (updates: Partial<AdGateSettings> & { id?: string }) => {
      const { id, ...rest } = updates;
      
      if (id) {
        // Update existing
        const { data, error } = await supabase
          .from('ad_gate_settings')
          .update(rest)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Create new for this company scope
        const { data, error } = await supabase
          .from('ad_gate_settings')
          .insert({ ...rest, company_id: isPlatformAdmin ? null : companyId })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-gate-settings'] });
      toast({ title: 'Đã lưu cài đặt Ad Gate' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}
