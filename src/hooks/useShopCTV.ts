import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ===== Settings =====
export function useShopCTVSettings(tenantId: string | null) {
  return useQuery({
    queryKey: ['shop-ctv-settings', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_ctv_settings' as any)
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useUpdateShopCTVSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, ...values }: any) => {
      const { data: existing } = await supabase
        .from('shop_ctv_settings' as any)
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('shop_ctv_settings' as any)
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shop_ctv_settings' as any)
          .insert({ tenant_id: tenantId, ...values });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-ctv-settings'] });
      toast({ title: 'Đã cập nhật cài đặt CTV' });
    },
    onError: (e: any) => toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }),
  });
}

// ===== My CTV (for CTV user on landing) =====
export function useMyShopCTV(tenantId: string | null) {
  return useQuery({
    queryKey: ['my-shop-ctv', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_shop_ctv', { _tenant_id: tenantId! });
      if (error) throw error;
      return data as any;
    },
  });
}

export function useRegisterShopCTV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { tenant_id: string; full_name: string; email: string; phone?: string; referrer_code?: string }) => {
      const { data, error } = await supabase.rpc('register_shop_ctv', {
        _tenant_id: params.tenant_id,
        _full_name: params.full_name,
        _email: params.email,
        _phone: params.phone || null,
        _referrer_code: params.referrer_code || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-shop-ctv'] });
      toast({ title: 'Đăng ký CTV thành công!' });
    },
    onError: (e: any) => toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }),
  });
}

// ===== CTV Orders (for CTV dashboard) =====
export function useMyCTVOrders(ctvId: string | null) {
  return useQuery({
    queryKey: ['my-ctv-orders', ctvId],
    enabled: !!ctvId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_ctv_orders' as any)
        .select('*')
        .eq('ctv_id', ctvId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

// ===== CTV Withdrawals =====
export function useMyCTVWithdrawals(ctvId: string | null) {
  return useQuery({
    queryKey: ['my-ctv-withdrawals', ctvId],
    enabled: !!ctvId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_ctv_withdrawals' as any)
        .select('*')
        .eq('ctv_id', ctvId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useCreateCTVWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      ctv_id: string; tenant_id: string; amount: number;
      bank_name: string; bank_account_number: string; bank_account_holder: string; note?: string;
    }) => {
      const { error } = await supabase
        .from('shop_ctv_withdrawals' as any)
        .insert(params);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-ctv-withdrawals'] });
      qc.invalidateQueries({ queryKey: ['my-shop-ctv'] });
      toast({ title: 'Đã gửi yêu cầu rút tiền' });
    },
    onError: (e: any) => toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }),
  });
}

// ===== Admin: List CTVs =====
export function useShopCTVList(tenantId: string | null) {
  return useQuery({
    queryKey: ['shop-ctv-list', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_collaborators' as any)
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useUpdateShopCTV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from('shop_collaborators' as any)
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-ctv-list'] });
      toast({ title: 'Đã cập nhật CTV' });
    },
    onError: (e: any) => toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }),
  });
}

export function useCreateShopCTV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { tenant_id: string; full_name: string; phone?: string; email?: string; commission_rate?: number; commission_type?: string }) => {
      // Generate code via RPC
      const { data: code, error: codeErr } = await supabase.rpc('generate_shop_ctv_code', { _tenant_id: params.tenant_id });
      if (codeErr) throw codeErr;
      
      const { error } = await supabase
        .from('shop_collaborators' as any)
        .insert({
          ...params,
          ctv_code: code,
          status: 'active',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-ctv-list'] });
      toast({ title: 'Đã thêm CTV' });
    },
    onError: (e: any) => toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }),
  });
}

// ===== Admin: CTV Withdrawals =====
export function useShopCTVWithdrawals(tenantId: string | null) {
  return useQuery({
    queryKey: ['shop-ctv-withdrawals-admin', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_ctv_withdrawals' as any)
        .select('*, shop_collaborators!inner(full_name, ctv_code, phone)')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useProcessCTVWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, rejected_reason }: { id: string; status: 'approved' | 'rejected'; rejected_reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('shop_ctv_withdrawals' as any)
        .update({
          status,
          rejected_reason: rejected_reason || null,
          processed_at: new Date().toISOString(),
          processed_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-ctv-withdrawals-admin'] });
      toast({ title: 'Đã xử lý yêu cầu rút tiền' });
    },
    onError: (e: any) => toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }),
  });
}

// ===== Admin: CTV Orders =====
export function useShopCTVOrders(tenantId: string | null) {
  return useQuery({
    queryKey: ['shop-ctv-orders-admin', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_ctv_orders' as any)
        .select('*, shop_collaborators!inner(full_name, ctv_code)')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}
