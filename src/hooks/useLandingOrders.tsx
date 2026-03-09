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
  delivery_status: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
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
  order_source: 'web' | 'ctv_direct' | 'ctv_referral';
  ctv_code: string | null;
  ctv_id: string | null;
  ctv_name: string | null;
  created_at: string;
  updated_at: string;
}

// Helper: get CTV ref from localStorage
function getCTVRef(tenantId: string): { code: string; ts: number } | null {
  try {
    const raw = localStorage.getItem(`ctv_ref_${tenantId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after 30 days
    if (Date.now() - parsed.ts > 30 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

// Fire-and-forget: Send alert to shop owner
function sendLandingOrderAlert(order: LandingOrder) {
  supabase.functions.invoke('send-landing-order-alert', {
    body: {
      tenant_id: order.tenant_id,
      order_id: order.id,
      order_code: order.order_code,
      action_type: order.action_type,
      product_name: order.product_name,
      product_price: order.product_price,
      variant: order.variant,
      quantity: order.quantity,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
      customer_address: order.customer_address,
      branch_id: order.branch_id,
      note: order.note,
      ctv_name: order.ctv_name,
    },
  }).then(({ error }) => {
    if (error) console.warn('Landing order alert failed:', error.message);
  }).catch((err) => {
    console.warn('Landing order alert failed:', err);
  });
}

// Fire-and-forget: Send confirmation email to customer
async function sendCustomerConfirmation(order: LandingOrder) {
  if (!order.customer_email) return;

  try {
    // Get shop info for the email
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', order.tenant_id)
      .maybeSingle();

    // Get branch info
    let branchName = '';
    if (order.branch_id) {
      const { data: branch } = await supabase
        .from('branches')
        .select('name, phone')
        .eq('id', order.branch_id)
        .maybeSingle();
      if (branch) branchName = branch.name || '';
    }

    supabase.functions.invoke('send-customer-order-confirmation', {
      body: {
        customer_email: order.customer_email,
        customer_name: order.customer_name,
        customer_address: order.customer_address,
        order_code: order.order_code,
        action_type: order.action_type,
        product_name: order.product_name,
        product_price: order.product_price,
        variant: order.variant,
        quantity: order.quantity,
        branch_name: branchName,
        note: order.note,
        shop_name: tenant?.name || 'Cửa hàng',
        action_date: order.action_date,
        action_time: order.action_time,
      },
    }).then(({ error }) => {
      if (error) console.warn('Customer confirmation failed:', error.message);
    }).catch((err) => {
      console.warn('Customer confirmation failed:', err);
    });
  } catch (err) {
    console.warn('Customer confirmation failed:', err);
  }
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
      order_source?: string;
      ctv_code?: string;
      ctv_id?: string;
      ctv_name?: string;
    }) => {
      // Auto-detect CTV source if not explicitly set
      let finalOrder = { ...order };
      if (!finalOrder.order_source) {
        const ref = getCTVRef(order.tenant_id);
        if (ref) {
          finalOrder.order_source = 'ctv_referral';
          finalOrder.ctv_code = ref.code;
        } else {
          finalOrder.order_source = 'web';
        }
      }

      const { data, error } = await supabase
        .from('landing_orders' as any)
        .insert([finalOrder])
        .select()
        .maybeSingle();
      if (error) throw error;
      
      const result = (data || finalOrder) as unknown as LandingOrder;
      
      // Fire-and-forget: Send email alert to shop owner
      sendLandingOrderAlert(result);
      
      // Fire-and-forget: Send confirmation email to customer
      sendCustomerConfirmation(result);
      
      return result;
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
