import { memo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFriendsList, usePendingFriendRequests, useRespondFriendRequest, useSendFriendRequest, usePendingFriendCount } from '@/hooks/useFriends';
import { useSearchUsers } from '@/hooks/useSocial';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserPlus, Check, X, Users, UserCheck, MessageCircle } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Props {
  onViewProfile: (userId: string) => void;
  onStartChat: (userId: string) => void;
}

export const ContactsTab = memo(function ContactsTab({ onViewProfile, onStartChat }: Props) {
  const { user } = useAuth();
  const { data: friends, isLoading: loadingFriends } = useFriendsList();
  const { data: pendingRequests } = usePendingFriendRequests();
  const respondRequest = useRespondFriendRequest();
  const sendRequest = useSendFriendRequest();
  const { data: pendingCount } = usePendingFriendCount();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults } = useSearchUsers(searchQuery);
  const [subTab, setSubTab] = useState('friends');

  const filteredFriends = (friends || []).filter(f =>
    !searchQuery.trim() || f.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Tìm bạn bè, thêm bạn mới..."
          className="pl-9 h-10"
        />
      </div>

      {/* Search results overlay */}
      {searchQuery.trim().length >= 2 && searchResults?.length ? (
        <Card>
          <CardContent className="p-2 space-y-1">
            <p className="text-xs text-muted-foreground px-2 py-1">Kết quả tìm kiếm</p>
            {searchResults.map(u => (
              <div key={u.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                <button onClick={() => onViewProfile(u.user_id)}>
                  <Avatar className="h-10 w-10 cursor-pointer">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback>{(u.display_name || 'U')[0]}</AvatarFallback>
                  </Avatar>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.display_name}</p>
                </div>
                {u.user_id !== user?.id && (
                  <Button size="sm" variant="outline" className="shrink-0 h-8"
                    onClick={() => { sendRequest.mutate(u.user_id); toast.success('Đã gửi lời mời kết bạn'); }}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Kết bạn
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Tabs */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="friends" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Bạn bè {friends?.length ? `(${friends.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5 text-xs relative">
            <UserPlus className="h-3.5 w-3.5" /> Lời mời
            {(pendingCount || 0) > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 min-w-4 px-1 ml-1">{pendingCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          {loadingFriends ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Đang tải...</div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Chưa có bạn bè nào</p>
              <p className="text-xs mt-1">Tìm kiếm để thêm bạn mới</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredFriends.map(friend => (
                <div key={friend.user_id} className="flex items-center gap-3 p-3">
                  <button onClick={() => onViewProfile(friend.user_id)}>
                    <Avatar className="h-11 w-11 cursor-pointer">
                      <AvatarImage src={friend.avatar_url || undefined} />
                      <AvatarFallback>{(friend.display_name || 'U')[0]}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {friend.display_name}
                      {friend.is_verified && <VerifiedBadge size="sm" />}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={() => onStartChat(friend.user_id)}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
          {!pendingRequests?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Không có lời mời kết bạn nào</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <Card key={req.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={req.sender_avatar || undefined} />
                      <AvatarFallback>{(req.sender_name || 'U')[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.sender_name}</p>
                      <p className="text-xs text-muted-foreground">Muốn kết bạn với bạn</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="default" className="h-8"
                        onClick={() => { respondRequest.mutate({ requestId: req.id, accept: true }); toast.success('Đã chấp nhận'); }}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-8"
                        onClick={() => respondRequest.mutate({ requestId: req.id, accept: false })}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
});
