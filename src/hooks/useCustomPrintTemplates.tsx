import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

export interface CustomPrintTemplate {
  id: string;
  tenant_id: string;
  name: string;
  paper_size: 'A4' | 'A5';
  branch_id: string | null;
  is_default: boolean;
  is_active: boolean;
  template_data: Record<string, any>;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  scale_percent: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = 'custom-print-templates';

export function useCustomPrintTemplates() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_print_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CustomPrintTemplate[];
    },
  });
}

// Get active custom templates, optionally filtered by branch
export function useActiveCustomPrintTemplates(branchId?: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, 'active', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_print_templates')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false });
      if (error) throw error;
      const all = (data || []) as CustomPrintTemplate[];
      // Filter: matching branch or global (null branch)
      return all.filter(t => !t.branch_id || t.branch_id === branchId);
    },
  });
}

// Get the default active custom template for a branch
export function useDefaultCustomPrintTemplate(branchId?: string | null) {
  const { data: templates } = useActiveCustomPrintTemplates(branchId);
  // Priority: branch-specific default > global default > first active
  if (!templates?.length) return null;
  const branchDefault = templates.find(t => t.branch_id === branchId && t.is_default);
  if (branchDefault) return branchDefault;
  const globalDefault = templates.find(t => !t.branch_id && t.is_default);
  if (globalDefault) return globalDefault;
  return templates[0];
}

export function useCreateCustomPrintTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Partial<CustomPrintTemplate>) => {
      if (!user) throw new Error('Chưa đăng nhập');

      const { data: pu } = await supabase
        .from('platform_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const { data: ur } = await supabase
        .from('user_roles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const tenantId = pu?.tenant_id || ur?.tenant_id;
      if (!tenantId) throw new Error('Không tìm thấy cửa hàng');

      const { data, error } = await supabase
        .from('custom_print_templates')
        .insert({ ...input as any, tenant_id: tenantId, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as CustomPrintTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Thành công', description: 'Đã tạo mẫu in mới' });
    },
    onError: (e: Error) => {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    },
  });
}

export function useUpdateCustomPrintTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomPrintTemplate> & { id: string }) => {
      const { error } = await supabase
        .from('custom_print_templates')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Đã lưu', description: 'Mẫu in đã được cập nhật' });
    },
    onError: (e: Error) => {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    },
  });
}

export function useDeleteCustomPrintTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_print_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Đã xoá', description: 'Mẫu in đã được xoá' });
    },
    onError: (e: Error) => {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    },
  });
}

export function useDuplicateCustomPrintTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (template: CustomPrintTemplate) => {
      if (!user) throw new Error('Chưa đăng nhập');

      const { id, created_at, updated_at, ...rest } = template;
      const { data, error } = await supabase
        .from('custom_print_templates')
        .insert({
          ...rest as any,
          name: `${template.name} (bản sao)`,
          is_default: false,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CustomPrintTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Đã nhân bản', description: 'Mẫu in đã được nhân bản' });
    },
    onError: (e: Error) => {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    },
  });
}

export function useSetDefaultCustomPrintTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
      // Unset all defaults for tenant
      const { error: resetErr } = await supabase
        .from('custom_print_templates')
        .update({ is_default: false } as any)
        .eq('tenant_id', tenantId);
      if (resetErr) throw resetErr;

      // Set new default
      const { error } = await supabase
        .from('custom_print_templates')
        .update({ is_default: true } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Đã đặt mặc định', description: 'Mẫu in mặc định đã được cập nhật' });
    },
    onError: (e: Error) => {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    },
  });
}
