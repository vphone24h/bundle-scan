import { useState, useRef, useCallback, memo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSocialFeed, useCreatePost } from '@/hooks/useSocial';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImagePlus, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { SocialPostCard } from './SocialPostCard';
import { toast } from 'sonner';

interface Props {
  onViewProfile: (userId: string) => void;
  focusPostId?: string | null;
  focusCommentId?: string | null;
  onFocusHandled?: () => void;
}

export const SocialFeedTab = memo(function SocialFeedTab({ onViewProfile, focusPostId, focusCommentId, onFocusHandled }: Props) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: feedData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useSocialFeed();
  const createPost = useCreatePost();
  const [newContent, setNewContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // Scroll to focused post after render
  useEffect(() => {
    if (focusPostId && posts.length > 0) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`social-post-${focusPostId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-primary');
          setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 3000);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [focusPostId, posts.length]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
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
