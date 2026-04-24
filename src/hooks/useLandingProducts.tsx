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
  badge_style?: 'simple' | 'luxury' | string;
  // Promotional fields
  student_discount_label?: string | null;
  student_discount_text?: string | null;
  installment_down_payment?: number | null;
  // SEO
  seo_description?: string | null;
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
  display_order, badges, badge_style, created_at, updated_at,
  student_discount_label, student_discount_text, installment_down_payment
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
  group_id?: string | null;
  image_url?: string | null;
  allow_quantity?: boolean;
}

export interface LandingPackageGroup {
  id: string;
  product_id: string;
  tenant_id: string;
  name: string;
  selection_mode: 'single' | 'multiple';
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PackageGroupWithItems {
  id: string; // group id (or '_legacy_' for legacy ungrouped)
  name: string;
  selection_mode: 'single' | 'multiple';
  display_order: number;
  items: LandingProductPackage[];
  isLegacy?: boolean;
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

// ===== Package Groups (multi-group support) =====

/** Admin: get groups + items grouped together. */
export function useProductPackageGroups(productId: string | null) {
  return useQuery({
    queryKey: ['landing-package-groups', productId],
    queryFn: async (): Promise<PackageGroupWithItems[]> => {
      if (!productId) return [];
      const [groupsRes, itemsRes] = await Promise.all([
        supabase
          .from('landing_product_package_groups' as any)
          .select('*')
          .eq('product_id', productId)
          .order('display_order', { ascending: true }),
        supabase
          .from('landing_product_packages' as any)
          .select('*')
          .eq('product_id', productId)
          .order('display_order', { ascending: true }),
      ]);
      if (groupsRes.error) throw groupsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      const groups = (groupsRes.data as any[]) || [];
      const items = (itemsRes.data as any[]) || [];
      const grouped: PackageGroupWithItems[] = groups.map(g => ({
        id: g.id,
        name: g.name,
        selection_mode: g.selection_mode,
        display_order: g.display_order,
        items: items.filter(it => it.group_id === g.id) as LandingProductPackage[],
      }));
      const orphans = items.filter(it => !it.group_id) as LandingProductPackage[];
      if (orphans.length > 0) {
        // Wrap legacy un-grouped packages so admin can migrate / continue editing
        grouped.unshift({
          id: '_legacy_',
          name: 'Gói dịch vụ kèm theo',
          selection_mode: 'multiple',
          display_order: -1,
          items: orphans,
          isLegacy: true,
        });
      }
      return grouped;
    },
    enabled: !!productId,
  });
}

/** Public: same as above but only active items. */
export function usePublicProductPackageGroups(productId: string | null) {
  return useQuery({
    queryKey: ['public-package-groups', productId],
    queryFn: async (): Promise<PackageGroupWithItems[]> => {
      if (!productId) return [];
      const [groupsRes, itemsRes] = await Promise.all([
        supabase
          .from('landing_product_package_groups' as any)
          .select('*')
          .eq('product_id', productId)
          .order('display_order', { ascending: true }),
        supabase
          .from('landing_product_packages' as any)
          .select('*')
          .eq('product_id', productId)
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
      ]);
      if (groupsRes.error) throw groupsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      const groups = (groupsRes.data as any[]) || [];
      const items = (itemsRes.data as any[]) || [];
      const grouped: PackageGroupWithItems[] = groups.map(g => ({
        id: g.id,
        name: g.name,
        selection_mode: g.selection_mode,
        display_order: g.display_order,
        items: items.filter(it => it.group_id === g.id) as LandingProductPackage[],
      })).filter(g => g.items.length > 0);
      const orphans = items.filter(it => !it.group_id) as LandingProductPackage[];
      if (orphans.length > 0) {
        grouped.unshift({
          id: '_legacy_',
          name: 'Gói dịch vụ kèm theo',
          selection_mode: 'multiple',
          display_order: -1,
          items: orphans,
          isLegacy: true,
        });
      }
      return grouped;
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });
}

/** Save groups + their items in a single mutation. Replaces all existing data. */
export function useSavePackageGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, tenantId, groups }: {
      productId: string;
      tenantId: string;
      groups: Array<{
        name: string;
        selection_mode: 'single' | 'multiple';
        items: Array<{
          name: string;
          price: number;
          description?: string | null;
          image_url?: string | null;
          is_default?: boolean;
          is_active?: boolean;
          allow_quantity?: boolean;
        }>;
      }>;
    }) => {
      // Wipe everything for this product (cascade-friendly: delete items first)
      await supabase.from('landing_product_packages' as any).delete().eq('product_id', productId);
      await supabase.from('landing_product_package_groups' as any).delete().eq('product_id', productId);

      const cleanedGroups = groups
        .map(g => ({ ...g, items: g.items.filter(it => it.name.trim()) }))
        .filter(g => g.name.trim() && g.items.length > 0);

      if (cleanedGroups.length === 0) return [];

      // Insert groups
      const groupRows = cleanedGroups.map((g, i) => ({
        product_id: productId,
        tenant_id: tenantId,
        name: g.name.trim(),
        selection_mode: g.selection_mode,
        display_order: i,
      }));
      const { data: insertedGroups, error: gErr } = await supabase
        .from('landing_product_package_groups' as any)
        .insert(groupRows)
        .select();
      if (gErr) throw gErr;

      // Insert items linked to corresponding groups
      const itemRows: any[] = [];
      cleanedGroups.forEach((g, gi) => {
        const grp = (insertedGroups as any[])[gi];
        g.items.forEach((it, ii) => {
          itemRows.push({
            product_id: productId,
            tenant_id: tenantId,
            group_id: grp.id,
            name: it.name.trim(),
            price: it.price || 0,
            description: it.description?.trim() || null,
            image_url: it.image_url?.trim() || null,
            is_default: !!it.is_default,
            is_active: it.is_active !== false,
            allow_quantity: !!it.allow_quantity,
            display_order: ii,
          });
        });
      });
      if (itemRows.length > 0) {
        const { error: iErr } = await supabase
          .from('landing_product_packages' as any)
          .insert(itemRows);
        if (iErr) throw iErr;
      }
      return insertedGroups;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['landing-package-groups', vars.productId] });
      qc.invalidateQueries({ queryKey: ['public-package-groups', vars.productId] });
      qc.invalidateQueries({ queryKey: ['landing-product-packages', vars.productId] });
      qc.invalidateQueries({ queryKey: ['public-product-packages', vars.productId] });
    },
  });
}
