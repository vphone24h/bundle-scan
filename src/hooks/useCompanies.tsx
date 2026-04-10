import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Company {
  id: string;
  domain: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  tenant_count?: number;
  attendance_enabled: boolean;
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Get tenant counts per company
      const { data: tenants } = await supabase
        .from('tenants')
        .select('company_id');

      const counts: Record<string, number> = {};
      tenants?.forEach((t: any) => {
        if (t.company_id) {
          counts[t.company_id] = (counts[t.company_id] || 0) + 1;
        }
      });

      return (data || []).map((c: any) => ({
        ...c,
        tenant_count: counts[c.id] || 0,
      })) as Company[];
    },
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ domain, name }: { domain: string; name: string }) => {
      const normalized = domain.toLowerCase().trim().replace(/^www\./, '');
      const { data, error } = await supabase
        .from('companies')
        .insert([{ domain: normalized, name }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, domain, name, status }: { id: string; domain?: string; name?: string; status?: string }) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (domain !== undefined) updates.domain = domain.toLowerCase().trim().replace(/^www\./, '');
      if (name !== undefined) updates.name = name;
      if (status !== undefined) updates.status = status;

      const { error } = await supabase.from('companies').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useToggleAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('companies')
        .update({ attendance_enabled: enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['attendance-enabled'] });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Get default company
      const { data: defaultCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('domain', 'vkho.vn')
        .single();

      if (defaultCompany) {
        // Move tenants to default company
        await supabase
          .from('tenants')
          .update({ company_id: defaultCompany.id })
          .eq('company_id', id);
      }

      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['all-tenants'] });
    },
  });
}

export function useAssignTenantToCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, companyId }: { tenantId: string; companyId: string | null }) => {
      const { error } = await supabase
        .from('tenants')
        .update({ company_id: companyId })
        .eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['all-tenants'] });
    },
  });
}
