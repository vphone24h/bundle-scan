import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useEffect } from 'react';

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
  // enriched
  other_user_name?: string;
  other_user_avatar?: string | null;
  other_user_id?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  metadata: any;
  created_at: string;
  // enriched
  sender_name?: string;
  sender_avatar?: string | null;
}

// ─── Conversations List ──────────────────────────────────────
export function useConversations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get conversations user is member of
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (!memberships?.length) return [];

      const convIds = memberships.map(m => m.conversation_id);
      const readMap = new Map(memberships.map(m => [m.conversation_id, m.last_read_at]));

      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('updated_at', { ascending: false });

      if (!convs?.length) return [];

      // Get all members for these conversations
      const { data: allMembers } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds);

      // Get other user ids for direct convos
      const otherUserIds = new Set<string>();
      (allMembers || []).forEach(m => {
        if (m.user_id !== user.id) otherUserIds.add(m.user_id);
      });

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', Array.from(otherUserIds));

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      // Get last message for each conversation
      const enriched: Conversation[] = [];

      for (const conv of convs) {
        const members = (allMembers || []).filter(m => m.conversation_id === conv.id);
        const otherMember = members.find(m => m.user_id !== user.id);
        const otherProfile = otherMember ? profileMap.get(otherMember.user_id) : null;

        // Get last message
        const { data: lastMsg } = await supabase
          .from('chat_messages')
          .select('content, created_at, message_type')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Count unread
        const lastRead = readMap.get(conv.id);
        let unreadCount = 0;
        if (lastRead) {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .gt('created_at', lastRead);
          unreadCount = count || 0;
        }

        let lastMessageText = lastMsg?.content || '';
        if (lastMsg?.message_type === 'image') lastMessageText = '📷 Hình ảnh';
        else if (lastMsg?.message_type === 'file') lastMessageText = '📎 Tệp đính kèm';
        else if (lastMsg?.message_type === 'voice') lastMessageText = '🎤 Tin nhắn thoại';

        enriched.push({
          ...conv,
          type: conv.type as 'direct' | 'group',
          other_user_name: otherProfile?.display_name || 'Người dùng',
          other_user_avatar: otherProfile?.avatar_url,
          other_user_id: otherMember?.user_id,
          last_message: lastMessageText,
          last_message_at: lastMsg?.created_at || conv.updated_at,
          unread_count: unreadCount,
        });
      }

      return enriched;
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });
}

// ─── Messages in a conversation ──────────────────────────────
export function useChatMessages(conversationId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      if (!messages?.length) return [];

      const userIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      return messages.map(m => ({
        ...m,
        sender_name: profileMap.get(m.sender_id)?.display_name || 'Người dùng',
        sender_avatar: profileMap.get(m.sender_id)?.avatar_url,
      })) as ChatMessage[];
    },
    enabled: !!conversationId,
  });
}

// ─── Realtime subscription for messages ──────────────────────
export function useChatRealtime(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}

// ─── Send message ────────────────────────────────────────────
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ conversationId, content, messageType = 'text', fileUrl, fileName, metadata }: {
      conversationId: string;
      content?: string;
      messageType?: string;
      fileUrl?: string;
      fileName?: string;
      metadata?: any;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content || null,
        message_type: messageType,
        file_url: fileUrl || null,
        file_name: fileName || null,
        metadata: metadata || {},
      } as any);
      if (error) throw error;

      // Update last_read_at
      await supabase.from('conversation_members')
        .update({ last_read_at: new Date().toISOString() } as any)
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// ─── Start conversation ──────────────────────────────────────
export function useStartConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
        p_user_id: user.id,
        p_other_user_id: otherUserId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// ─── Mark as read ────────────────────────────────────────────
export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id) return;
      await supabase.from('conversation_members')
        .update({ last_read_at: new Date().toISOString() } as any)
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// ─── Total unread messages count ─────────────────────────────
export function useUnreadChatCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['chat-unread-total', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);
      if (!memberships?.length) return 0;

      let total = 0;
      for (const m of memberships) {
        if (m.last_read_at) {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', m.conversation_id)
            .neq('sender_id', user.id)
            .gt('created_at', m.last_read_at);
          total += count || 0;
        }
      }
      return total;
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });
}
