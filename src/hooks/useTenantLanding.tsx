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
  created_at: string;
  updated_at: string;
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

// Hook tra cứu bảo hành công khai
export function useWarrantyLookup(imei: string, tenantId: string | null) {
  return useQuery({
    queryKey: ['warranty-lookup', imei, tenantId],
    queryFn: async () => {
      if (!imei || !tenantId) return null;

      // Tìm sản phẩm đã bán với IMEI này trong tenant
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
          receipt_id,
          export_receipts!inner (
            id,
            code,
            export_date,
            tenant_id
          )
        `)
        .eq('imei', imei)
        .eq('export_receipts.tenant_id', tenantId)
        .eq('status', 'sold')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!imei && !!tenantId && imei.length >= 5,
  });
}
