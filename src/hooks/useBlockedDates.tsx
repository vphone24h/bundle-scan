import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BlockedDate {
  id: string;
  tenant_id: string;
  product_id: string;
  blocked_date: string;
  status: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

// Admin: get blocked dates for a product
export function useBlockedDates(productId: string | null) {
  return useQuery({
    queryKey: ['blocked-dates', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('landing_product_blocked_dates' as any)
        .select('*')
        .eq('product_id', productId)
        .order('blocked_date', { ascending: true });
      if (error) throw error;
      return data as unknown as BlockedDate[];
    },
    enabled: !!productId,
  });
}

// Public: get blocked dates for a product (for customer booking)
export function usePublicBlockedDates(tenantId: string | null, productId: string | null) {
  return useQuery({
    queryKey: ['public-blocked-dates', tenantId, productId],
    queryFn: async () => {
      if (!tenantId || !productId) return [];
      const { data, error } = await supabase
        .from('landing_product_blocked_dates' as any)
        .select('blocked_date')
        .eq('tenant_id', tenantId)
        .eq('product_id', productId)
        .gte('blocked_date', new Date().toISOString().split('T')[0]);
      if (error) throw error;
      return (data as unknown as { blocked_date: string }[]).map(d => d.blocked_date);
    },
    enabled: !!tenantId && !!productId,
    staleTime: 1000 * 60 * 2,
  });
}

// Admin: toggle a date (add or remove)
export function useToggleBlockedDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, productId, date, note }: { tenantId: string; productId: string; date: string; note?: string }) => {
      // Check if exists
      const { data: existing } = await supabase
        .from('landing_product_blocked_dates' as any)
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('product_id', productId)
        .eq('blocked_date', date)
        .maybeSingle();

      if (existing) {
        // Remove
        const { error } = await supabase
          .from('landing_product_blocked_dates' as any)
          .delete()
          .eq('id', (existing as any).id);
        if (error) throw error;
        return { action: 'removed' as const };
      } else {
        // Add
        const { error } = await supabase
          .from('landing_product_blocked_dates' as any)
          .insert([{ tenant_id: tenantId, product_id: productId, blocked_date: date, note }]);
        if (error) throw error;
        return { action: 'added' as const };
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['blocked-dates', vars.productId] });
      qc.invalidateQueries({ queryKey: ['public-blocked-dates'] });
    },
  });
}

// Admin: bulk add blocked dates
export function useBulkAddBlockedDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, productId, dates, note }: { tenantId: string; productId: string; dates: string[]; note?: string }) => {
      const rows = dates.map(d => ({ tenant_id: tenantId, product_id: productId, blocked_date: d, note }));
      const { error } = await supabase
        .from('landing_product_blocked_dates' as any)
        .upsert(rows, { onConflict: 'tenant_id,product_id,blocked_date' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['blocked-dates', vars.productId] });
      qc.invalidateQueries({ queryKey: ['public-blocked-dates'] });
    },
  });
}

// Admin: clear all blocked dates for a product
export function useClearBlockedDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, productId }: { tenantId: string; productId: string }) => {
      const { error } = await supabase
        .from('landing_product_blocked_dates' as any)
        .delete()
        .eq('tenant_id', tenantId)
        .eq('product_id', productId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['blocked-dates', vars.productId] });
      qc.invalidateQueries({ queryKey: ['public-blocked-dates'] });
    },
  });
}
