import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BlockedDate {
  id: string;
  tenant_id: string;
  product_id: string;
  blocked_date: string;
  check_in_time: string;
  check_out_time: string;
  customer_name: string | null;
  customer_phone: string | null;
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

// Public: get blocked dates with time info for a product (for customer booking)
export function usePublicBlockedDates(tenantId: string | null, productId: string | null) {
  return useQuery({
    queryKey: ['public-blocked-dates', tenantId, productId],
    queryFn: async () => {
      if (!tenantId || !productId) return [];
      const { data, error } = await supabase
        .from('landing_product_blocked_dates' as any)
        .select('blocked_date, check_in_time, check_out_time, customer_name')
        .eq('tenant_id', tenantId)
        .eq('product_id', productId)
        .gte('blocked_date', new Date().toISOString().split('T')[0]);
      if (error) throw error;
      return data as unknown as { blocked_date: string; check_in_time: string; check_out_time: string; customer_name: string | null }[];
    },
    enabled: !!tenantId && !!productId,
    staleTime: 1000 * 60 * 2,
  });
}

/** 
 * Check if a new booking time range conflicts with existing bookings on a given date.
 * Includes a 2-hour cleaning buffer after each checkout.
 */
export function checkTimeConflict(
  existingBookings: { blocked_date: string; check_in_time: string; check_out_time: string }[],
  date: string,
  newCheckInTime: string,
  newCheckOutTime: string,
  cleaningBufferHours: number = 2
): { hasConflict: boolean; message: string } {
  const bookingsOnDate = existingBookings.filter(b => b.blocked_date === date);
  if (bookingsOnDate.length === 0) return { hasConflict: false, message: '' };

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const newIn = toMinutes(newCheckInTime);
  const newOut = toMinutes(newCheckOutTime);

  for (const booking of bookingsOnDate) {
    const existIn = toMinutes(booking.check_in_time || '14:00');
    const existOut = toMinutes(booking.check_out_time || '12:00');
    const existOutWithBuffer = existOut + cleaningBufferHours * 60;

    // Conflict: new check-in is before existing checkout + buffer
    // AND new checkout is after existing check-in
    if (newIn < existOutWithBuffer && newOut > existIn) {
      const bufferTime = `${String(Math.floor(existOutWithBuffer / 60)).padStart(2, '0')}:${String(existOutWithBuffer % 60).padStart(2, '0')}`;
      return {
        hasConflict: true,
        message: `Phòng có khách đặt ${booking.check_in_time || '14:00'}-${booking.check_out_time || '12:00'}, cần dọn dẹp 2 tiếng. Có thể đặt từ ${bufferTime} trở đi.`,
      };
    }
  }

  return { hasConflict: false, message: '' };
}

// Admin: toggle a date (add or remove)
export function useToggleBlockedDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, productId, date, note }: { tenantId: string; productId: string; date: string; note?: string }) => {
      const { data: existing } = await supabase
        .from('landing_product_blocked_dates' as any)
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('product_id', productId)
        .eq('blocked_date', date)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('landing_product_blocked_dates' as any)
          .delete()
          .eq('id', (existing as any).id);
        if (error) throw error;
        return { action: 'removed' as const };
      } else {
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

// Admin: bulk add blocked dates with time info
export function useBulkAddBlockedDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, productId, dates, note, checkInTime, checkOutTime, customerName, customerPhone }: {
      tenantId: string; productId: string; dates: string[]; note?: string;
      checkInTime?: string; checkOutTime?: string; customerName?: string; customerPhone?: string;
    }) => {
      const rows = dates.map(d => ({
        tenant_id: tenantId,
        product_id: productId,
        blocked_date: d,
        note,
        check_in_time: checkInTime || '14:00',
        check_out_time: checkOutTime || '12:00',
        customer_name: customerName,
        customer_phone: customerPhone,
      }));
      const { error } = await supabase
        .from('landing_product_blocked_dates' as any)
        .insert(rows);
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
