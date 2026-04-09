import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformUser } from './useTenant';
import { toast } from 'sonner';

// ============ Salary Templates ============
export function useSalaryTemplates() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['salary-templates', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_templates')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useCreateSalaryTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: { tenant_id: string; name: string; salary_type: string; base_amount: number; description?: string }) => {
      const { data, error } = await supabase.from('salary_templates').insert([template]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-templates'] }); toast.success('Tạo mẫu lương thành công'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSalaryTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; salary_type?: string; base_amount?: number; description?: string; is_active?: boolean }) => {
      const { data, error } = await supabase.from('salary_templates').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-templates'] }); toast.success('Cập nhật mẫu lương thành công'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Employee Salary Configs ============
export function useEmployeeSalaryConfigs() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['employee-salary-configs', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_salary_configs')
        .select('*, salary_templates(name, salary_type, base_amount)')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

// ============ Commission Rules ============
export function useCommissionRules() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['commission-rules', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .order('priority', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useCreateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: { tenant_id: string; name: string; rule_type: string; target_id?: string; target_name?: string; commission_type: string; commission_value: number; priority?: number }) => {
      const { data, error } = await supabase.from('commission_rules').insert([rule]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-rules'] }); toast.success('Tạo quy tắc hoa hồng thành công'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Payroll Periods ============
export function usePayrollPeriods() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['payroll-periods', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useCreatePayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (period: { tenant_id: string; name: string; period_type: string; start_date: string; end_date: string }) => {
      const { data, error } = await supabase.from('payroll_periods').insert([period]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-periods'] }); toast.success('Tạo kỳ lương thành công'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Payroll Records ============
export function usePayrollRecords(periodId?: string) {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['payroll-records', tenantId, periodId],
    queryFn: async () => {
      let q = supabase.from('payroll_records').select('*').eq('tenant_id', tenantId!);
      if (periodId) q = q.eq('payroll_period_id', periodId);
      q = q.order('user_name');
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}
