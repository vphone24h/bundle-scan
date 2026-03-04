import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// ─── Types ───────────────────────────────────────────────────
export interface SocialProfile {
  user_id: string;
  zalo_number: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  bio: string | null;
  store_address: string | null;
  is_verified: boolean;
  verified_until: string | null;
  show_zalo_button: boolean;
  show_facebook_button: boolean;
  follower_count: number;
  following_count: number;
  // joined from profiles
  display_name?: string;
  avatar_url?: string | null;
  phone?: string | null;
}

export interface SocialPost {
  id: string;
  user_id: string;
  content: string;
  image_urls: string[];
  like_count: number;
  comment_count: number;
  message_click_count: number;
  engagement_score: number;
  created_at: string;
  // joined
  display_name?: string;
  avatar_url?: string | null;
  is_verified?: boolean;
  is_liked?: boolean;
  is_following?: boolean;
  show_zalo_button?: boolean;
  show_facebook_button?: boolean;
  zalo_number?: string | null;
  facebook_url?: string | null;
}

export interface SocialComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  display_name?: string;
  avatar_url?: string | null;
  is_verified?: boolean;
}

export interface SocialNotification {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor_name?: string;
  actor_avatar?: string | null;
}

// ─── Profile ─────────────────────────────────────────────────
export function useSocialProfile(userId?: string) {
  const { user } = useAuth();
  const targetId = userId || user?.id;

  return useQuery({
    queryKey: ['social-profile', targetId],
    queryFn: async () => {
      if (!targetId) return null;

      const [{ data: sp }, { data: profile }, { data: verifiedIds }] = await Promise.all([
        supabase.from('social_profiles').select('*').eq('user_id', targetId).maybeSingle(),
        supabase.from('profiles').select('display_name, avatar_url, phone').eq('user_id', targetId).maybeSingle(),
        supabase.rpc('get_verified_user_ids', { p_user_ids: [targetId] }),
      ]);

      if (!sp && !profile) return null;

      const isVerified = (verifiedIds || []).includes(targetId);

      return {
        user_id: targetId,
        zalo_number: sp?.zalo_number || null,
        facebook_url: sp?.facebook_url || null,
        tiktok_url: sp?.tiktok_url || null,
        bio: sp?.bio || null,
        store_address: sp?.store_address || null,
        is_verified: isVerified,
        verified_until: sp?.verified_until || null,
        show_zalo_button: sp?.show_zalo_button ?? true,
        show_facebook_button: sp?.show_facebook_button ?? true,
        follower_count: sp?.follower_count || 0,
        following_count: sp?.following_count || 0,
        display_name: profile?.display_name || 'Người dùng',
        avatar_url: profile?.avatar_url,
        phone: profile?.phone,
      } as SocialProfile;
    },
    enabled: !!targetId,
  });
}

export function useUpsertSocialProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<SocialProfile>) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('social_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('social_profiles')
          .update(updates as any)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('social_profiles')
          .insert({ user_id: user.id, ...updates } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-profile', user?.id] });
    },
  });
}

// ─── Posts (Feed) ────────────────────────────────────────────
export function useSocialFeed(filterUserId?: string) {
  const { user } = useAuth();
  const PAGE_SIZE = 20;

  return useInfiniteQuery({
    queryKey: ['social-feed', filterUserId],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('social_posts')
        .select('*');

      if (filterUserId) {
        // Profile view: newest first
        query = query.eq('user_id', filterUserId)
          .order('created_at', { ascending: false });
      } else {
        // Feed view: engagement + recency blend
        query = query
          .order('engagement_score', { ascending: false })
          .order('created_at', { ascending: false });
      }

      query = query.range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      const { data: posts, error } = await query;
      if (error) throw error;
      if (!posts?.length) return { posts: [], nextPage: undefined };

      // Get unique user ids
      const userIds = [...new Set(posts.map(p => p.user_id))];

      // Fetch profiles + social profiles + tenant subscription status
      const [{ data: profiles }, { data: socialProfiles }, { data: myLikes }, { data: myFollows }, { data: platformUsers }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds),
        supabase.from('social_profiles').select('user_id, is_verified, show_zalo_button, show_facebook_button, zalo_number, facebook_url').in('user_id', userIds),
        user?.id
          ? supabase.from('social_likes').select('post_id').eq('user_id', user.id).in('post_id', posts.map(p => p.id))
          : { data: [] },
        user?.id
          ? supabase.from('social_follows').select('following_id').eq('follower_id', user.id).in('following_id', userIds)
          : { data: [] },
        supabase.from('platform_users').select('user_id, tenant_id').in('user_id', userIds),
      ]);

      // Check tenant subscriptions for verified badge
      const tenantIds = [...new Set((platformUsers || []).map(pu => pu.tenant_id).filter(Boolean))];
      let subscribedTenants = new Set<string>();
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, subscription_plan, subscription_end_date')
          .in('id', tenantIds);
        (tenants || []).forEach(t => {
          if (t.subscription_plan === 'lifetime') {
            subscribedTenants.add(t.id);
          } else if (t.subscription_plan && t.subscription_end_date && new Date(t.subscription_end_date) > new Date()) {
            subscribedTenants.add(t.id);
          }
        });
      }
      const userTenantMap = new Map((platformUsers || []).map(pu => [pu.user_id, pu.tenant_id]));

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const spMap = new Map((socialProfiles || []).map(sp => [sp.user_id, sp]));
      const likedSet = new Set((myLikes || []).map(l => l.post_id));
      const followSet = new Set((myFollows || []).map(f => f.following_id));

      const enriched: SocialPost[] = posts.map(post => {
        const prof = profileMap.get(post.user_id);
        const sp = spMap.get(post.user_id);
        const tenantId = userTenantMap.get(post.user_id);
        const hasSubscription = tenantId ? subscribedTenants.has(tenantId) : false;
        return {
          ...post,
          image_urls: post.image_urls || [],
          display_name: prof?.display_name || 'Người dùng',
          avatar_url: prof?.avatar_url,
          is_verified: sp?.is_verified || hasSubscription,
          is_liked: likedSet.has(post.id),
          is_following: followSet.has(post.user_id),
          show_zalo_button: sp?.show_zalo_button ?? true,
          show_facebook_button: sp?.show_facebook_button ?? true,
          zalo_number: sp?.zalo_number,
          facebook_url: sp?.facebook_url,
        };
      });

      return {
        posts: enriched,
        nextPage: posts.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ content, imageUrls }: { content: string; imageUrls?: string[] }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('social_posts').insert({
        user_id: user.id,
        content,
        image_urls: imageUrls || [],
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('social_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content, imageUrls }: { postId: string; content: string; imageUrls: string[] }) => {
      const { error } = await supabase.from('social_posts').update({
        content,
        image_urls: imageUrls,
      } as any).eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
  });
}

// ─── Likes ───────────────────────────────────────────────────
export function useToggleLike() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (isLiked) {
        await supabase.from('social_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('social_likes').insert({ post_id: postId, user_id: user.id } as any);
        // Create notification for post owner
        const { data: post } = await supabase.from('social_posts').select('user_id').eq('id', postId).single();
        if (post && post.user_id !== user.id) {
          await supabase.from('social_notifications').insert({
            user_id: post.user_id,
            actor_id: user.id,
            type: 'like',
            post_id: postId,
          } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
  });
}

// ─── Post Likers ─────────────────────────────────────────────
export function usePostLikers(postId: string | null) {
  return useQuery({
    queryKey: ['social-likers', postId],
    queryFn: async () => {
      if (!postId) return [];
      const { data: likes } = await supabase
        .from('social_likes')
        .select('user_id, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });
      if (!likes?.length) return [];
      const userIds = likes.map(l => l.user_id);
      const [{ data: profiles }, { data: socialProfiles }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds),
        supabase.from('social_profiles').select('user_id, is_verified').in('user_id', userIds),
      ]);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const spMap = new Map((socialProfiles || []).map(p => [p.user_id, p]));
      return likes.map(l => ({
        user_id: l.user_id,
        display_name: profileMap.get(l.user_id)?.display_name || 'Người dùng',
        avatar_url: profileMap.get(l.user_id)?.avatar_url,
        is_verified: spMap.get(l.user_id)?.is_verified || false,
      }));
    },
    enabled: !!postId,
  });
}

// ─── Comments ────────────────────────────────────────────────
export function usePostComments(postId: string | null) {
  return useQuery({
    queryKey: ['social-comments', postId],
    queryFn: async () => {
      if (!postId) return [];
      const { data: comments, error } = await supabase
        .from('social_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((comments || []).map(c => c.user_id))];
      const [{ data: profiles }, { data: socialProfiles }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds),
        supabase.from('social_profiles').select('user_id, is_verified').in('user_id', userIds),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const spMap = new Map((socialProfiles || []).map(sp => [sp.user_id, sp]));

      return (comments || []).map(c => ({
        ...c,
        display_name: profileMap.get(c.user_id)?.display_name || 'Người dùng',
        avatar_url: profileMap.get(c.user_id)?.avatar_url,
        is_verified: spMap.get(c.user_id)?.is_verified || false,
      })) as SocialComment[];
    },
    enabled: !!postId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, content, parentId }: { postId: string; content: string; parentId?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('social_comments').insert({
        post_id: postId,
        user_id: user.id,
        content,
        parent_id: parentId || null,
      } as any);
      if (error) throw error;

      // Notification
      const { data: post } = await supabase.from('social_posts').select('user_id').eq('id', postId).single();
      if (post && post.user_id !== user.id) {
        await supabase.from('social_notifications').insert({
          user_id: post.user_id,
          actor_id: user.id,
          type: parentId ? 'reply' : 'comment',
          post_id: postId,
        } as any);
      }

      // If replying, also notify the parent comment author
      if (parentId) {
        const { data: parentComment } = await supabase.from('social_comments').select('user_id').eq('id', parentId).single();
        if (parentComment && parentComment.user_id !== user.id && parentComment.user_id !== post?.user_id) {
          await supabase.from('social_notifications').insert({
            user_id: parentComment.user_id,
            actor_id: user.id,
            type: 'reply',
            post_id: postId,
          } as any);
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['social-comments', vars.postId] });
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
  });
}

// ─── Follow ──────────────────────────────────────────────────
export function useToggleFollow() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ targetUserId, isFollowing }: { targetUserId: string; isFollowing: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (isFollowing) {
        await supabase.from('social_follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId);
      } else {
        await supabase.from('social_follows').insert({ follower_id: user.id, following_id: targetUserId } as any);
        // Notification
        await supabase.from('social_notifications').insert({
          user_id: targetUserId,
          actor_id: user.id,
          type: 'follow',
        } as any);
      }
    },
    onSuccess: (_, { targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['social-profile'] });
      queryClient.invalidateQueries({ queryKey: ['social-following'] });
    },
  });
}

export function useIsFollowing(targetUserId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['social-following', user?.id, targetUserId],
    queryFn: async () => {
      if (!user?.id || !targetUserId) return false;
      const { data } = await supabase
        .from('social_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id && !!targetUserId && user.id !== targetUserId,
  });
}

// ─── Search Users ────────────────────────────────────────────
export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['social-search-users', query],
    queryFn: async () => {
      if (!query.trim() || query.trim().length < 2) return [];
      const searchTerm = `%${query.trim()}%`;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, phone')
        .or(`display_name.ilike.${searchTerm},phone.ilike.${searchTerm}`)
        .limit(10);
      if (error) throw error;

      const userIds = (data || []).map(p => p.user_id);
      if (!userIds.length) return [];
      const { data: socialProfiles } = await supabase
        .from('social_profiles')
        .select('user_id, is_verified')
        .in('user_id', userIds);
      const verifiedMap = new Map((socialProfiles || []).map(sp => [sp.user_id, sp.is_verified]));

      return (data || []).map(p => ({
        ...p,
        is_verified: verifiedMap.get(p.user_id) || false,
      }));
    },
    enabled: query.trim().length >= 2,
    staleTime: 10000,
  });
}

// ─── Notifications ───────────────────────────────────────────
export function useSocialNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['social-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: notifs, error } = await supabase
        .from('social_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const actorIds = [...new Set((notifs || []).map(n => n.actor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', actorIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      return (notifs || []).map(n => ({
        ...n,
        actor_name: profileMap.get(n.actor_id)?.display_name || 'Người dùng',
        actor_avatar: profileMap.get(n.actor_id)?.avatar_url,
      })) as SocialNotification[];
    },
    enabled: !!user?.id,
  });
}

export function useUnreadSocialNotifCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['social-notif-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('social_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await supabase
        .from('social_notifications')
        .update({ is_read: true } as any)
        .eq('user_id', user.id)
        .eq('is_read', false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-notif-count'] });
      queryClient.invalidateQueries({ queryKey: ['social-notifications'] });
    },
  });
}

// ─── Message click tracking ─────────────────────────────────
export function useTrackMessageClick() {
  return useMutation({
    mutationFn: async (postId: string) => {
      // Increment message_click_count
      const { data: post } = await supabase.from('social_posts').select('message_click_count, like_count, comment_count').eq('id', postId).single();
      if (post) {
        const newCount = (post.message_click_count || 0) + 1;
        await supabase.from('social_posts').update({
          message_click_count: newCount,
          engagement_score: (post.like_count || 0) * 2 + (post.comment_count || 0) * 3 + newCount,
        } as any).eq('id', postId);
      }
    },
  });
}
