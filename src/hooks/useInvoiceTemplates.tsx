import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type TextAlign = 'left' | 'center' | 'right';

export interface InvoiceTemplate {
  id: string;
  name: string;
  paper_size: 'K80' | 'A4';
  branch_id: string | null;
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
  show_warranty: boolean;
  show_sale_price: boolean;
  show_total: boolean;
  show_paid_amount: boolean;
  show_debt: boolean;
  show_note: boolean;
  show_tax: boolean;
  show_thank_you: boolean;
  show_custom_description: boolean;
  custom_description_text: string | null;
  custom_description_bold: boolean;
  custom_description_align: TextAlign;
  custom_description_image_url: string | null;
  show_points_earned: boolean;
  thank_you_text: string | null;
  font_size: 'small' | 'medium' | 'large';
  text_align: TextAlign;
  field_order: string[];
  is_default: boolean;
  margin_left: number;
  margin_right: number;
  // Per-section alignment for K80
  section1_align: TextAlign; // Store info
  section2_align: TextAlign; // Invoice title
  section3_align: TextAlign; // Code, date, customer
  section4_align: TextAlign; // Products
  section5_align: TextAlign; // Totals
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

// Get template for a specific branch, or fallback to global default
export function useInvoiceTemplateByBranch(branchId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['invoice-template-branch', user?.id, branchId],
    queryFn: async () => {
      // First try to get branch-specific template
      if (branchId) {
        const { data: branchTemplate, error: branchError } = await supabase
          .from('invoice_templates')
          .select('*')
          .eq('branch_id', branchId)
          .maybeSingle();

        if (!branchError && branchTemplate) {
          return branchTemplate as InvoiceTemplate;
        }
      }

      // Fallback to global default template (no branch_id)
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .is('branch_id', null)
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      
      // If no template exists at all, create a global default
      if (!data) {
        const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
        
        const { data: newTemplate, error: insertError } = await supabase
          .from('invoice_templates')
          .insert([{
            name: 'Mẫu mặc định',
            paper_size: 'K80',
            is_default: true,
            tenant_id: tenantId,
            branch_id: null,
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
    enabled: !!user?.id,
  });
}

export function useDefaultInvoiceTemplate() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['invoice-template-default', user?.id],
    queryFn: async () => {
      // Try to get existing default template (global, no branch)
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .is('branch_id', null)
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
            branch_id: null,
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
      queryClient.invalidateQueries({ queryKey: ['invoice-template-branch'] });
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
      queryClient.invalidateQueries({ queryKey: ['invoice-template-branch'] });
    },
  });
}

// Create or get template for a specific branch
export function useGetOrCreateBranchTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ branchId, branchName, branchAddress, branchPhone }: { 
      branchId: string; 
      branchName: string;
      branchAddress?: string | null;
      branchPhone?: string | null;
    }) => {
      // Check if template exists for this branch
      const { data: existing, error: checkError } = await supabase
        .from('invoice_templates')
        .select('*')
        .eq('branch_id', branchId)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) return existing as InvoiceTemplate;

      // Get tenant_id
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');

      // Create new template for this branch with branch info
      const { data: newTemplate, error: insertError } = await supabase
        .from('invoice_templates')
        .insert([{
          name: `Mẫu ${branchName}`,
          paper_size: 'K80',
          is_default: false,
          tenant_id: tenantId,
          branch_id: branchId,
          show_logo: true,
          show_store_name: true,
          store_name: branchName,
          show_store_address: true,
          store_address: branchAddress || null,
          show_store_phone: true,
          store_phone: branchPhone || null,
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-template-branch'] });
    },
  });
}
