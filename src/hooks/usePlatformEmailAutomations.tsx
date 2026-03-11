import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlatformEmailAutomation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_days: number;
  subject: string;
  html_content: string;
  is_enabled: boolean;
  target_audience: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformEmailAutomationLog {
  id: string;
  automation_id: string | null;
  tenant_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  body_html: string | null;
  skip_resend?: boolean;
}

export function usePlatformEmailAutomations() {
  return useQuery({
    queryKey: ['platform-email-automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_email_automations' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PlatformEmailAutomation[];
    },
  });
}

export function usePlatformEmailAutomationLogs() {
  return useQuery({
    queryKey: ['platform-email-automation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_email_automation_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as PlatformEmailAutomationLog[];
    },
  });
}

export function useCreatePlatformEmailAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PlatformEmailAutomation>) => {
      const { data, error } = await supabase
        .from('platform_email_automations' as any)
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PlatformEmailAutomation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-email-automations'] });
      toast.success('Tạo kịch bản email thành công');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdatePlatformEmailAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PlatformEmailAutomation> & { id: string }) => {
      const { error } = await supabase
        .from('platform_email_automations' as any)
        .update({ ...payload, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-email-automations'] });
      toast.success('Đã cập nhật kịch bản');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeletePlatformEmailAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_email_automations' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-email-automations'] });
      toast.success('Đã xóa kịch bản');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
