import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NavItemConfig, HomeSection } from '@/lib/industryConfig';

export interface HomeSectionItem {
  id: HomeSection | string; // string for custom tab IDs like "productTab_xxx"
  enabled: boolean;
  displayMode?: 'horizontal' | 'vertical'; // for categories section
  hiddenCategoryIds?: string[]; // categories hidden on homepage only
}

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
  warranty_description: string | null;
  facebook_url: string | null;
  zalo_url: string | null;
  tiktok_url: string | null;
  custom_domain_article: string | null;
  show_custom_domain_cta: boolean;
  voucher_enabled: boolean;
  voucher_template_id: string | null;
  website_template: string;
  ai_description_enabled: boolean;
  auto_image_enabled: boolean;
  custom_trust_badges: { icon: string; title: string; desc: string }[] | null;
  custom_nav_items: NavItemConfig[] | null;
  // Phase 3: Customization
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_cta: string | null;
  custom_home_sections: HomeSectionItem[] | null;
  custom_product_tabs: { id: string; name: string; displayStyle: string; enabled: boolean; icon?: string }[] | null;
  custom_font_family: string | null;
  custom_layout_style: string | null;
  custom_products_page_sections: HomeSectionItem[] | null;
  custom_products_page_tabs: { id: string; name: string; displayStyle: string; enabled: boolean; icon?: string }[] | null;
  custom_product_detail_sections: { id: string; enabled: boolean }[] | null;
  custom_cta_buttons: { id: string; label: string; icon: string; action: string; enabled: boolean; customUrl?: string }[] | null;
  custom_news_page_sections: { id: string; enabled: boolean }[] | null;
  custom_news_page_tabs: { id: string; name: string; icon?: string }[] | null;
  show_installment_button: boolean | null;
  show_compare_products: boolean | null;
  show_trade_in: boolean | null;
  order_email_enabled: boolean;
  order_email_sender: string | null;
  order_email_app_password: string | null;
  order_email_on_confirmed: boolean;
  order_email_on_shipping: boolean;
  order_email_on_warranty: boolean;
  order_email_on_export: boolean;
  // Payment config
  payment_cod_enabled: boolean;
  payment_transfer_enabled: boolean;
  payment_bank_name: string | null;
  payment_account_number: string | null;
  payment_account_holder: string | null;
  payment_confirm_zalo_url: string | null;
  payment_confirm_messenger_url: string | null;
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
  note: string | null;
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

// Hook để lấy landing settings công khai từ subdomain hoặc tenantId (custom domain)
export function usePublicLandingSettings(subdomain: string | null, tenantIdFromDomain?: string | null) {
  return useQuery({
    queryKey: ['public-landing-settings', subdomain, tenantIdFromDomain],
    queryFn: async () => {
      // Only use completed prefetch data; do not wait for full catalog prefetch
      // so warranty-first app can render immediately.
      const prefetch = (window as any).__STORE_PREFETCH__;
      const prefetchedData = prefetch?.data;
      if (prefetchedData?.settings && (prefetch.tenant || prefetch.tenantId)) {
        const tenantInfo = prefetch.tenant || { id: prefetch.tenantId, name: prefetchedData.settings.store_name || '', subdomain: prefetch.storeId || '', status: 'active' };
        return {
          tenant: tenantInfo,
          settings: prefetchedData.settings as unknown as TenantLandingSettings,
          branches: (prefetchedData.branches || []) as BranchInfo[],
        };
      }

      let tenantInfo: { id: string; name: string; subdomain: string; status: string } | null = null;

      // Nếu có subdomain, tra cứu theo subdomain
      if (subdomain) {
        const { data: tenantData, error: tenantError } = await supabase
          .rpc('lookup_tenant_by_subdomain', { _subdomain: subdomain });

        const tenant = Array.isArray(tenantData) ? tenantData[0] : tenantData;
        if (tenantError || !tenant) return null;
        tenantInfo = tenant;
      } else if (tenantIdFromDomain) {
        // Custom domain → dùng RPC lookup_tenant_by_id (SECURITY DEFINER, anon-safe)
        const { data: tenantData, error: tenantError } = await supabase
          .rpc('lookup_tenant_by_id', { _tenant_id: tenantIdFromDomain });
        const tenant = Array.isArray(tenantData) ? tenantData[0] : tenantData;
        if (tenantError || !tenant) return null;
        tenantInfo = tenant;
      }

      if (!tenantInfo) return null;

      // Fetch settings + branches IN PARALLEL (thay vì tuần tự)
      const [settingsResult, branchesResult] = await Promise.all([
        supabase
          .from('tenant_landing_settings' as any)
          .select('*')
          .eq('tenant_id', tenantInfo.id)
          .eq('is_enabled', true)
          .maybeSingle(),
        supabase
          .rpc('get_tenant_branches', { _tenant_id: tenantInfo.id }),
      ]);

      if (settingsResult.error) return null;

      const branches: BranchInfo[] = (branchesResult.data || []) as BranchInfo[];
      const settings = settingsResult.data as unknown as TenantLandingSettings | null;
      
      return {
        tenant: tenantInfo,
        settings,
        branches,
      };
    },
    enabled: !!subdomain || !!tenantIdFromDomain,
    staleTime: 1000 * 60 * 5, // 5 phút - tránh refetch không cần thiết
    gcTime: 1000 * 60 * 15, // 15 phút cache
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

// Fast IP fetch with 2s timeout - non-blocking for warranty lookup
let _cachedIp: string | null = null;
let _ipFetchPromise: Promise<string | null> | null = null;

function getClientIpFast(): Promise<string | null> {
  // Use IP preloaded by index.html prefetch script (standalone mode)
  if ((window as any).__WARRANTY_CACHED_IP__) {
    _cachedIp = (window as any).__WARRANTY_CACHED_IP__;
    return Promise.resolve(_cachedIp);
  }
  if ((window as any).__WARRANTY_IP_PROMISE__) {
    return (window as any).__WARRANTY_IP_PROMISE__
      .then((ip: string | null) => {
        _cachedIp = ip;
        return ip;
      })
      .catch(() => null);
  }
  if (_cachedIp) return Promise.resolve(_cachedIp);
  if (_ipFetchPromise) return _ipFetchPromise;
  _ipFetchPromise = Promise.race([
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(d => {
        const ip = typeof d?.ip === 'string' ? d.ip.trim() : '';
        _cachedIp = ip && ip.toLowerCase() !== 'unknown' ? ip : null;
        return _cachedIp;
      }),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 2000)),
  ]).catch(() => null).finally(() => { _ipFetchPromise = null; });
  return _ipFetchPromise;
}

// Export so StoreLandingPage can preload IP on mount
export function preloadClientIp() { getClientIpFast(); }

function mapWarrantyItem(item: any): WarrantyResult {
  return {
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
    note: item.note || null,
  };
}

interface WarrantyLookupOptions {
  enabled?: boolean;
}

// Hook tra cứu bảo hành công khai - hỗ trợ IMEI hoặc SĐT
// Sử dụng RPC functions bảo mật với rate limiting, KHÔNG trả về thông tin nhạy cảm của khách hàng
export function useWarrantyLookup(
  searchValue: string,
  tenantId: string | null,
  options: WarrantyLookupOptions = {}
) {
  const queryEnabled = options.enabled ?? true;

  return useQuery({
    queryKey: ['warranty-lookup', searchValue, tenantId],
    queryFn: async (): Promise<WarrantyResult[] | null> => {
      if (!searchValue || !tenantId) return null;

      const compactSearch = searchValue.trim().replace(/\s+/g, '');

      // Non-blocking IP fetch with 2s timeout
      const clientIp = await getClientIpFast().catch(() => null);

      const isPhoneNumber = /^0\d{9,10}$/.test(compactSearch);
      const rpcName = isPhoneNumber ? 'lookup_warranty_by_phone' : 'lookup_warranty_by_imei';
      const rpcParams = isPhoneNumber
        ? { _phone: compactSearch, _tenant_id: tenantId, _ip_address: clientIp }
        : { _imei: compactSearch, _tenant_id: tenantId, _ip_address: clientIp };

      const { data, error } = await supabase.rpc(rpcName, rpcParams);
      if (error) throw error;
      return (data || []).map(mapWarrantyItem);
    },
    enabled: queryEnabled && !!searchValue && !!tenantId && searchValue.length >= 5,
    retry: (failureCount, error) => {
      const message = String((error as any)?.message || '');
      if (message.includes('Rate limit exceeded')) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 10000),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

// Hook tra cứu điểm tích lũy công khai - chỉ theo SĐT
export function useCustomerPointsPublic(phone: string, tenantId: string | null) {
  const normalizedPhone = phone.replace(/\D/g, '');
  const normalizedVietnamesePhone = normalizedPhone.startsWith('84')
    ? `0${normalizedPhone.slice(2)}`
    : normalizedPhone;
  const isPhoneNumber = /^0\d{9,10}$/.test(normalizedVietnamesePhone);

  return useQuery({
    queryKey: ['customer-points-public', normalizedVietnamesePhone, tenantId],
    queryFn: async (): Promise<CustomerPointsPublic | null> => {
      if (!isPhoneNumber || !tenantId) return null;

      const { data, error } = await supabase
        .rpc('lookup_customer_points_public', {
          _phone: normalizedVietnamesePhone,
          _tenant_id: tenantId
        });

      if (error) return null;
      
      if (data && data.length > 0) {
        return data[0] as CustomerPointsPublic;
      }
      return null;
    },
    enabled: !!tenantId && isPhoneNumber,
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
