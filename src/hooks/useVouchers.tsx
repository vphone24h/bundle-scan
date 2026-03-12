import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface VoucherTemplate {
  id: string;
  tenant_id: string;
  name: string;
  discount_type: 'amount' | 'percentage';
  discount_value: number;
  description: string | null;
  conditions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerVoucher {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  voucher_template_id: string | null;
  code: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  discount_type: string;
  discount_value: number;
  voucher_name: string;
  source: string;
  status: 'unused' | 'used';
  used_at: string | null;
  used_by: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

// === Admin hooks ===

export function useVoucherTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['voucher-templates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voucher_templates' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as VoucherTemplate[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateVoucherTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: Omit<VoucherTemplate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      const { data, error } = await supabase
        .from('voucher_templates' as any)
        .insert([{ ...template, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voucher-templates'] }),
  });
}

export function useUpdateVoucherTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VoucherTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('voucher_templates' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voucher-templates'] }),
  });
}

export function useDeleteVoucherTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('voucher_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voucher-templates'] }),
  });
}

// Customer vouchers (admin view)
export function useCustomerVouchers(filters?: { search?: string; status?: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['customer-vouchers', user?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('customer_vouchers' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== '_all_') {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        query = query.or(`customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as CustomerVoucher[];
    },
    enabled: !!user?.id,
  });
}

// Mark voucher as used
export function useMarkVoucherUsed() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (voucherId: string) => {
      const { error } = await supabase
        .from('customer_vouchers' as any)
        .update({ status: 'used', used_at: new Date().toISOString(), used_by: user?.id })
        .eq('id', voucherId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-vouchers'] });
    },
  });
}

// Issue voucher manually (from export/sale)
export function useIssueVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      customer_id: string;
      customer_name: string;
      customer_phone: string;
      customer_email?: string;
      voucher_template_id: string;
      branch_id?: string;
      source: 'export' | 'manual';
    }) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Get template
      const { data: template, error: tErr } = await supabase
        .from('voucher_templates' as any)
        .select('*')
        .eq('id', params.voucher_template_id)
        .single();
      if (tErr || !template) throw new Error('Không tìm thấy voucher mẫu');
      const t = template as unknown as VoucherTemplate;

      // Generate code
      const { data: code } = await supabase.rpc('generate_voucher_code');

      const { data, error } = await supabase
        .from('customer_vouchers' as any)
        .insert([{
          tenant_id: tenantId,
          customer_id: params.customer_id,
          voucher_template_id: params.voucher_template_id,
          code: code || `VC-${Date.now()}`,
          customer_name: params.customer_name,
          customer_phone: params.customer_phone,
          customer_email: params.customer_email || null,
          discount_type: t.discount_type,
          discount_value: t.discount_value,
          voucher_name: t.name,
          source: params.source,
          branch_id: params.branch_id || null,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-vouchers'] }),
  });
}

// === Public hooks (anon-safe via RPC) ===

export function useClaimWebsiteVoucher() {
  return useMutation({
    mutationFn: async (params: {
      tenant_id: string;
      customer_name: string;
      customer_phone: string;
      customer_email: string;
      branch_id?: string;
    }) => {
      const { data, error } = await supabase.rpc('claim_website_voucher', {
        _tenant_id: params.tenant_id,
        _customer_name: params.customer_name,
        _customer_phone: params.customer_phone,
        _customer_email: params.customer_email,
        _branch_id: params.branch_id || null,
      });
      if (error) throw error;
      return data as {
        already_claimed: boolean;
        code: string;
        voucher_name: string;
        discount_type: string;
        discount_value: number;
        voucher_id?: string;
      };
    },
  });
}

export function usePublicCustomerVouchers(phone: string, tenantId: string | null) {
  const normalizedPhone = phone.replace(/\D/g, '');
  const normalizedVietnamesePhone = normalizedPhone.startsWith('84')
    ? `0${normalizedPhone.slice(2)}`
    : normalizedPhone;
  const isPhoneNumber = /^0\d{9,10}$/.test(normalizedVietnamesePhone);

  return useQuery({
    queryKey: ['public-customer-vouchers', normalizedVietnamesePhone, tenantId],
    queryFn: async () => {
      if (!isPhoneNumber || !tenantId) return [];
      const { data, error } = await supabase.rpc('lookup_customer_vouchers_public', {
        _phone: normalizedVietnamesePhone,
        _tenant_id: tenantId,
      });
      if (error) return [];
      return (data || []) as { id: string; code: string; voucher_name: string; discount_type: string; discount_value: number; status: string; source: string; created_at: string }[];
    },
    enabled: !!tenantId && isPhoneNumber,
  });
}
