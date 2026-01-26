import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Customer[];
    },
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
    }) => {
      // First try to find existing customer by phone
      const { data: existing } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', customer.phone)
        .maybeSingle();

      if (existing) {
        // Update existing customer
        const { data, error } = await supabase
          .from('customers')
          .update({
            name: customer.name,
            address: customer.address,
            email: customer.email,
            birthday: customer.birthday,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data as Customer;
      } else {
        // Create new customer
        const tenantId = await getCurrentTenantId();
        if (!tenantId) throw new Error('Không tìm thấy tenant');

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
