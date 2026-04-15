import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompanyResolver';

export interface CompanySettings {
  id: string;
  company_id: string;
  display_name: string | null;
  slogan: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  bank_accounts: BankAccount[];
  subscription_plans: any[];
}

export interface BankAccount {
  bank_name: string;
  account_number: string;
  account_holder: string;
}

export function useCompanySettings(companyId?: string | null, enabled = true) {
  const company = useCompany();
  const effectiveId = companyId ?? company.companyId;

  return useQuery({
    queryKey: ['company-settings', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', effectiveId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        bank_accounts: (data.bank_accounts as unknown as BankAccount[]) || [],
        subscription_plans: (data.subscription_plans as unknown as any[]) || [],
      } as CompanySettings;
    },
    enabled: enabled && !!effectiveId,
  });
}

export function useUpsertCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      company_id: string;
      display_name?: string | null;
      slogan?: string | null;
      logo_url?: string | null;
      phone?: string | null;
      email?: string | null;
      website?: string | null;
      address?: string | null;
      description?: string | null;
      bank_accounts?: BankAccount[];
    }) => {
      const { company_id, ...rest } = params;
      
      // Check if record exists
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', company_id)
        .maybeSingle();

      const payload = {
        ...rest,
        bank_accounts: rest.bank_accounts ? JSON.parse(JSON.stringify(rest.bank_accounts)) : undefined,
      };

      if (existing) {
        const { data, error } = await supabase
          .from('company_settings')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('company_id', company_id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert({ ...payload, company_id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['company-settings', vars.company_id] });
    },
  });
}
