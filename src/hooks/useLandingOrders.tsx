import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LandingOrder {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  product_price: number;
  variant: string | null;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'cancelled';
  call_status: 'none' | 'called' | 'unreachable';
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_reason: string | null;
  order_code: string | null;
  payment_method: 'cod' | 'transfer' | null;
  transfer_content: string | null;
  action_type: string | null;
  action_date: string | null;
  action_time: string | null;
  created_at: string;
  updated_at: string;
}

// Public: place order (no auth needed)
export function usePlaceLandingOrder() {
  return useMutation({
    mutationFn: async (order: {
      tenant_id: string;
      branch_id: string;
      product_id: string;
      product_name: string;
      product_image_url?: string | null;
      product_price: number;
      variant?: string;
      quantity?: number;
      customer_name: string;
      customer_phone: string;
      customer_email?: string;
      customer_address?: string;
      note?: string;
      payment_method?: string;
      transfer_content?: string;
      action_type?: string;
      action_date?: string;
      action_time?: string;
    }) => {
      const { data, error } = await supabase
        .from('landing_orders' as any)
        .insert([order])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as LandingOrder;
    },
  });
}

// Admin: list orders
export function useLandingOrders(branchId?: string | null) {
  return useQuery({
    queryKey: ['landing-orders', branchId],
    queryFn: async () => {
      let query = supabase
        .from('landing_orders' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as LandingOrder[];
    },
  });
}

// Admin: count pending orders
export function usePendingOrderCount() {
  return useQuery({
    queryKey: ['landing-orders-pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('landing_orders' as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000, // poll every 30s
  });
}

// Admin: update order status
export function useUpdateLandingOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LandingOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from('landing_orders' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landing-orders'] });
      qc.invalidateQueries({ queryKey: ['landing-orders-pending-count'] });
    },
  });
}
