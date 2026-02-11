import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LandingArticleCategory {
  id: string;
  tenant_id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface LandingArticle {
  id: string;
  tenant_id: string;
  category_id: string | null;
  title: string;
  slug: string | null;
  summary: string | null;
  content: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Admin hooks
export function useLandingArticleCategories() {
  return useQuery({
    queryKey: ['landing-article-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_article_categories' as any)
        .select('*')
        .order('display_order')
        .order('name');
      if (error) throw error;
      return data as unknown as LandingArticleCategory[];
    },
  });
}

export function useCreateLandingArticleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { name: string }) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      const { data, error } = await supabase
        .from('landing_article_categories' as any)
        .insert([{ ...cat, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-article-categories'] }),
  });
}

export function useDeleteLandingArticleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('landing_article_categories' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-article-categories'] }),
  });
}

export function useLandingArticles() {
  return useQuery({
    queryKey: ['landing-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_articles' as any)
        .select('*')
        .order('display_order')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as LandingArticle[];
    },
  });
}

export function useCreateLandingArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (article: Partial<LandingArticle>) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      const { data, error } = await supabase
        .from('landing_articles' as any)
        .insert([{ ...article, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-articles'] }),
  });
}

export function useUpdateLandingArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LandingArticle> & { id: string }) => {
      const { data, error } = await supabase
        .from('landing_articles' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-articles'] }),
  });
}

export function useDeleteLandingArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('landing_articles' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landing-articles'] }),
  });
}

// Public hooks
export function usePublicLandingArticles(tenantId: string | null) {
  return useQuery({
    queryKey: ['public-landing-articles', tenantId],
    queryFn: async () => {
      if (!tenantId) return { categories: [], articles: [] };
      const [catRes, artRes] = await Promise.all([
        supabase.from('landing_article_categories' as any).select('*').eq('tenant_id', tenantId).order('display_order'),
        supabase.from('landing_articles' as any).select('*').eq('tenant_id', tenantId).eq('is_published', true).order('display_order'),
      ]);
      return {
        categories: (catRes.data || []) as unknown as LandingArticleCategory[],
        articles: (artRes.data || []) as unknown as LandingArticle[],
      };
    },
    enabled: !!tenantId,
  });
}

export async function uploadLandingArticleImage(file: File, tenantId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${tenantId}/articles/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('landing-assets')
    .upload(fileName, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data: publicUrl } = supabase.storage.from('landing-assets').getPublicUrl(data.path);
  return publicUrl.publicUrl;
}
