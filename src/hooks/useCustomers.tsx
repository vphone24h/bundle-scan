import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  email: string | null;
  note: string | null;
  source: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['customers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, address, email, note, source, tenant_id, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 phút
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useSearchCustomerByPhone() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .ilike('phone', `%${phone}%`)
        .limit(5);

      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: {
      name: string;
      phone: string;
      address?: string | null;
      email?: string | null;
      note?: string | null;
      source?: string | null;
    }) => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...customer, tenant_id: tenantId }])
        .select()
        .single();

      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpsertCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: {
      name: string;
      phone: string;
      address?: string | null;
      email?: string | null;
      birthday?: string | null;
      source?: string | null;
    }) => {
      // Get tenant_id first to ensure we're looking within the right tenant
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // First try to find existing customer by phone within the same tenant
      const { data: existing } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', customer.phone)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        // Return existing customer as-is (keep original name, just use for order)
        // No update needed - the customer already exists
        return existing as Customer;
      } else {
        // Create new customer only if not found
        const { data, error } = await supabase
          .from('customers')
          .insert([{ ...customer, tenant_id: tenantId }])
          .select()
          .single();

        if (error) throw error;
        return data as Customer;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
