import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdGateSettings {
  id: string;
  is_enabled: boolean;
  display_duration_seconds: number;
  is_skippable: boolean;
  skip_after_seconds: number;
  pinned_ad_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAdGateSettings() {
  return useQuery({
    queryKey: ['ad-gate-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_gate_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as AdGateSettings;
    },
  });
}

export function useUpdateAdGateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: Partial<AdGateSettings> & { id: string }) => {
      const { id, ...rest } = updates;
      const { data, error } = await supabase
        .from('ad_gate_settings')
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
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
