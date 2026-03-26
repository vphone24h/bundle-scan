import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback, useMemo } from 'react';

const STORAGE_KEY = 'vkho_read_articles';

function getReadArticleIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveReadArticleIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useUnreadArticleCount() {
  return useQuery({
    queryKey: ['unread-article-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_articles' as any)
        .select('id')
        .eq('is_published', true);
      if (error) throw error;
      const allIds = (data as any[]).map((a: any) => a.id);
      const readIds = getReadArticleIds();
      return allIds.filter((id: string) => !readIds.has(id)).length;
    },
    staleTime: 60_000,
  });
}

export function useUnreadArticleIds() {
  const { data: articles = [] } = useQuery({
    queryKey: ['platform-articles-published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_articles' as any)
        .select('id')
        .eq('is_published', true);
      if (error) throw error;
      return data as { id: string }[];
    },
  });

  const readIds = useMemo(() => getReadArticleIds(), []);
  const unreadIds = useMemo(
    () => new Set(articles.filter(a => !readIds.has(a.id)).map(a => a.id)),
    [articles, readIds]
  );

  return unreadIds;
}

export function markArticleAsRead(articleId: string) {
  const ids = getReadArticleIds();
  ids.add(articleId);
  saveReadArticleIds(ids);
}

export function markAllArticlesAsRead(articleIds: string[]) {
  const ids = getReadArticleIds();
  articleIds.forEach(id => ids.add(id));
  saveReadArticleIds(ids);
}