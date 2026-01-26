import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type EInvoiceProvider = 'vnpt' | 'viettel' | 'fpt' | 'misa' | 'other';
export type EInvoiceStatus = 'draft' | 'pending' | 'issued' | 'cancelled' | 'adjusted' | 'error';

export interface EInvoiceConfig {
  id: string;
  tenant_id: string;
  provider: EInvoiceProvider;
  provider_name: string;
  api_url: string;
  username?: string;
  api_key_encrypted?: string;
  tax_code: string;
  company_name: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  invoice_series?: string;
  invoice_template?: string;
  is_active: boolean;
  sandbox_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface EInvoice {
  id: string;
  tenant_id: string;
  branch_id?: string;
  export_receipt_id?: string;
  config_id: string;
  invoice_series?: string;
  invoice_number?: string;
  invoice_date: string;
  provider_invoice_id?: string;
  lookup_code?: string;
  customer_name: string;
  customer_tax_code?: string;
  customer_address?: string;
  customer_email?: string;
  customer_phone?: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  amount_in_words?: string;
  status: EInvoiceStatus;
  error_message?: string;
  provider_response?: any;
  original_invoice_id?: string;
  adjustment_reason?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  einvoice_items?: EInvoiceItem[];
}

export interface EInvoiceItem {
  id: string;
  einvoice_id: string;
  line_number: number;
  product_name: string;
  product_code?: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
  vat_rate?: number;
  vat_amount?: number;
  total_amount: number;
  note?: string;
  created_at: string;
}

export interface EInvoiceLog {
  id: string;
  tenant_id: string;
  einvoice_id?: string;
  action: string;
  request_data?: any;
  response_data?: any;
  status_code?: number;
  error_message?: string;
  created_at: string;
}

// Hook to get e-invoice config
export function useEInvoiceConfig() {
  return useQuery({
    queryKey: ['einvoice-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einvoice_configs')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as EInvoiceConfig | null;
    },
  });
}

// Hook to get all e-invoice configs for tenant
export function useEInvoiceConfigs() {
  return useQuery({
    queryKey: ['einvoice-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einvoice_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EInvoiceConfig[];
    },
  });
}

// Hook to create/update e-invoice config
export function useSaveEInvoiceConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<EInvoiceConfig> & { id?: string }) => {
      const { id, ...configData } = config;
      
      if (id) {
        const { data, error } = await supabase
          .from('einvoice_configs')
          .update(configData as any)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // First, get tenant_id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Chưa đăng nhập');

        const { data: platformUser } = await supabase
          .from('platform_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: userRole } = await supabase
          .from('user_roles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const tenantId = platformUser?.tenant_id || userRole?.tenant_id;
        if (!tenantId) throw new Error('Không tìm thấy cửa hàng');

        const { data, error } = await supabase
          .from('einvoice_configs')
          .insert({ ...(configData as any), tenant_id: tenantId })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['einvoice-config'] });
      queryClient.invalidateQueries({ queryKey: ['einvoice-configs'] });
      toast({
        title: 'Thành công',
        description: 'Đã lưu cấu hình hoá đơn điện tử',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook to delete e-invoice config
export function useDeleteEInvoiceConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('einvoice_configs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['einvoice-config'] });
      queryClient.invalidateQueries({ queryKey: ['einvoice-configs'] });
    },
  });
}

// Hook to get e-invoices
export function useEInvoices(filters?: { status?: EInvoiceStatus; fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['einvoices', filters],
    queryFn: async () => {
      let query = supabase
        .from('einvoices')
        .select('*, einvoice_items(*)')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.fromDate) {
        query = query.gte('invoice_date', filters.fromDate);
      }
      if (filters?.toDate) {
        query = query.lte('invoice_date', filters.toDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EInvoice[];
    },
  });
}

// Hook to get single e-invoice
export function useEInvoice(id: string) {
  return useQuery({
    queryKey: ['einvoice', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einvoices')
        .select('*, einvoice_items(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as EInvoice;
    },
    enabled: !!id,
  });
}

// Hook to call e-invoice API
export function useEInvoiceAPI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, data }: { action: string; data?: any }) => {
      const { data: result, error } = await supabase.functions.invoke('einvoice-api', {
        body: { action, data },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['einvoices'] });
    },
  });
}

// Hook to get e-invoice logs
export function useEInvoiceLogs(einvoiceId?: string) {
  return useQuery({
    queryKey: ['einvoice-logs', einvoiceId],
    queryFn: async () => {
      let query = supabase
        .from('einvoice_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (einvoiceId) {
        query = query.eq('einvoice_id', einvoiceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EInvoiceLog[];
    },
  });
}

// Provider info helper
export const EINVOICE_PROVIDERS = [
  {
    id: 'vnpt' as const,
    name: 'VNPT E-Invoice',
    apiUrl: 'https://hoadondientu.vnpt.vn',
    sandboxUrl: 'https://demohoadon.vnpt.vn',
    docUrl: 'https://hoadondientu.vnpt.vn/huong-dan-api',
  },
  {
    id: 'viettel' as const,
    name: 'Viettel S-Invoice',
    apiUrl: 'https://sinvoice.viettel.vn',
    sandboxUrl: 'https://demo-sinvoice.viettel.vn',
    docUrl: 'https://sinvoice.viettel.vn/huong-dan',
  },
  {
    id: 'fpt' as const,
    name: 'FPT eInvoice',
    apiUrl: 'https://einvoice.fpt.vn',
    sandboxUrl: 'https://demo.einvoice.fpt.vn',
    docUrl: 'https://einvoice.fpt.vn/docs',
  },
  {
    id: 'misa' as const,
    name: 'MISA meInvoice',
    apiUrl: 'https://meinvoice.vn',
    sandboxUrl: 'https://tuvantestonline.meinvoice.vn',
    docUrl: 'https://meinvoice.vn/api-document',
  },
];
