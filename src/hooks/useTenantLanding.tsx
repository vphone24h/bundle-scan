import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TenantLandingSettings {
  id: string;
  tenant_id: string;
  store_name: string | null;
  store_logo_url: string | null;
  store_address: string | null;
  store_phone: string | null;
  store_email: string | null;
  store_description: string | null;
  banner_image_url: string | null;
  banner_link_url: string | null;
  show_warranty_lookup: boolean;
  show_store_info: boolean;
  show_banner: boolean;
  primary_color: string;
  meta_title: string | null;
  meta_description: string | null;
  is_enabled: boolean;
  warranty_hotline: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarrantyResult {
  id: string;
  imei: string | null;
  product_name: string;
  sku: string;
  warranty: string | null;
  sale_price: number;
  created_at: string;
  branch_name: string | null;
  export_date: string;
  customer_phone: string | null;
}

// Hook để lấy landing settings của tenant hiện tại (cho admin)
export function useTenantLandingSettings() {
  return useQuery({
    queryKey: ['tenant-landing-settings'],
    queryFn: async () => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenant_landing_settings' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as TenantLandingSettings | null;
    },
  });
}

// Hook để lấy landing settings công khai từ subdomain
export function usePublicLandingSettings(subdomain: string | null) {
  return useQuery({
    queryKey: ['public-landing-settings', subdomain],
    queryFn: async () => {
      if (!subdomain) return null;

      // Tìm tenant theo subdomain
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, subdomain')
        .eq('subdomain', subdomain)
        .maybeSingle();

      if (tenantError || !tenant) return null;

      // Lấy landing settings
      const { data, error } = await supabase
        .from('tenant_landing_settings' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_enabled', true)
        .maybeSingle();

      if (error) return null;
      
      // Trả về kết hợp tenant info + settings
      return {
        tenant,
        settings: data as unknown as TenantLandingSettings | null,
      };
    },
    enabled: !!subdomain,
  });
}

// Hook để tạo/cập nhật landing settings
export function useUpdateTenantLandingSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<TenantLandingSettings>) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Kiểm tra đã có settings chưa
      const { data: existing } = await supabase
        .from('tenant_landing_settings' as any)
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('tenant_landing_settings' as any)
          .update(settings)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('tenant_landing_settings' as any)
          .insert([{ ...settings, tenant_id: tenantId }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-landing-settings'] });
    },
  });
}

// Hook tra cứu bảo hành công khai - hỗ trợ IMEI hoặc SĐT
export function useWarrantyLookup(searchValue: string, tenantId: string | null) {
  return useQuery({
    queryKey: ['warranty-lookup', searchValue, tenantId],
    queryFn: async (): Promise<WarrantyResult[] | null> => {
      if (!searchValue || !tenantId) return null;

      const isPhoneNumber = /^0\d{9,10}$/.test(searchValue.replace(/\s/g, ''));
      
      if (isPhoneNumber) {
        // Tìm theo SĐT khách hàng - Step 1: Tìm customer_id trong tenant
        const { data: customers, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('phone', searchValue)
          .limit(1);

        if (customerError) throw customerError;
        if (!customers || customers.length === 0) return [];

        const customerId = customers[0].id;

        // Step 2: Lấy các đơn hàng của customer này trong tenant
        const { data, error } = await supabase
          .from('export_receipt_items')
          .select(`
            id,
            imei,
            product_name,
            sku,
            warranty,
            sale_price,
            created_at,
            export_receipts!inner (
              id,
              code,
              export_date,
              tenant_id,
              branch_id,
              customer_id,
              branches (name)
            )
          `)
          .eq('export_receipts.tenant_id', tenantId)
          .eq('export_receipts.customer_id', customerId)
          .eq('status', 'sold')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        
        // Map kết quả
        return (data || []).map((item: any) => ({
          id: item.id,
          imei: item.imei,
          product_name: item.product_name,
          sku: item.sku,
          warranty: item.warranty,
          sale_price: item.sale_price,
          created_at: item.created_at,
          branch_name: item.export_receipts?.branches?.name || null,
          export_date: item.export_receipts?.export_date || item.created_at,
          customer_phone: searchValue,
        }));
      } else {
        // Tìm theo IMEI
        const { data, error } = await supabase
          .from('export_receipt_items')
          .select(`
            id,
            imei,
            product_name,
            sku,
            warranty,
            sale_price,
            created_at,
            export_receipts!inner (
              id,
              code,
              export_date,
              tenant_id,
              branch_id,
              branches (name),
              customers (phone)
            )
          `)
          .eq('imei', searchValue)
          .eq('export_receipts.tenant_id', tenantId)
          .eq('status', 'sold')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;
        
        return (data || []).map((item: any) => ({
          id: item.id,
          imei: item.imei,
          product_name: item.product_name,
          sku: item.sku,
          warranty: item.warranty,
          sale_price: item.sale_price,
          created_at: item.created_at,
          branch_name: item.export_receipts?.branches?.name || null,
          export_date: item.export_receipts?.export_date || item.created_at,
          customer_phone: item.export_receipts?.customers?.phone || null,
        }));
      }
    },
    enabled: !!searchValue && !!tenantId && searchValue.length >= 5,
  });
}

// Upload file lên storage
export async function uploadLandingAsset(
  file: File, 
  tenantId: string, 
  type: 'logo' | 'banner'
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${tenantId}/${type}-${Date.now()}.${ext}`;
  
  const { data, error } = await supabase.storage
    .from('landing-assets')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) throw error;

  const { data: publicUrl } = supabase.storage
    .from('landing-assets')
    .getPublicUrl(data.path);

  return publicUrl.publicUrl;
}
