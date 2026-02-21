import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  owner_id: string;
  status: 'trial' | 'active' | 'expired' | 'locked';
  trial_start_date: string;
  trial_end_date: string;
  subscription_plan: 'monthly' | 'yearly' | 'lifetime' | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  max_branches: number;
  max_users: number;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  locked_at: string | null;
  locked_reason: string | null;
  einvoice_enabled: boolean;
  business_type: string | null;
  is_data_hidden: boolean;
  has_data_backup: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  plan_type: 'monthly' | 'yearly' | 'lifetime';
  price: number;
  duration_days: number | null;
  max_branches: number;
  max_users: number;
  description: string | null;
  is_active: boolean;
}

export interface PaymentRequest {
  id: string;
  tenant_id: string;
  plan_id: string;
  amount: number;
  payment_method: string;
  payment_code: string;
  payment_proof_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_reason: string | null;
  note: string | null;
  tenants?: Tenant;
  subscription_plans?: SubscriptionPlan;
}

export interface PlatformUser {
  id: string;
  user_id: string;
  tenant_id: string | null;
  platform_role: 'platform_admin' | 'tenant_admin';
  display_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

// Check if current user is platform admin
export function usePlatformUser() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['platform-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('platform_users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as PlatformUser | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// Combined query to get both platform user AND tenant in single request sequence
// This eliminates the waterfall effect
export function useCurrentTenant() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['current-tenant-combined', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Single join query instead of 2 sequential queries
      const { data, error } = await supabase
        .from('platform_users')
        .select('tenant_id, tenants(*)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data?.tenants) return null;
      
      return data.tenants as unknown as Tenant;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previous) => previous,
  });
}

export interface TenantEnrichment {
  tenant_id: string;
  has_landing_enabled: boolean;
  landing_domain: string;
  has_usage: boolean;
}

// Get all tenants (for platform admin)
export function useAllTenants() {
  return useQuery({
    queryKey: ['all-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Tenant[];
    },
  });
}

// Get tenant enrichment data (landing + usage)
export function useTenantEnrichment() {
  return useQuery({
    queryKey: ['tenant-enrichment'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tenant_enrichment');
      if (error) throw error;
      const map = new Map<string, TenantEnrichment>();
      (data || []).forEach((item: any) => map.set(item.tenant_id, item));
      return map;
    },
  });
}

// Get subscription plans (all for admin, active only for users)
export function useSubscriptionPlans(includeInactive = false) {
  return useQuery({
    queryKey: ['subscription-plans', includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('subscription_plans')
        .select('*')
        .order('price');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });
}

// Create subscription plan
export function useCreateSubscriptionPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planData: Omit<SubscriptionPlan, 'id'>) => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .insert(planData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
    },
  });
}

// Delete subscription plan
export function useDeleteSubscriptionPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
    },
  });
}

// Get payment requests (for platform admin - all, for tenant - own)
export function usePaymentRequests(tenantId?: string) {
  return useQuery({
    queryKey: ['payment-requests', tenantId],
    queryFn: async () => {
      let query = supabase
        .from('payment_requests')
        .select(`
          *,
          tenants (*),
          subscription_plans (*)
        `)
        .order('requested_at', { ascending: false });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PaymentRequest[];
    },
  });
}

// Create payment request
export function useCreatePaymentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      tenant_id: string;
      plan_id: string;
      amount: number;
      payment_method: string;
    }) => {
      // Generate unique payment code
      const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const { data: result, error } = await supabase
        .from('payment_requests')
        .insert({
          ...data,
          payment_code: paymentCode,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification email (non-blocking)
      supabase.functions.invoke('notify-payment-request', {
        body: { paymentRequestId: result.id },
      }).catch(err => console.error('Payment notification error:', err));

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
    },
  });
}

// Cancel/Delete pending payment request
export function useCancelPaymentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabase.functions.invoke('cancel-payment', {
        body: { paymentId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
    },
  });
}

// Approve/Reject payment (platform admin)
export function useApprovePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      paymentId: string;
      action: 'approve' | 'reject';
      rejectedReason?: string;
      bonusDays?: number;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('approve-payment', {
        body: data,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant'] });
    },
  });
}

// Manage tenant (lock/unlock/extend)
export function useManageTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      action: 'lock' | 'unlock' | 'extend' | 'set_expired';
      tenantId: string;
      reason?: string;
      days?: number;
      note?: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('manage-tenant', {
        body: data,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant'] });
    },
  });
}

// Update subscription plan (platform admin)
export function useUpdateSubscriptionPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SubscriptionPlan> & { id: string }) => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
    },
  });
}

// Get subscription history
export function useSubscriptionHistory(tenantId?: string) {
  return useQuery({
    queryKey: ['subscription-history', tenantId],
    queryFn: async () => {
      let query = supabase
        .from('subscription_history')
        .select(`
          *,
          tenants:tenant_id (
            name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
}

// Calculate remaining days
export function calculateRemainingDays(tenant: Tenant | null): number {
  if (!tenant) return 0;
  
  const endDate = tenant.subscription_end_date 
    ? new Date(tenant.subscription_end_date)
    : new Date(tenant.trial_end_date);
  
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}