import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmailAutomation {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: string;
  trigger_days: number;
  subject: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailAutomationBlock {
  id: string;
  automation_id: string;
  block_type: string;
  content: any;
  display_order: number;
}

export interface EmailAutomationLog {
  id: string;
  tenant_id: string;
  automation_id: string;
  customer_email: string;
  customer_name: string | null;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
}

export function useEmailAutomations() {
  return useQuery({
    queryKey: ['email-automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_automations' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EmailAutomation[];
    },
  });
}

export function useEmailAutomationBlocks(automationId: string | null) {
  return useQuery({
    queryKey: ['email-automation-blocks', automationId],
    enabled: !!automationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_automation_blocks' as any)
        .select('*')
        .eq('automation_id', automationId!)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EmailAutomationBlock[];
    },
  });
}

export function useEmailAutomationLogs() {
  return useQuery({
    queryKey: ['email-automation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_automation_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as EmailAutomationLog[];
    },
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EmailAutomation>) => {
      const { data, error } = await supabase
        .from('email_automations' as any)
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EmailAutomation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-automations'] });
      toast.success('Tạo kịch bản thành công');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<EmailAutomation> & { id: string }) => {
      const { error } = await supabase
        .from('email_automations' as any)
        .update({ ...payload, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-automations'] });
      toast.success('Đã cập nhật');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_automations' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-automations'] });
      toast.success('Đã xóa kịch bản');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSaveBlocks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ automationId, blocks }: { automationId: string; blocks: Omit<EmailAutomationBlock, 'id'>[] }) => {
      // Delete existing blocks then re-insert
      await supabase
        .from('email_automation_blocks' as any)
        .delete()
        .eq('automation_id', automationId);

      if (blocks.length > 0) {
        const { error } = await supabase
          .from('email_automation_blocks' as any)
          .insert(blocks.map((b, i) => ({ ...b, automation_id: automationId, display_order: i })) as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['email-automation-blocks', vars.automationId] });
      toast.success('Đã lưu nội dung email');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
