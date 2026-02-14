import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformArticleCategory {
  id: string;
  name: string;
  slug: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformArticle {
  id: string;
  category_id: string | null;
  title: string;
  slug: string | null;
  summary: string | null;
  banner_url: string | null;
  content: string | null;
  is_published: boolean;
  display_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function usePlatformArticleCategories() {
  return useQuery({
    queryKey: ['platform-article-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_article_categories' as any)
        .select('*')
        .order('display_order')
        .order('name');
      if (error) throw error;
      return data as unknown as PlatformArticleCategory[];
    },
  });
}

export function useCreatePlatformArticleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { name: string; slug?: string }) => {
      const { data, error } = await supabase
        .from('platform_article_categories' as any)
        .insert([cat])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-article-categories'] }),
  });
}

export function useUpdatePlatformArticleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; slug?: string; display_order?: number }) => {
      const { error } = await supabase
        .from('platform_article_categories' as any)
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-article-categories'] }),
  });
}

export function useDeletePlatformArticleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('platform_article_categories' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-article-categories'] }),
  });
}

export function usePlatformArticles() {
  return useQuery({
    queryKey: ['platform-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_articles' as any)
        .select('*')
        .order('display_order')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PlatformArticle[];
    },
  });
}

export function usePublishedPlatformArticles() {
  return useQuery({
    queryKey: ['platform-articles-published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_articles' as any)
        .select('*')
        .eq('is_published', true)
        .order('display_order')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PlatformArticle[];
    },
  });
}

export function useCreatePlatformArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (article: Partial<PlatformArticle>) => {
      const { data, error } = await supabase
        .from('platform_articles' as any)
        .insert([article])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-articles'] }),
  });
}

export function useUpdatePlatformArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlatformArticle> & { id: string }) => {
      const { error } = await supabase
        .from('platform_articles' as any)
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-articles'] });
      qc.invalidateQueries({ queryKey: ['platform-articles-published'] });
    },
  });
}

export function useDeletePlatformArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('platform_articles' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-articles'] });
      qc.invalidateQueries({ queryKey: ['platform-articles-published'] });
    },
  });
}

export async function uploadPlatformArticleBanner(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `platform-articles/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('tenant-assets')
    .upload(fileName, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data: publicUrl } = supabase.storage.from('tenant-assets').getPublicUrl(data.path);
  return publicUrl.publicUrl;
}
