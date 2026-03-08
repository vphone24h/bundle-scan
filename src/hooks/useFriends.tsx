import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
  receiver_name?: string;
  receiver_avatar?: string | null;
}

export interface Friend {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
}

// ─── Friend Requests (received) ─────────────────────────────
export function usePendingFriendRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['friend-requests-pending', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!data?.length) return [];
      const senderIds = data.map(r => r.sender_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', senderIds);
      const pm = new Map((profiles || []).map(p => [p.user_id, p]));

      return data.map(r => ({
        ...r,
        sender_name: pm.get(r.sender_id)?.display_name || 'Người dùng',
        sender_avatar: pm.get(r.sender_id)?.avatar_url,
      })) as FriendRequest[];
    },
    enabled: !!user?.id,
  });
}

// ─── Friends list ───────────────────────────────────────────
export function useFriendsList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['friends-list', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Friends = accepted friend requests (either direction)
      const { data } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (!data?.length) return [];
      const friendIds = data.map(r => r.sender_id === user.id ? r.receiver_id : r.sender_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', friendIds);

      const { data: verifiedIds } = await supabase.rpc('get_verified_user_ids', { p_user_ids: friendIds });
      const verifiedSet = new Set<string>(verifiedIds || []);

      return (profiles || []).map(p => ({
        user_id: p.user_id,
        display_name: p.display_name || 'Người dùng',
        avatar_url: p.avatar_url,
        is_verified: verifiedSet.has(p.user_id),
      })) as Friend[];
    },
    enabled: !!user?.id,
  });
}

// ─── Send friend request ────────────────────────────────────
export function useSendFriendRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (receiverId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('friend_requests').insert({
        sender_id: user.id,
        receiver_id: receiverId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
      qc.invalidateQueries({ queryKey: ['friends-list'] });
    },
  });
}

// ─── Accept/Reject friend request ───────────────────────────
export function useRespondFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, accept }: { requestId: string; accept: boolean }) => {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: accept ? 'accepted' : 'rejected', updated_at: new Date().toISOString() } as any)
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-requests-pending'] });
      qc.invalidateQueries({ queryKey: ['friends-list'] });
    },
  });
}

// ─── Friendship status check ────────────────────────────────
export function useFriendshipStatus(otherUserId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['friendship-status', user?.id, otherUserId],
    queryFn: async () => {
      if (!user?.id || !otherUserId) return null;
      const { data } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!otherUserId && user.id !== otherUserId,
  });
}

// ─── Pending count ──────────────────────────────────────────
export function usePendingFriendCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['friend-requests-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('friend_requests')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'pending');
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
}
