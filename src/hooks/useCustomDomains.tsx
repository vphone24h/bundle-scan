import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomDomain {
  id: string;
  tenant_id: string;
  domain: string;
  is_verified: boolean;
  verified_at: string | null;
  verification_token: string | null;
  ssl_status: string;
  created_at: string;
  updated_at: string;
}

// Lấy danh sách custom domains của tenant hiện tại
export function useCustomDomains() {
  return useQuery({
    queryKey: ['custom-domains'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_domains')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CustomDomain[];
    },
  });
}

// Thêm custom domain mới
export function useAddCustomDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domain: string) => {
      // Lấy tenant_id hiện tại
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Tạo verification token
      const { data: token } = await supabase.rpc('generate_domain_verification_token');

      const { data, error } = await supabase
        .from('custom_domains')
        .insert([{
          tenant_id: tenantId,
          domain: domain.toLowerCase().trim(),
          verification_token: token,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as CustomDomain;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-domains'] });
    },
  });
}

// Xóa custom domain (chỉ admin)
export function useDeleteCustomDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_domains')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-domains'] });
    },
  });
}

// Verify domain (kiểm tra TXT record)
export function useVerifyDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domainId: string) => {
      // Gọi Edge Function để verify domain
      const response = await supabase.functions.invoke('verify-domain', {
        body: { domainId },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-domains'] });
    },
  });
}

// Platform Admin: Lấy tất cả custom domains
export function useAllCustomDomains() {
  return useQuery({
    queryKey: ['all-custom-domains'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_domains')
        .select(`
          *,
          tenants:tenant_id (
            id,
            name,
            subdomain,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

// Platform Admin: Cập nhật trạng thái domain
export function useUpdateDomainStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_verified, ssl_status }: { 
      id: string; 
      is_verified?: boolean; 
      ssl_status?: string;
    }) => {
      const updates: Record<string, unknown> = {};
      if (is_verified !== undefined) {
        updates.is_verified = is_verified;
        if (is_verified) updates.verified_at = new Date().toISOString();
      }
      if (ssl_status) updates.ssl_status = ssl_status;

      const { data, error } = await supabase
        .from('custom_domains')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-domains'] });
      queryClient.invalidateQueries({ queryKey: ['all-custom-domains'] });
    },
  });
}

// Resolve tenant từ domain (dùng cho routing)
export async function resolveTenantByDomain(domain: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_tenant_by_domain', {
    _domain: domain,
  });

  if (error) {
    console.error('Error resolving tenant:', error);
    return null;
  }

  return data;
}

// Helper: Lấy domain hiện tại từ URL
export function getCurrentDomain(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname;
}

// Helper: Kiểm tra xem có phải subdomain không
export function isSubdomain(domain: string, baseDomain: string): boolean {
  return domain.endsWith(`.${baseDomain}`) && domain !== baseDomain;
}

// Helper: Trích xuất subdomain từ domain
export function extractSubdomain(domain: string, baseDomain: string): string | null {
  if (!isSubdomain(domain, baseDomain)) return null;
  return domain.replace(`.${baseDomain}`, '');
}
