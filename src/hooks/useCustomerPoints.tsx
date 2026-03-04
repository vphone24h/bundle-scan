import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
// fetchAllRows removed - using server-side limited queries

// Types
export interface PointSettings {
  id: string;
  is_enabled: boolean;
  spend_amount: number;
  earn_points: number;
  redeem_points: number;
  redeem_value: number;
  use_max_amount_limit: boolean;
  max_redeem_amount: number | null;
  use_percentage_limit: boolean;
  max_redeem_percentage: number;
  points_expire: boolean;
  points_expire_days: number | null;
  require_full_payment: boolean;
  updated_at: string;
}

export interface MembershipTierSettings {
  id: string;
  tier: 'regular' | 'silver' | 'gold' | 'vip';
  min_spent: number;
  points_multiplier: number;
  description: string | null;
  benefits: string | null;
}

export interface PointTransaction {
  id: string;
  customer_id: string;
  transaction_type: 'earn' | 'redeem' | 'refund' | 'adjust' | 'expire';
  points: number;
  balance_after: number;
  status: 'active' | 'pending' | 'expired';
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  note: string | null;
  created_by: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface CustomerWithPoints {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  note: string | null;
  source: string | null;
  total_spent: number;
  current_points: number;
  pending_points: number;
  total_points_earned: number;
  total_points_used: number;
  membership_tier: 'regular' | 'silver' | 'gold' | 'vip';
  status: 'active' | 'inactive';
  birthday: string | null;
  last_purchase_date: string | null;
  preferred_branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithPointsCRM extends CustomerWithPoints {
  crm_status: 'new' | 'caring' | 'purchased' | 'inactive';
  assigned_staff_id: string | null;
  last_care_date: string | null;
}

// Hook: Lấy cài đặt tích điểm
export function usePointSettings() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['point-settings', user?.id],
    queryFn: async () => {
      // Get user's tenant_id first
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      
      if (!tenantId) {
        // Fallback to global settings
        const { data, error } = await supabase
          .from('point_settings')
          .select('*')
          .is('tenant_id', null)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data as PointSettings | null;
      }
      
      // Try to get tenant-specific settings first
      const { data: tenantSettings, error: tenantError } = await supabase
        .from('point_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();

      if (tenantError) throw tenantError;
      
      if (tenantSettings) {
        return tenantSettings as PointSettings;
      }
      
      // Fallback to global settings if no tenant-specific settings
      const { data: globalSettings, error: globalError } = await supabase
        .from('point_settings')
        .select('*')
        .is('tenant_id', null)
        .limit(1)
        .maybeSingle();
        
      if (globalError) throw globalError;
      return globalSettings as PointSettings | null;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 min cache for point settings
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always', // Always refetch on mount
  });
}

// Hook: Cập nhật cài đặt tích điểm
export function useUpdatePointSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (settings: Partial<PointSettings>) => {
      console.log('[useUpdatePointSettings] Starting update with settings:', settings);
      
      // Get tenant_id
      const { data: tenantId, error: tenantError } = await supabase.rpc('get_user_tenant_id_secure');
      
      console.log('[useUpdatePointSettings] tenantId:', tenantId, 'error:', tenantError);

      if (!tenantId) {
        throw new Error('Không xác định được cửa hàng');
      }

      // Get existing settings for THIS tenant specifically
      const { data: existing, error: existingError } = await supabase
        .from('point_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();

      console.log('[useUpdatePointSettings] existing:', existing, 'error:', existingError);

      if (existing) {
        // Update existing tenant settings
        const updatePayload = {
          ...settings,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        };
        console.log('[useUpdatePointSettings] Updating with payload:', updatePayload);
        
        const { data: updateResult, error } = await supabase
          .from('point_settings')
          .update(updatePayload)
          .eq('id', existing.id)
          .select();

        console.log('[useUpdatePointSettings] Update result:', updateResult, 'error:', error);
        
        if (error) throw error;
        return { ...settings, id: existing.id };
      } else {
        // Insert new with tenant_id
        const insertPayload = {
          ...settings,
          tenant_id: tenantId,
          updated_by: user?.id,
        };
        console.log('[useUpdatePointSettings] Inserting with payload:', insertPayload);
        
        const { data, error } = await supabase
          .from('point_settings')
          .insert([insertPayload])
          .select()
          .single();

        console.log('[useUpdatePointSettings] Insert result:', data, 'error:', error);
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (result) => {
      console.log('[useUpdatePointSettings] Success! Result:', result);
      // Invalidate with exact: false to match all queries starting with 'point-settings'
      queryClient.invalidateQueries({ 
        queryKey: ['point-settings'],
        exact: false,
        refetchType: 'all'
      });
    },
    onError: (error) => {
      console.error('[useUpdatePointSettings] Error:', error);
    },
  });
}

// Hook: Lấy cài đặt hạng thành viên
export function useMembershipTiers() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['membership-tiers', user?.id],
    queryFn: async () => {
      // Fetch all tiers - RLS sẽ filter theo tenant, nếu không có RLS thì fetch cả global
      const { data, error } = await supabase
        .from('membership_tier_settings')
        .select('*')
        .order('min_spent', { ascending: true });

      if (error) throw error;

      const rows = (data || []) as (MembershipTierSettings & { tenant_id: string | null })[];
      
      // Ưu tiên tier có tenant_id (của tenant hiện tại do RLS), nếu không có thì dùng global
      const tenantRows = rows.filter((r) => r.tenant_id !== null);
      if (tenantRows.length > 0) return tenantRows;

      return rows.filter((r) => r.tenant_id == null) as MembershipTierSettings[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 phút - tier setting ít thay đổi
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// Hook: Cập nhật hạng thành viên
export function useUpdateMembershipTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tier: MembershipTierSettings) => {
      const { error } = await supabase
        .from('membership_tier_settings')
        .update({
          min_spent: tier.min_spent,
          points_multiplier: tier.points_multiplier,
          description: tier.description,
          benefits: tier.benefits,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tier.id);

      if (error) throw error;
      return tier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-tiers'] });
    },
  });
}

// Hook: Lấy danh sách khách hàng với thông tin điểm (server-side pagination, N+1 pattern)
export function useCustomersWithPoints(filters?: {
  search?: string;
  branchId?: string;
  tier?: string;
  hasPoints?: boolean;
  hasDebt?: boolean;
  status?: string;
  crmStatus?: string;
  staffId?: string;
  page?: number;
  pageSize?: number;
}) {
  const { user } = useAuth();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;

  const result = useQuery({
    queryKey: ['customers-with-points', user?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('id, name, phone, email, address, note, source, total_spent, current_points, pending_points, total_points_earned, total_points_used, membership_tier, status, birthday, last_purchase_date, preferred_branch_id, created_at, updated_at, crm_status, assigned_staff_id, last_care_date')
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }
      if (filters?.branchId && filters.branchId !== '_all_') {
        query = query.eq('preferred_branch_id', filters.branchId);
      }
      if (filters?.tier && filters.tier !== '_all_') {
        query = query.eq('membership_tier', filters.tier as 'regular' | 'silver' | 'gold' | 'vip');
      }
      if (filters?.hasPoints === true) {
        query = query.gt('current_points', 0);
      }
      if (filters?.status && filters.status !== '_all_') {
        query = query.eq('status', filters.status as 'active' | 'inactive');
      }
      if (filters?.crmStatus && filters.crmStatus !== '_all_') {
        query = query.eq('crm_status', filters.crmStatus);
      }
      if (filters?.staffId && filters.staffId !== '_all_') {
        query = query.eq('assigned_staff_id', filters.staffId);
      }

      // N+1 pattern: fetch one extra to determine hasMore
      const from = (page - 1) * pageSize;
      const to = from + pageSize; // fetch pageSize + 1
      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;
      
      const items = (data || []) as CustomerWithPointsCRM[];
      const hasMore = items.length > pageSize;
      const pageItems = hasMore ? items.slice(0, pageSize) : items;
      
      return { items: pageItems, hasMore };
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
    hasMore: result.data?.hasMore ?? false,
  };
}

// Hook: Lấy chi tiết khách hàng
export function useCustomerDetail(customerId: string | null) {
  return useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: async () => {
      if (!customerId) return null;

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      return data as CustomerWithPointsCRM;
    },
    enabled: !!customerId,
  });
}

// Hook: Cập nhật thông tin khách hàng
export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CustomerWithPoints> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('customers')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// Hook: Lấy lịch sử điểm của khách hàng
export function usePointTransactions(customerId: string | null) {
  return useQuery({
    queryKey: ['point-transactions', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PointTransaction[];
    },
    enabled: !!customerId,
  });
}

// Hook: Thêm bút toán điều chỉnh điểm
export function useAdjustPoints() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      customerId,
      points,
      description,
      note,
      branchId,
    }: {
      customerId: string;
      points: number; // positive or negative
      description: string;
      note?: string;
      branchId?: string;
    }) => {
      // Get current customer points
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('current_points')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;

      const newBalance = (customer?.current_points || 0) + points;
      if (newBalance < 0) {
        throw new Error('Số điểm sau điều chỉnh không thể âm');
      }

      // Create point transaction
      const { error: txError } = await supabase
        .from('point_transactions')
        .insert([{
          customer_id: customerId,
          transaction_type: 'adjust',
          points: points,
          balance_after: newBalance,
          status: 'active',
          description: description,
          note: note,
          created_by: user?.id,
          branch_id: branchId,
        }]);

      if (txError) throw txError;

      // Update customer points
      const updateData: Record<string, number> = {
        current_points: newBalance,
      };
      
      if (points > 0) {
        updateData.total_points_earned = (customer?.current_points || 0) + points;
      }

      const { error: updateError } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId);

      if (updateError) throw updateError;

      return { newBalance };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['point-transactions', variables.customerId] });
    },
  });
}

// Hook: Tính điểm từ đơn hàng
export function useCalculatePoints() {
  const { data: settings } = usePointSettings();
  const { data: tiers } = useMembershipTiers();

  return (amount: number, customerTier: 'regular' | 'silver' | 'gold' | 'vip' = 'regular') => {
    if (!settings?.is_enabled) return 0;

    const basePoints = Math.floor(amount / settings.spend_amount) * settings.earn_points;
    
    const tierSettings = tiers?.find(t => t.tier === customerTier);
    const multiplier = tierSettings?.points_multiplier || 1;

    return Math.floor(basePoints * multiplier);
  };
}

// Hook: Tính tiền từ điểm đổi
export function useCalculatePointValue() {
  const { data: settings } = usePointSettings();

  return (points: number) => {
    if (!settings) return 0;
    return Math.floor(points / settings.redeem_points) * settings.redeem_value;
  };
}

// Hook: Lấy lịch sử mua hàng của khách
export function useCustomerPurchaseHistory(customerId: string | null) {
  return useQuery({
    queryKey: ['customer-purchase-history', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .from('export_receipts')
        .select(`
          id,
          code,
          export_date,
          total_amount,
          paid_amount,
          debt_amount,
          points_earned,
          points_redeemed,
          points_discount,
          status,
          branch_id,
          export_receipt_items (
            id,
            product_name,
            sku,
            imei,
            sale_price,
            status,
            warranty
          )
        `)
        .eq('customer_id', customerId)
        .order('export_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });
}

// Helper: Tên hạng thành viên
export const MEMBERSHIP_TIER_NAMES: Record<string, string> = {
  regular: 'Thường',
  silver: 'Bạc',
  gold: 'Vàng',
  vip: 'VIP',
};

// Helper: Màu hạng thành viên
export const MEMBERSHIP_TIER_COLORS: Record<string, string> = {
  regular: 'bg-gray-100 text-gray-800',
  silver: 'bg-slate-200 text-slate-800',
  gold: 'bg-yellow-100 text-yellow-800',
  vip: 'bg-purple-100 text-purple-800',
};

// Helper: Tên loại giao dịch điểm
export const POINT_TRANSACTION_TYPE_NAMES: Record<string, string> = {
  earn: 'Tích điểm',
  redeem: 'Đổi điểm',
  refund: 'Trả hàng',
  adjust: 'Điều chỉnh',
  expire: 'Hết hạn',
};

// Hook: Server-side COUNT stats for customer summary cards (single RPC)
export function useCustomerStats(branchFilter?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['customer-stats', user?.id, branchFilter],
    queryFn: async () => {
      const branchId = branchFilter && branchFilter !== '_all_' ? branchFilter : null;
      const { data, error } = await supabase.rpc('get_customer_stats', {
        _branch_id: branchId,
      });
      if (error) throw error;
      return data as {
        totalCustomers: number;
        customersWithPoints: number;
        vipCustomers: number;
        customersWithPurchase: number;
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}
