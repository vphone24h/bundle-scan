import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TenantLandingSettings {
  id: string;
  tenant_id: string;
  store_name: string | null;
  store_logo_url: string | null;
  store_address: string | null;
  additional_addresses: string[] | null;
  store_phone: string | null;
  store_email: string | null;
  store_description: string | null;
  banner_image_url: string | null;
  banner_link_url: string | null;
  show_warranty_lookup: boolean;
  show_store_info: boolean;
  show_banner: boolean;
  show_branches: boolean;
  primary_color: string;
  meta_title: string | null;
  meta_description: string | null;
  is_enabled: boolean;
  warranty_hotline: string | null;
  support_group_url: string | null;
  facebook_url: string | null;
  zalo_url: string | null;
  tiktok_url: string | null;
  custom_domain_article: string | null;
  show_custom_domain_cta: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
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
  staff_user_id: string | null;
  staff_name: string | null;
  branch_id: string | null;
  customer_name: string | null;
  customer_id: string | null;
}

export interface CustomerPointsPublic {
  current_points: number;
  total_points_earned: number;
  total_points_used: number;
  membership_tier: string;
  point_value: number;
  redeem_points: number;
  is_points_enabled: boolean;
  max_redemption_enabled: boolean;
  max_redemption_amount: number;
  review_reward_points: number;
  customer_name: string | null;
  customer_id: string | null;
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

      // Luôn lấy danh sách chi nhánh (dùng cho form đặt hàng + hiển thị)
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name, address, phone')
        .eq('tenant_id', tenant.id)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      
      const branches: BranchInfo[] = (branchesData || []) as BranchInfo[];
      const settings = data as unknown as TenantLandingSettings | null;
      
      // Trả về kết hợp tenant info + settings + branches
      return {
        tenant,
        settings,
        branches,
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
// Sử dụng RPC functions bảo mật với rate limiting, KHÔNG trả về thông tin nhạy cảm của khách hàng
export function useWarrantyLookup(searchValue: string, tenantId: string | null) {
  return useQuery({
    queryKey: ['warranty-lookup', searchValue, tenantId],
    queryFn: async (): Promise<WarrantyResult[] | null> => {
      if (!searchValue || !tenantId) return null;

      // Get client IP for rate limiting
      let clientIp = 'unknown';
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        clientIp = data.ip || 'unknown';
      } catch {
        // If IP detection fails, continue without it
      }

      const isPhoneNumber = /^0\d{9,10}$/.test(searchValue.replace(/\s/g, ''));
      
      if (isPhoneNumber) {
        // Sử dụng RPC function bảo mật để tra cứu theo SĐT
        // Rate limiting enforced server-side per IP address
        const { data, error } = await supabase
          .rpc('lookup_warranty_by_phone', {
            _phone: searchValue,
            _tenant_id: tenantId,
            _ip_address: clientIp
          });

        if (error) throw error;
        
        // Map kết quả - KHÔNG bao gồm customer_phone
        return (data || []).map((item: any) => ({
          id: item.id,
          imei: item.imei,
          product_name: item.product_name,
          sku: item.sku,
          warranty: item.warranty,
          sale_price: item.sale_price,
          created_at: item.created_at,
          branch_name: item.branch_name || null,
          export_date: item.export_date || item.created_at,
          customer_phone: item.customer_phone || null,
          staff_user_id: item.staff_user_id || null,
          staff_name: item.staff_name || null,
          branch_id: item.branch_id || null,
          customer_name: item.customer_name || null,
          customer_id: item.customer_id || null,
        }));
      } else {
        // Sử dụng RPC function bảo mật để tra cứu theo IMEI
        // Rate limiting enforced server-side per IP address
        const { data, error } = await supabase
          .rpc('lookup_warranty_by_imei', {
            _imei: searchValue,
            _tenant_id: tenantId,
            _ip_address: clientIp
          });

        if (error) throw error;
        
        return (data || []).map((item: any) => ({
          id: item.id,
          imei: item.imei,
          product_name: item.product_name,
          sku: item.sku,
          warranty: item.warranty,
          sale_price: item.sale_price,
          created_at: item.created_at,
          branch_name: item.branch_name || null,
          export_date: item.export_date || item.created_at,
          customer_phone: item.customer_phone || null,
          staff_user_id: item.staff_user_id || null,
          staff_name: item.staff_name || null,
          branch_id: item.branch_id || null,
          customer_name: item.customer_name || null,
          customer_id: item.customer_id || null,
        }));
      }
    },
    enabled: !!searchValue && !!tenantId && searchValue.length >= 5,
  });
}

// Hook tra cứu điểm tích lũy công khai - chỉ theo SĐT
export function useCustomerPointsPublic(phone: string, tenantId: string | null) {
  return useQuery({
    queryKey: ['customer-points-public', phone, tenantId],
    queryFn: async (): Promise<CustomerPointsPublic | null> => {
      if (!phone || !tenantId) return null;

      const isPhoneNumber = /^0\d{9,10}$/.test(phone.replace(/\s/g, ''));
      if (!isPhoneNumber) return null;

      const { data, error } = await supabase
        .rpc('lookup_customer_points_public', {
          _phone: phone,
          _tenant_id: tenantId
        });

      if (error) return null;
      
      if (data && data.length > 0) {
        return data[0] as CustomerPointsPublic;
      }
      return null;
    },
    enabled: !!phone && !!tenantId && phone.length >= 10,
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
