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

export interface CustomerFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Server-side paginated customers hook.
 * `data` is always Customer[] for backward compatibility.
 */
export function useCustomers(filters?: CustomerFilters) {
  const { user } = useAuth();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const hasServerFilters = !!filters;

  const result = useQuery({
    queryKey: ['customers', user?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('id, name, phone, address, email, note, source, tenant_id, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.search) {
        const s = filters.search.trim();
        if (s) {
          query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%`);
        }
      }

      if (hasServerFilters) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      } else {
        query = query.limit(500);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { items: (data || []) as Customer[], totalCount: count || 0 };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previous) => previous,
  });

  return {
    ...result,
    data: result.data?.items || [],
    totalCount: result.data?.totalCount || 0,
  };
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
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data: existing } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', customer.phone)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        return existing as Customer;
      } else {
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
