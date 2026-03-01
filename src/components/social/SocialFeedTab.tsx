import { useState, useRef, useCallback, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSocialFeed, useCreatePost } from '@/hooks/useSocial';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImagePlus, Send, Loader2, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { SocialPostCard } from './SocialPostCard';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface Props {
  onViewProfile: (userId: string) => void;
}

function useSearchUsers(query: string) {
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

      // Fetch verified status
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

export const SocialFeedTab = memo(function SocialFeedTab({ onViewProfile }: Props) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: feedData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useSocialFeed();
  const createPost = useCreatePost();
  const [newContent, setNewContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: searchResults } = useSearchUsers(searchQuery);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user?.id) return;

    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `social/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('tenant-assets').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setImageUrls(prev => [...prev, ...urls]);
    setUploading(false);
  }, [user?.id]);

  const handlePost = useCallback(async () => {
    if (!newContent.trim() && imageUrls.length === 0) return;
    try {
      await createPost.mutateAsync({ content: newContent.trim(), imageUrls });
      setNewContent('');
      setImageUrls([]);
      toast.success('Đã đăng bài');
    } catch {
      toast.error('Lỗi khi đăng bài');
    }
  }, [newContent, imageUrls, createPost]);

  const posts = feedData?.pages?.flatMap(p => p.posts) || [];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder="Tìm người dùng theo tên hoặc SĐT..."
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setShowSearch(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Search results dropdown */}
        {showSearch && searchQuery.trim().length >= 2 && (
          <Card className="absolute z-50 w-full mt-1 shadow-lg max-h-64 overflow-auto">
            <CardContent className="p-2">
              {!searchResults?.length ? (
                <p className="text-sm text-muted-foreground text-center py-3">Không tìm thấy</p>
              ) : (
                searchResults.map(u => (
                  <button
                    key={u.user_id}
                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent transition-colors text-left"
                    onClick={() => {
                      onViewProfile(u.user_id);
                      setSearchQuery('');
                      setShowSearch(false);
                    }}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-sm">{(u.display_name || 'U')[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.display_name || 'Người dùng'}</p>
                      {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                    </div>
                    {u.is_verified && (
                      <span className="text-blue-500 text-xs">✓</span>
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create post */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{(profile?.display_name || 'U')[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Bạn đang nghĩ gì? Chia sẻ với cộng đồng VKHO..."
                rows={3}
                className="resize-none"
              />
              {/* Image previews */}
              {imageUrls.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {imageUrls.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg" />
                      <button
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs"
                        onClick={() => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    <span className="ml-1">Ảnh</span>
                  </Button>
                </div>
                <Button size="sm" onClick={handlePost} disabled={createPost.isPending || (!newContent.trim() && imageUrls.length === 0)}>
                  <Send className="h-4 w-4 mr-1" /> Đăng bài
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feed */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Đang tải bài viết...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!
        </div>
      ) : (
        <>
          {posts.map(post => (
            <SocialPostCard key={post.id} post={post} onViewProfile={onViewProfile} />
          ))}
          {hasNextPage && (
            <div className="text-center">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Xem thêm
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
});
