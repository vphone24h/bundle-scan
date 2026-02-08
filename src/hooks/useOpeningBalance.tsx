import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';

export interface OpeningBalance {
  id: string;
  tenant_id: string;
  payment_source: string;
  amount: number;
  period_type: string;
  period_start: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export function useOpeningBalances() {
  const { data: tenant } = useCurrentTenant();

  return useQuery({
    queryKey: ['opening-balances', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_book_opening_balances')
        .select('*')
        .order('period_start', { ascending: false });

      if (error) throw error;
      return data as OpeningBalance[];
    },
    enabled: !!tenant?.id,
  });
}

// Lấy opening balance mới nhất cho mỗi nguồn tiền (dùng cho tính tổng số dư)
export function useLatestOpeningBalances() {
  const { data: tenant } = useCurrentTenant();

  return useQuery({
    queryKey: ['opening-balances-latest', tenant?.id],
    queryFn: async () => {
      // Lấy tất cả rồi group theo payment_source, chọn cái có period_start mới nhất
      const { data, error } = await supabase
        .from('cash_book_opening_balances')
        .select('*')
        .order('period_start', { ascending: false });

      if (error) throw error;

      // Group by payment_source, lấy record mới nhất
      const latestMap: Record<string, OpeningBalance> = {};
      (data as OpeningBalance[]).forEach((ob) => {
        if (!latestMap[ob.payment_source]) {
          latestMap[ob.payment_source] = ob;
        }
      });

      return latestMap;
    },
    enabled: !!tenant?.id,
  });
}

export function useCreateOpeningBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      payment_source: string;
      amount: number;
      period_type: string;
      period_start: string;
      note?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('cash_book_opening_balances')
        .upsert({
          tenant_id: tenantId,
          payment_source: input.payment_source,
          amount: input.amount,
          period_type: input.period_type,
          period_start: input.period_start,
          note: input.note || null,
          created_by: user?.id,
        }, {
          onConflict: 'tenant_id,payment_source,period_start',
        })
        .select()
        .single();

      if (error) throw error;
      return data as OpeningBalance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opening-balances'] });
      queryClient.invalidateQueries({ queryKey: ['opening-balances-latest'] });
    },
  });
}

export function useUpdateOpeningBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, amount, note }: { id: string; amount: number; note?: string }) => {
      const { data, error } = await supabase
        .from('cash_book_opening_balances')
        .update({ amount, note: note || null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as OpeningBalance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opening-balances'] });
      queryClient.invalidateQueries({ queryKey: ['opening-balances-latest'] });
    },
  });
}

export function useDeleteOpeningBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cash_book_opening_balances')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opening-balances'] });
      queryClient.invalidateQueries({ queryKey: ['opening-balances-latest'] });
    },
  });
}
