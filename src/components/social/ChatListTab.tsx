import { memo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useConversations, Conversation } from '@/hooks/useChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Search, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSearchUsers } from '@/hooks/useSocial';
import { useStartConversation } from '@/hooks/useChat';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  onSelectConversation: (conv: Conversation) => void;
  onStartChat: (userId: string) => void;
}

export const ChatListTab = memo(function ChatListTab({ onSelectConversation, onStartChat }: Props) {
  const { data: conversations, isLoading } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const { data: searchResults } = useSearchUsers(newChatSearch);
  const startConversation = useStartConversation();

  const filtered = (conversations || []).filter(c => {
    if (!searchQuery.trim()) return true;
    const name = c.type === 'group' ? c.name : c.other_user_name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleStartNewChat = async (userId: string) => {
    try {
      const convId = await startConversation.mutateAsync(userId);
      setShowNewChat(false);
      setNewChatSearch('');
      // Find or create the conversation to navigate to
      onStartChat(userId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-2">
      {/* Search + New chat */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm cuộc trò chuyện..."
            className="pl-9 h-10"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setShowNewChat(!showNewChat)}>
          <MessageSquarePlus className="h-5 w-5" />
        </Button>
      </div>

      {/* New chat search */}
      {showNewChat && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <Input
              autoFocus
              value={newChatSearch}
              onChange={e => setNewChatSearch(e.target.value)}
              placeholder="Tìm người để nhắn tin..."
              className="h-9"
            />
            {searchResults?.map(u => (
              <button
                key={u.user_id}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent transition-colors text-left"
                onClick={() => handleStartNewChat(u.user_id)}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="text-sm">{(u.display_name || 'U')[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{u.display_name}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Conversation list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Chưa có tin nhắn nào</p>
          <p className="text-xs mt-1">Nhấn <MessageSquarePlus className="h-3 w-3 inline" /> để bắt đầu cuộc trò chuyện</p>
        </div>
      ) : (
        <div className="divide-y">
          {filtered.map(conv => (
            <button
              key={conv.id}
              className="flex items-center gap-3 w-full p-3 hover:bg-accent/50 transition-colors text-left"
              onClick={() => onSelectConversation(conv)}
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={(conv.type === 'group' ? conv.avatar_url : conv.other_user_avatar) || undefined} />
                  <AvatarFallback className="text-sm">
                    {((conv.type === 'group' ? conv.name : conv.other_user_name) || 'U')[0]}
                  </AvatarFallback>
                </Avatar>
                {(conv.unread_count || 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                    {conv.unread_count}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm font-medium truncate', (conv.unread_count || 0) > 0 && 'font-bold')}>
                    {conv.type === 'group' ? conv.name : conv.other_user_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {conv.last_message_at && formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: vi })}
                  </span>
                </div>
                <p className={cn('text-xs truncate mt-0.5', (conv.unread_count || 0) > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                  {conv.last_message || 'Chưa có tin nhắn'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
