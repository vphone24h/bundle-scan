import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

// Types
export interface AffiliateSettings {
  id: string;
  is_enabled: boolean;
  min_subscription_months: number;
  require_approval: boolean;
  check_same_email: boolean;
  check_same_phone: boolean;
  check_same_ip: boolean;
  hold_days: number;
  min_withdrawal_amount: number;
  created_at: string;
  updated_at: string;
}

export interface AffiliateCommissionRate {
  id: string;
  plan_id: string;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  created_at: string;
  updated_at: string;
  subscription_plans?: {
    name: string;
    price: number;
  };
}

export interface Affiliate {
  id: string;
  tenant_id: string;
  user_id: string;
  affiliate_code: string;
  status: 'pending' | 'active' | 'blocked';
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  total_clicks: number;
  total_referrals: number;
  total_conversions: number;
  total_commission_earned: number;
  total_commission_paid: number;
  available_balance: number;
  pending_balance: number;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
  blocked_at: string | null;
  blocked_reason: string | null;
  tenants?: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface AffiliateReferral {
  id: string;
  affiliate_id: string;
  referred_tenant_id: string;
  referred_user_id: string;
  referred_email: string | null;
  referred_phone: string | null;
  ip_address: string | null;
  status: string;
  registered_at: string;
  converted_at: string | null;
  tenants?: {
    name: string;
    email: string;
  };
}

export interface AffiliateCommission {
  id: string;
  affiliate_id: string;
  referral_id: string;
  payment_request_id: string | null;
  plan_id: string | null;
  order_amount: number;
  commission_type: 'percentage' | 'fixed';
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  hold_until: string | null;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  affiliate_referrals?: AffiliateReferral;
  subscription_plans?: {
    name: string;
  };
}

export interface AffiliateWithdrawal {
  id: string;
  affiliate_id: string;
  amount: number;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  note: string | null;
  processed_at: string | null;
  processed_by: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
  affiliates?: Affiliate;
}

// Hooks
export function useAffiliateSettings() {
  return useQuery({
    queryKey: ['affiliate-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data as AffiliateSettings;
    },
  });
}

export function useUpdateAffiliateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<AffiliateSettings>) => {
      const { data: existing } = await supabase
        .from('affiliate_settings')
        .select('id')
        .single();

      if (existing) {
        const { data, error } = await supabase
          .from('affiliate_settings')
          .update(settings)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      throw new Error('No settings found');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-settings'] });
      toast({ title: 'Đã cập nhật cấu hình affiliate' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

export function useAffiliateCommissionRates() {
  return useQuery({
    queryKey: ['affiliate-commission-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_commission_rates')
        .select('*, subscription_plans(name, price)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as AffiliateCommissionRate[];
    },
  });
}

export function useUpsertCommissionRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rate: {
      plan_id: string;
      commission_type: 'percentage' | 'fixed';
      commission_value: number;
    }) => {
      const { data, error } = await supabase
        .from('affiliate_commission_rates')
        .upsert(rate, { onConflict: 'plan_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-commission-rates'] });
      toast({ title: 'Đã cập nhật mức hoa hồng' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteCommissionRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('affiliate_commission_rates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-commission-rates'] });
      toast({ title: 'Đã xóa mức hoa hồng' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

// Danh sách affiliates (admin)
export function useAffiliates() {
  return useQuery({
    queryKey: ['affiliates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*, tenants(name, email, phone)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Affiliate[];
    },
  });
}

export function useUpdateAffiliateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      blocked_reason 
    }: { 
      id: string; 
      status: 'pending' | 'active' | 'blocked';
      blocked_reason?: string;
    }) => {
      const updateData: any = { status };
      if (status === 'blocked') {
        updateData.blocked_at = new Date().toISOString();
        updateData.blocked_reason = blocked_reason || null;
      } else {
        updateData.blocked_at = null;
        updateData.blocked_reason = null;
      }

      const { data, error } = await supabase
        .from('affiliates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast({ title: 'Đã cập nhật trạng thái affiliate' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

// Hoa hồng (admin)
export function useAffiliateCommissions() {
  return useQuery({
    queryKey: ['affiliate-commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_commissions')
        .select(`
          *,
          affiliates(affiliate_code, tenants(name)),
          affiliate_referrals(referred_email, tenants(name)),
          subscription_plans(name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUpdateCommissionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      cancel_reason 
    }: { 
      id: string; 
      status: 'pending' | 'approved' | 'paid' | 'cancelled';
      cancel_reason?: string;
    }) => {
      const updateData: any = { status };
      
      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
      } else if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancel_reason = cancel_reason || null;
      }

      const { data, error } = await supabase
        .from('affiliate_commissions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-commissions'] });
      toast({ title: 'Đã cập nhật trạng thái hoa hồng' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

// Yêu cầu rút tiền (admin)
export function useAffiliateWithdrawals() {
  return useQuery({
    queryKey: ['affiliate-withdrawals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_withdrawals')
        .select('*, affiliates(affiliate_code, tenants(name))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useProcessWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      rejected_reason 
    }: { 
      id: string; 
      status: 'approved' | 'paid' | 'rejected';
      rejected_reason?: string;
    }) => {
      const updateData: any = { 
        status,
        processed_at: new Date().toISOString(),
      };
      
      if (status === 'rejected') {
        updateData.rejected_reason = rejected_reason || null;
      }

      const { data, error } = await supabase
        .from('affiliate_withdrawals')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-withdrawals'] });
      toast({ title: 'Đã xử lý yêu cầu rút tiền' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

// User hooks
export function useMyAffiliate() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-affiliate', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Affiliate | null;
    },
    enabled: !!user?.id,
  });
}

export function useCreateAffiliate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenant_id }: { tenant_id: string }) => {
      // Generate unique code
      const code = Array.from({ length: 8 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
      ).join('');

      const { data, error } = await supabase
        .from('affiliates')
        .insert({
          tenant_id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          affiliate_code: code,
          status: 'active', // Will be 'pending' if require_approval is true
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-affiliate'] });
      toast({ title: 'Đăng ký affiliate thành công!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

export function useMyReferrals() {
  const { data: affiliate } = useMyAffiliate();
  return useQuery({
    queryKey: ['my-referrals', affiliate?.id],
    queryFn: async () => {
      if (!affiliate?.id) return [];
      const { data, error } = await supabase
        .from('affiliate_referrals')
        .select('*, tenants(name, email)')
        .eq('affiliate_id', affiliate.id)
        .order('registered_at', { ascending: false });
      if (error) throw error;
      return data as AffiliateReferral[];
    },
    enabled: !!affiliate?.id,
  });
}

export function useMyCommissions() {
  const { data: affiliate } = useMyAffiliate();
  return useQuery({
    queryKey: ['my-commissions', affiliate?.id],
    queryFn: async () => {
      if (!affiliate?.id) return [];
      const { data, error } = await supabase
        .from('affiliate_commissions')
        .select('*, affiliate_referrals(referred_email, tenants(name)), subscription_plans(name)')
        .eq('affiliate_id', affiliate.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AffiliateCommission[];
    },
    enabled: !!affiliate?.id,
  });
}

export function useMyWithdrawals() {
  const { data: affiliate } = useMyAffiliate();
  return useQuery({
    queryKey: ['my-withdrawals', affiliate?.id],
    queryFn: async () => {
      if (!affiliate?.id) return [];
      const { data, error } = await supabase
        .from('affiliate_withdrawals')
        .select('*')
        .eq('affiliate_id', affiliate.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AffiliateWithdrawal[];
    },
    enabled: !!affiliate?.id,
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  const { data: affiliate } = useMyAffiliate();
  
  return useMutation({
    mutationFn: async (withdrawal: {
      amount: number;
      bank_name: string;
      bank_account_number: string;
      bank_account_holder: string;
      note?: string;
    }) => {
      if (!affiliate?.id) throw new Error('Không tìm thấy thông tin affiliate');
      
      const { data, error } = await supabase
        .from('affiliate_withdrawals')
        .insert({
          affiliate_id: affiliate.id,
          ...withdrawal,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['my-affiliate'] });
      toast({ title: 'Đã gửi yêu cầu rút tiền' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateAffiliateBank() {
  const queryClient = useQueryClient();
  const { data: affiliate } = useMyAffiliate();
  
  return useMutation({
    mutationFn: async (bankInfo: {
      bank_name: string;
      bank_account_number: string;
      bank_account_holder: string;
    }) => {
      if (!affiliate?.id) throw new Error('Không tìm thấy thông tin affiliate');
      
      const { data, error } = await supabase
        .from('affiliates')
        .update(bankInfo)
        .eq('id', affiliate.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-affiliate'] });
      toast({ title: 'Đã cập nhật thông tin ngân hàng' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}
