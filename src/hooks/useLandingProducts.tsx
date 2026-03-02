import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LandingProductCategory {
  id: string;
  tenant_id: string;
  name: string;
  display_order: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandingProductVariant {
  name: string;
  price: number;
  image_url?: string;
}

export interface VariantOption {
  name: string;
  image_url?: string;
}

export interface VariantPriceEntry {
  option1: string;
  option2?: string;
  price: number;
  sale_price?: number;
  stock?: number;
  image_url?: string;
}

export interface LandingProduct {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  images: string[];
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
  variants: LandingProductVariant[];
  // 2-level variant system
  variant_group_1_name: string;
  variant_group_2_name: string;
  variant_options_1: VariantOption[];
  variant_options_2: VariantOption[];
  variant_prices: VariantPriceEntry[];
  // Sections
  promotion_title: string;
  promotion_content: string | null;
  warranty_title: string;
  warranty_content: string | null;
  created_at: string;
  updated_at: string;
}

// Admin hooks
export function useLandingProductCategories() {
  return useQuery({
    queryKey: ['landing-product-categories'],
    queryFn: async () => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('landing_product_categories' as any)
        .select('*')
        .eq('tenant_id', tenantId)
.order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as LandingProductCategory[];
    },
  });
}

export function useCreateLandingProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { name: string; image_url?: string }) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      const { data, error } = await supabase
        .from('landing_product_categories' as any)
        .insert([{ ...cat, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-product-categories'] }),
  });
}

export function useDeleteLandingProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('landing_product_categories' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-product-categories'] }),
  });
}

export function useUpdateLandingProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; image_url?: string | null }) => {
      const { data, error } = await supabase
        .from('landing_product_categories' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landing-product-categories'] });
      qc.invalidateQueries({ queryKey: ['public-landing-products'] });
    },
  });
}

export function useLandingProducts() {
  return useQuery({
    queryKey: ['landing-products'],
    queryFn: async () => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('landing_products' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as LandingProduct[];
    },
  });
}

export function useCreateLandingProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: Partial<LandingProduct>) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      const { data, error } = await supabase
        .from('landing_products' as any)
        .insert([{ ...product, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-products'] }),
  });
}

export function useUpdateLandingProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LandingProduct> & { id: string }) => {
      const { data, error } = await supabase
        .from('landing_products' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-products'] }),
  });
}

export function useDeleteLandingProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('landing_products' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-products'] }),
  });
}

// Public hooks
export function usePublicLandingProducts(tenantId: string | null) {
  return useQuery({
    queryKey: ['public-landing-products', tenantId],
    queryFn: async () => {
      if (!tenantId) return { categories: [], products: [] };
      const [catRes, prodRes] = await Promise.all([
        supabase.from('landing_product_categories' as any).select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('landing_products' as any).select('*').eq('tenant_id', tenantId).eq('is_active', true).order('display_order'),
      ]);
      return {
        categories: (catRes.data || []) as unknown as LandingProductCategory[],
        products: (prodRes.data || []) as unknown as LandingProduct[],
      };
    },
    enabled: !!tenantId,
  });
}

// Upload product image
export async function uploadLandingProductImage(file: File, tenantId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${tenantId}/products/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('landing-assets')
    .upload(fileName, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data: publicUrl } = supabase.storage.from('landing-assets').getPublicUrl(data.path);
  return publicUrl.publicUrl;
}
