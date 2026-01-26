import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  created_at: string;
  updated_at: string;
}

export function useInvoiceTemplates() {
  return useQuery({
    queryKey: ['invoice-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as InvoiceTemplate[];
    },
  });
}

export function useDefaultInvoiceTemplate() {
  return useQuery({
    queryKey: ['invoice-template-default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      return data as InvoiceTemplate | null;
    },
  });
}

export function useUpdateInvoiceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InvoiceTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('invoice_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as InvoiceTemplate;
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
