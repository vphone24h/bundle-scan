import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface InvoiceTemplate {
  id: string;
  name: string;
  paper_size: 'K80' | 'A4';
  show_logo: boolean;
  show_store_name: boolean;
  store_name: string | null;
  show_store_address: boolean;
  store_address: string | null;
  show_store_phone: boolean;
  store_phone: string | null;
  show_customer_info: boolean;
  show_sale_date: boolean;
  show_receipt_code: boolean;
  show_product_name: boolean;
  show_sku: boolean;
  show_imei: boolean;
  show_sale_price: boolean;
  show_total: boolean;
  show_paid_amount: boolean;
  show_debt: boolean;
  show_note: boolean;
  show_thank_you: boolean;
  thank_you_text: string | null;
  font_size: 'small' | 'medium' | 'large';
  text_align: 'left' | 'center' | 'right';
  field_order: string[];
  is_default: boolean;
  margin_left: number;
  margin_right: number;
  created_at: string;
  updated_at: string;
}

export function useInvoiceTemplates() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['invoice-templates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as InvoiceTemplate[];
    },
    enabled: !!user?.id,
  });
}

export function useDefaultInvoiceTemplate() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['invoice-template-default', user?.id],
    queryFn: async () => {
      // Try to get existing default template
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      
      // If no template exists, create one
      if (!data) {
        const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
        
        const { data: newTemplate, error: insertError } = await supabase
          .from('invoice_templates')
          .insert([{
            name: 'Mẫu mặc định',
            paper_size: 'K80',
            is_default: true,
            tenant_id: tenantId,
            show_logo: true,
            show_store_name: true,
            show_store_address: true,
            show_store_phone: true,
            show_customer_info: true,
            show_sale_date: true,
            show_receipt_code: true,
            show_product_name: true,
            show_sku: true,
            show_imei: true,
            show_sale_price: true,
            show_total: true,
            show_paid_amount: true,
            show_debt: true,
            show_note: true,
            show_thank_you: true,
            thank_you_text: 'Cảm ơn quý khách!',
            font_size: 'medium',
            text_align: 'left',
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        return newTemplate as InvoiceTemplate;
      }
      
      return data as InvoiceTemplate;
    },
  });
}

export function useUpdateInvoiceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InvoiceTemplate> & { id: string }) => {
      // Update without requiring single row return
      const { error } = await supabase
        .from('invoice_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return { id, ...updates } as InvoiceTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-template-default'] });
    },
  });
}

export function useCreateInvoiceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Partial<InvoiceTemplate>) => {
      const { data, error } = await supabase
        .from('invoice_templates')
        .insert([template])
        .select()
        .single();

      if (error) throw error;
      return data as InvoiceTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
    },
  });
}
