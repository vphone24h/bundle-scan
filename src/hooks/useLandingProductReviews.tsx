import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LandingProductReview {
  id: string;
  tenant_id: string;
  product_id: string;
  customer_name: string;
  customer_phone: string;
  content: string;
  rating: number;
  is_visible: boolean;
  is_fake?: boolean;
  created_at: string;
  updated_at: string;
}

/** Public: lấy review hiển thị của 1 sản phẩm */
export function usePublicProductReviews(productId: string | null) {
  return useQuery({
    queryKey: ['public-landing-reviews', productId],
    queryFn: async () => {
      if (!productId) return [] as LandingProductReview[];
      const { data, error } = await supabase
        .from('landing_product_reviews' as any)
        .select('*')
        .eq('product_id', productId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LandingProductReview[];
    },
    enabled: !!productId,
    staleTime: 1000 * 30,
  });
}

/** Public: gửi review */
export function useCreateProductReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tenant_id: string;
      product_id: string;
      customer_name: string;
      customer_phone: string;
      content: string;
      rating: number;
    }) => {
      const { data, error } = await supabase
        .from('landing_product_reviews' as any)
        .insert([{ ...input, is_visible: true }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['public-landing-reviews', vars.product_id] });
      qc.invalidateQueries({ queryKey: ['admin-landing-reviews'] });
    },
  });
}

/** Admin: tất cả review của tenant (kèm tên sản phẩm) */
export function useAdminProductReviews(tenantId?: string | null) {
  return useQuery({
    queryKey: ['admin-landing-reviews', tenantId ?? '_auto_'],
    queryFn: async () => {
      let tid = tenantId;
      if (!tid) {
        const { data } = await supabase.rpc('get_user_tenant_id_secure');
        tid = data;
      }
      if (!tid) return [];
      const { data, error } = await supabase
        .from('landing_product_reviews' as any)
        .select('*, landing_products!inner(name)')
        .eq('tenant_id', tid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 1000 * 60,
  });
}

export function useUpdateProductReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<LandingProductReview>) => {
      const { data, error } = await supabase
        .from('landing_product_reviews' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-landing-reviews'] });
      qc.invalidateQueries({ queryKey: ['public-landing-reviews'] });
    },
  });
}

export function useDeleteProductReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('landing_product_reviews' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-landing-reviews'] });
      qc.invalidateQueries({ queryKey: ['public-landing-reviews'] });
    },
  });
}

/**
 * Public: aggregate rating stats (avg + count) cho tất cả sản phẩm của 1 tenant.
 * Fetch 1 lần rồi group ở client để tiết kiệm query trên grid sản phẩm.
 */
export function useTenantRatingStats(tenantId?: string | null) {
  return useQuery({
    queryKey: ['public-landing-rating-stats', tenantId],
    queryFn: async () => {
      const map: Record<string, { avg: number; count: number }> = {};
      if (!tenantId) return map;
      const { data, error } = await supabase
        .from('landing_product_reviews' as any)
        .select('product_id, rating')
        .eq('tenant_id', tenantId)
        .eq('is_visible', true);
      if (error) throw error;
      const acc: Record<string, { sum: number; count: number }> = {};
      (data || []).forEach((r: any) => {
        const pid = r.product_id as string;
        if (!acc[pid]) acc[pid] = { sum: 0, count: 0 };
        acc[pid].sum += Number(r.rating || 0);
        acc[pid].count += 1;
      });
      Object.entries(acc).forEach(([pid, v]) => {
        map[pid] = { avg: v.count ? v.sum / v.count : 0, count: v.count };
      });
      return map;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60,
  });
}

/**
 * Admin: thống kê đầy đủ review theo product (kể cả ẩn) cho tenant
 * - total, byStar {1..5}, fake, real
 */
export interface AdminProductReviewStats {
  total: number;
  byStar: Record<1 | 2 | 3 | 4 | 5, number>;
  fake: number;
  real: number;
}
export function useAdminTenantReviewStats(tenantId?: string | null) {
  return useQuery({
    queryKey: ['admin-landing-review-stats', tenantId],
    queryFn: async () => {
      const map: Record<string, AdminProductReviewStats> = {};
      if (!tenantId) return map;
      const { data, error } = await supabase
        .from('landing_product_reviews' as any)
        .select('product_id, rating, is_fake')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      (data || []).forEach((r: any) => {
        const pid = r.product_id as string;
        if (!map[pid]) {
          map[pid] = { total: 0, byStar: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, fake: 0, real: 0 };
        }
        map[pid].total += 1;
        const star = Math.max(1, Math.min(5, Number(r.rating || 0))) as 1 | 2 | 3 | 4 | 5;
        map[pid].byStar[star] += 1;
        if (r.is_fake) map[pid].fake += 1; else map[pid].real += 1;
      });
      return map;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 30,
  });
}