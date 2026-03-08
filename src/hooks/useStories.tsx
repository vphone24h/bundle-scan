import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Story {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  view_count: number;
  created_at: string;
  expires_at: string;
  // enriched
  display_name?: string;
  avatar_url?: string | null;
  is_verified?: boolean;
  is_viewed?: boolean;
}

export interface StoryGroup {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  stories: Story[];
  has_unviewed: boolean;
}

export function useStories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['stories', user?.id],
    queryFn: async () => {
      const { data: stories, error } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!stories?.length) return [];

      const userIds = [...new Set(stories.map(s => s.user_id))];
      const [{ data: profiles }, { data: verifiedIds }, { data: myViews }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds),
        supabase.rpc('get_verified_user_ids', { p_user_ids: userIds }),
        user?.id
          ? supabase.from('story_views').select('story_id').eq('viewer_id', user.id).in('story_id', stories.map(s => s.id))
          : { data: [] },
      ]);

      const pm = new Map((profiles || []).map(p => [p.user_id, p]));
      const vs = new Set<string>(verifiedIds || []);
      const viewedSet = new Set((myViews || []).map(v => v.story_id));

      // Group by user
      const groupMap = new Map<string, StoryGroup>();
      
      for (const s of stories) {
        const prof = pm.get(s.user_id);
        const enrichedStory: Story = {
          ...s,
          display_name: prof?.display_name || 'Người dùng',
          avatar_url: prof?.avatar_url,
          is_verified: vs.has(s.user_id),
          is_viewed: viewedSet.has(s.id),
        };

        if (!groupMap.has(s.user_id)) {
          groupMap.set(s.user_id, {
            user_id: s.user_id,
            display_name: prof?.display_name || 'Người dùng',
            avatar_url: prof?.avatar_url || null,
            is_verified: vs.has(s.user_id),
            stories: [],
            has_unviewed: false,
          });
        }
        const group = groupMap.get(s.user_id)!;
        group.stories.push(enrichedStory);
        if (!enrichedStory.is_viewed) group.has_unviewed = true;
      }

      // Sort: own stories first, then unviewed, then viewed
      const groups = Array.from(groupMap.values());
      groups.sort((a, b) => {
        if (a.user_id === user?.id) return -1;
        if (b.user_id === user?.id) return 1;
        if (a.has_unviewed !== b.has_unviewed) return a.has_unviewed ? -1 : 1;
        return 0;
      });

      return groups;
    },
    refetchInterval: 60000,
  });
}

export function useCreateStory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ mediaUrl, content }: { mediaUrl?: string; content?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: mediaUrl || null,
        content: content || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

export function useViewStory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!user?.id) return;
      await supabase.from('story_views').insert({
        story_id: storyId,
        viewer_id: user.id,
      } as any).select().maybeSingle(); // ignore duplicate error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}
