import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformUser, useCurrentTenant } from './useTenant';
import { toast } from 'sonner';

function useTenantId() {
  const { data: pu } = usePlatformUser();
  const { data: ct } = useCurrentTenant();
  return ct?.id || pu?.tenant_id;
}

// ============ Salary Templates ============
export function useSalaryTemplates() {
  const tenantId = useTenantId();
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
    mutationFn: async (template: any) => {
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
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase.from('salary_templates').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-templates'] }); toast.success('Cập nhật mẫu lương thành công'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Duplicate Salary Template ============
export function useDuplicateSalaryTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      // 1. Fetch source template
      const { data: src, error: srcErr } = await supabase
        .from('salary_templates').select('*').eq('id', templateId).single();
      if (srcErr) throw srcErr;

      const { id, created_at, updated_at, name, ...rest } = src as any;
      const newName = `${name} (Copy)`;

      // 2. Insert new template
      const { data: created, error: insErr } = await supabase
        .from('salary_templates')
        .insert([{ ...rest, name: newName, is_active: true }])
        .select().single();
      if (insErr) throw insErr;
      const newId = (created as any).id;
      const tenantId = (created as any).tenant_id;

      // 3. Clone sub-configs
      const subTables = [
        'salary_template_bonuses',
        'salary_template_commissions',
        'salary_template_allowances',
        'salary_template_holidays',
        'salary_template_penalties',
        'salary_template_overtimes',
      ] as const;

      for (const tbl of subTables) {
        const { data: rows, error: e1 } = await supabase
          .from(tbl).select('*').eq('template_id', templateId);
        if (e1) throw e1;
        if (!rows || rows.length === 0) continue;
        const cloned = rows.map((r: any) => {
          const { id: _id, created_at: _c, updated_at: _u, ...rr } = r;
          return { ...rr, template_id: newId, tenant_id: tenantId };
        });
        const { error: e2 } = await supabase.from(tbl).insert(cloned);
        if (e2) throw e2;
      }

      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-templates'] });
      toast.success('Đã nhân bản mẫu lương');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Template Sub-configs ============
export function useTemplateBonuses(templateId?: string) {
  return useQuery({
    queryKey: ['template-bonuses', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_template_bonuses')
        .select('*')
        .eq('template_id', templateId!)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });
}

export function useTemplateCommissions(templateId?: string) {
  return useQuery({
    queryKey: ['template-commissions', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_template_commissions')
        .select('*')
        .eq('template_id', templateId!)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });
}

export function useTemplateAllowances(templateId?: string) {
  return useQuery({
    queryKey: ['template-allowances', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_template_allowances')
        .select('*')
        .eq('template_id', templateId!)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });
}

export function useTemplateHolidays(templateId?: string) {
  return useQuery({
    queryKey: ['template-holidays', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_template_holidays')
        .select('*')
        .eq('template_id', templateId!)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });
}

export function useTemplatePenalties(templateId?: string) {
  return useQuery({
    queryKey: ['template-penalties', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_template_penalties')
        .select('*')
        .eq('template_id', templateId!)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });
}

export function useTemplateOvertimes(templateId?: string) {
  return useQuery({
    queryKey: ['template-overtimes', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_template_overtimes')
        .select('*')
        .eq('template_id', templateId!)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });
}

// ============ Save all sub-configs ============
export function useSaveTemplateConfigs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, tenantId, bonuses, commissions, allowances, holidays, penalties, overtimes }: {
      templateId: string; tenantId: string;
      bonuses: any[]; commissions: any[]; allowances: any[]; holidays: any[]; penalties: any[]; overtimes?: any[];
    }) => {
      // Delete existing and re-insert
      await Promise.all([
        supabase.from('salary_template_bonuses').delete().eq('template_id', templateId),
        supabase.from('salary_template_commissions').delete().eq('template_id', templateId),
        supabase.from('salary_template_allowances').delete().eq('template_id', templateId),
        supabase.from('salary_template_holidays').delete().eq('template_id', templateId),
        supabase.from('salary_template_penalties').delete().eq('template_id', templateId),
        supabase.from('salary_template_overtimes').delete().eq('template_id', templateId),
      ]);

      const inserts = [];
      if (bonuses.length) inserts.push(supabase.from('salary_template_bonuses').insert(bonuses.map((b, i) => ({ ...b, template_id: templateId, tenant_id: tenantId, display_order: i }))));
      if (commissions.length) inserts.push(supabase.from('salary_template_commissions').insert(commissions.map((c, i) => ({ ...c, target_id: c.target_id || null, template_id: templateId, tenant_id: tenantId, display_order: i }))));
      if (allowances.length) inserts.push(supabase.from('salary_template_allowances').insert(allowances.map((a, i) => ({ ...a, template_id: templateId, tenant_id: tenantId, display_order: i }))));
      if (holidays.length) inserts.push(supabase.from('salary_template_holidays').insert(holidays.map((h, i) => ({ ...h, template_id: templateId, tenant_id: tenantId, display_order: i }))));
      if (penalties.length) inserts.push(supabase.from('salary_template_penalties').insert(penalties.map((p, i) => ({ ...p, template_id: templateId, tenant_id: tenantId, display_order: i }))));
      if (overtimes?.length) inserts.push(supabase.from('salary_template_overtimes').insert(overtimes.map((o, i) => ({ ...o, template_id: templateId, tenant_id: tenantId, display_order: i }))));

      const results = await Promise.all(inserts);
      for (const r of results) if (r.error) throw r.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-bonuses'] });
      qc.invalidateQueries({ queryKey: ['template-commissions'] });
      qc.invalidateQueries({ queryKey: ['template-allowances'] });
      qc.invalidateQueries({ queryKey: ['template-holidays'] });
      qc.invalidateQueries({ queryKey: ['template-penalties'] });
      qc.invalidateQueries({ queryKey: ['template-overtimes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Commission Rules (legacy) ============
export function useCommissionRules() {
  const tenantId = useTenantId();
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
    mutationFn: async (rule: any) => {
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
  const tenantId = useTenantId();
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
    mutationFn: async (period: any) => {
      const { data, error } = await supabase.from('payroll_periods').insert([period]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-periods'] }); toast.success('Tạo kỳ lương thành công'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Calculate Payroll ============
export function useCalculatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ period_id, tenant_id }: { period_id: string; tenant_id: string }) => {
      const { data, error } = await supabase.functions.invoke('calculate-payroll', {
        body: { period_id, tenant_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payroll-records'] });
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      toast.success(`Đã tính lương cho ${data.count} nhân viên`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Payroll Records ============
export function usePayrollRecords(periodId?: string) {
  const tenantId = useTenantId();
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

// ============ Lock/Finalize Payroll Period ============
export function useLockPayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ periodId, status }: { periodId: string; status: string }) => {
      const { error } = await supabase
        .from('payroll_periods')
        .update({ status })
        .eq('id', periodId);
      if (error) throw error;
      // Lock all records
      if (status === 'paid') {
        const { error: lockErr } = await supabase
          .from('payroll_records')
          .update({ status: 'paid' })
          .eq('payroll_period_id', periodId);
        if (lockErr) throw lockErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      qc.invalidateQueries({ queryKey: ['payroll-records'] });
      toast.success('Cập nhật trạng thái kỳ lương thành công');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Employee Salary Configs ============
export function useEmployeeSalaryConfigs() {
  const tenantId = useTenantId();
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
