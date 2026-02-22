import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationAutomation {
  id: string;
  trigger_type: string;
  title: string;
  message: string;
  full_content: string | null;
  link_url: string | null;
  button_text: string | null;
  delay_minutes: number;
  is_enabled: boolean;
  channels: string[];
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useNotificationAutomations() {
  return useQuery({
    queryKey: ['notification-automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_automations')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as NotificationAutomation[];
    },
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<NotificationAutomation> & { id: string }) => {
      const { data, error } = await supabase
        .from('notification_automations')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-automations'] });
    },
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (automation: Partial<NotificationAutomation>) => {
      const { data, error } = await supabase
        .from('notification_automations')
        .insert(automation as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-automations'] });
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notification_automations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-automations'] });
    },
  });
}
