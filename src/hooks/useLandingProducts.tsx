import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LandingProductCategory {
  id: string;
  tenant_id: string;
  name: string;
  display_order: number;
  image_url: string | null;
  parent_id: string | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  children?: LandingProductCategory[];
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
  is_sold_out?: boolean;
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
  is_sold_out: boolean;
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
  package_selection_mode: string;
  badges: string[];
  // Promotional fields
  student_discount_label?: string | null;
  student_discount_text?: string | null;
  installment_down_payment?: number | null;
  created_at: string;
  updated_at: string;
}

// Admin hooks - accept tenantId to avoid redundant RPC calls
export function useLandingProductCategories(tenantId?: string | null) {
  return useQuery({
    queryKey: ['landing-product-categories', tenantId ?? '_auto_'],
    queryFn: async () => {
      let tid = tenantId;
      if (!tid) {
        const { data } = await supabase.rpc('get_user_tenant_id_secure');
        tid = data;
      }
      if (!tid) return [];
      const { data, error } = await supabase
        .from('landing_product_categories' as any)
        .select('*')
        .eq('tenant_id', tid)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as LandingProductCategory[];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export function useCreateLandingProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { name: string; image_url?: string; parent_id?: string | null }) => {
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
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; image_url?: string | null; parent_id?: string | null; is_hidden?: boolean }) => {
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

export function useReorderLandingProductCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      const { error } = await supabase.rpc('batch_update_display_order' as any, {
        _table_name: 'landing_product_categories',
        _items: items.map(i => ({ id: i.id, display_order: i.display_order })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landing-product-categories'] });
      qc.invalidateQueries({ queryKey: ['public-landing-products'] });
    },
  });
}

export function useReorderLandingProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      const { error } = await supabase.rpc('batch_update_display_order' as any, {
        _table_name: 'landing_products',
        _items: items.map(i => ({ id: i.id, display_order: i.display_order })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landing-products'] });
      qc.invalidateQueries({ queryKey: ['public-landing-products'] });
    },
  });
}

const LANDING_PRODUCT_LIST_SELECT = `
  id, tenant_id, category_id, name, price, sale_price,
  image_url, images, is_featured, is_active, is_sold_out,
  display_order, created_at, updated_at
`;

export function useLandingProducts(tenantId?: string | null) {
  return useQuery({
    queryKey: ['landing-products', tenantId ?? '_auto_'],
    queryFn: async () => {
      let tid = tenantId;
      if (!tid) {
        const { data } = await supabase.rpc('get_user_tenant_id_secure');
        tid = data;
      }
      if (!tid) return [];
      const { data, error } = await supabase
        .from('landing_products' as any)
        .select(LANDING_PRODUCT_LIST_SELECT)
        .eq('tenant_id', tid)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as LandingProduct[];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export async function getLandingProductById(id: string): Promise<LandingProduct | null> {
  const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
  if (!tenantId) return null;

  const { data, error } = await supabase
    .from('landing_products' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as LandingProduct | null) ?? null;
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
interface PublicLandingProductsOptions {
  enabled?: boolean;
}

export function usePublicLandingProducts(
  tenantId: string | null,
  options: PublicLandingProductsOptions = {}
) {
  const queryEnabled = options.enabled ?? true;

  // Use prefetched data as initial data so React Query treats it as fresh (no refetch on mount)
  const prefetch = typeof window !== 'undefined' ? (window as any).__STORE_PREFETCH__ : null;
  const prefetchedData = prefetch?.data && prefetch.tenantId === tenantId
    ? {
        categories: (prefetch.data.productCategories || []) as unknown as LandingProductCategory[],
        products: (prefetch.data.products || []) as unknown as LandingProduct[],
      }
    : undefined;

  return useQuery({
    queryKey: ['public-landing-products', tenantId],
    queryFn: async () => {
      if (!tenantId) return { categories: [], products: [] };
      const [catRes, prodRes] = await Promise.all([
        supabase.from('landing_product_categories' as any).select('*').eq('tenant_id', tenantId).eq('is_hidden', false).order('display_order', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('landing_products' as any).select('*').eq('tenant_id', tenantId).eq('is_active', true).order('display_order', { ascending: true }).order('created_at', { ascending: false }),
      ]);
      return {
        categories: (catRes.data || []) as unknown as LandingProductCategory[],
        products: (prodRes.data || []) as unknown as LandingProduct[],
      };
    },
    enabled: queryEnabled && !!tenantId,
    placeholderData: prefetchedData,
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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

// ===== SERVICE PACKAGES =====

export interface LandingProductPackage {
  id: string;
  product_id: string;
  tenant_id: string;
  name: string;
  price: number;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useProductPackages(productId: string | null) {
  return useQuery({
    queryKey: ['landing-product-packages', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('landing_product_packages' as any)
        .select('*')
        .eq('product_id', productId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as unknown as LandingProductPackage[];
    },
    enabled: !!productId,
  });
}

export function usePublicProductPackages(productId: string | null) {
  return useQuery({
    queryKey: ['public-product-packages', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('landing_product_packages' as any)
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as unknown as LandingProductPackage[];
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveProductPackages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, tenantId, packages }: {
      productId: string;
      tenantId: string;
      packages: Array<{ id?: string; name: string; price: number; description?: string; is_default?: boolean; is_active?: boolean; display_order?: number }>;
    }) => {
      // Delete all existing packages for this product
      await supabase
        .from('landing_product_packages' as any)
        .delete()
        .eq('product_id', productId);

      if (packages.length === 0) return [];

      const rows = packages.map((pkg, i) => ({
        product_id: productId,
        tenant_id: tenantId,
        name: pkg.name,
        price: pkg.price,
        description: pkg.description || null,
        is_default: pkg.is_default || false,
        is_active: pkg.is_active !== false,
        display_order: pkg.display_order ?? i,
      }));

      const { data, error } = await supabase
        .from('landing_product_packages' as any)
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['landing-product-packages', vars.productId] });
      qc.invalidateQueries({ queryKey: ['public-product-packages', vars.productId] });
    },
  });
}
