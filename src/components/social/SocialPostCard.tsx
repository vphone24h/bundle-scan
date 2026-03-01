import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { SocialPost, useToggleLike, usePostComments, useCreateComment, useDeletePost, useTrackMessageClick } from '@/hooks/useSocial';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Send, CheckCircle, Trash2, MessageSquare, UserPlus, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useToggleFollow, useIsFollowing } from '@/hooks/useSocial';

interface Props {
  post: SocialPost;
  onViewProfile: (userId: string) => void;
}

export function SocialPostCard({ post, onViewProfile }: Props) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const toggleLike = useToggleLike();
  const { data: comments } = usePostComments(showComments ? post.id : null);
  const createComment = useCreateComment();
  const deletePost = useDeletePost();
  const trackClick = useTrackMessageClick();
  const toggleFollow = useToggleFollow();
  const { data: isFollowingUser } = useIsFollowing(user?.id !== post.user_id ? post.user_id : undefined);

  const isOwnPost = user?.id === post.user_id;

  const handleLike = () => {
    toggleLike.mutate({ postId: post.id, isLiked: !!post.is_liked });
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    createComment.mutate({
      postId: post.id,
      content: commentText.trim(),
      parentId: replyTo?.id,
    });
    setCommentText('');
    setReplyTo(null);
  };

  const handleDelete = () => {
    if (confirm('Xóa bài viết này?')) {
      deletePost.mutate(post.id);
      toast.success('Đã xóa bài viết');
    }
  };

  const handleMessageClick = (type: 'zalo' | 'facebook') => {
    trackClick.mutate(post.id);
    if (type === 'zalo' && post.zalo_number) {
      window.open(`https://zalo.me/${post.zalo_number}`, '_blank');
    } else if (type === 'facebook' && post.facebook_url) {
      const url = post.facebook_url.startsWith('http') ? post.facebook_url : `https://facebook.com/${post.facebook_url}`;
      window.open(url, '_blank');
    }
  };

  // Organize comments: top-level and replies
  const topComments = (comments || []).filter(c => !c.parent_id);
  const replyMap = new Map<string, typeof comments>();
  (comments || []).filter(c => c.parent_id).forEach(c => {
    const arr = replyMap.get(c.parent_id!) || [];
    arr.push(c);
    replyMap.set(c.parent_id!, arr);
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => onViewProfile(post.user_id)}>
            <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 ring-primary transition-all">
              <AvatarImage src={post.avatar_url || undefined} />
              <AvatarFallback>{(post.display_name || 'U')[0]}</AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <button onClick={() => onViewProfile(post.user_id)} className="font-semibold text-sm hover:underline">
                {post.display_name}
              </button>
              {post.is_verified && <CheckCircle className="h-4 w-4 text-blue-500 fill-blue-500" />}
              {!isOwnPost && user?.id && (
                <button
                  onClick={() => toggleFollow.mutate({ targetUserId: post.user_id, isFollowing: !!isFollowingUser })}
                  className="ml-1"
                  disabled={toggleFollow.isPending}
                >
                  {isFollowingUser ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 cursor-pointer">
                      <UserCheck className="h-3 w-3 mr-0.5" /> Đang theo dõi
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 cursor-pointer">
                      <UserPlus className="h-3 w-3 mr-0.5" /> Theo dõi
                    </Badge>
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}
            </p>
          </div>
          {isOwnPost && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <p className="text-sm whitespace-pre-wrap mb-3">{post.content}</p>

        {/* Images */}
        {post.image_urls?.length > 0 && (
          <div className={cn('grid gap-1 mb-3', post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
            {post.image_urls.map((url, i) => (
              <img key={i} src={url} alt="" className="w-full rounded-lg object-cover max-h-80" />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pb-2 border-b">
          {post.like_count > 0 && <span>{post.like_count} thích</span>}
          {post.comment_count > 0 && <span>{post.comment_count} bình luận</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 py-1">
          <Button variant="ghost" size="sm" onClick={handleLike} className={cn('flex-1', post.is_liked && 'text-red-500')}>
            <Heart className={cn('h-4 w-4 mr-1', post.is_liked && 'fill-red-500')} /> Thích
          </Button>
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="h-4 w-4 mr-1" /> Bình luận
          </Button>
          {/* Message buttons */}
          {post.show_zalo_button && post.zalo_number && (
            <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => handleMessageClick('zalo')}>
              <MessageSquare className="h-4 w-4 mr-1" /> Zalo
            </Button>
          )}
          {post.show_facebook_button && post.facebook_url && (
            <Button variant="ghost" size="sm" className="text-blue-700" onClick={() => handleMessageClick('facebook')}>
              <MessageSquare className="h-4 w-4 mr-1" /> FB
            </Button>
          )}
        </div>

        {/* Comments */}
        {showComments && (
          <div className="border-t pt-3 space-y-3">
            {topComments.map(comment => (
              <div key={comment.id}>
                <div className="flex gap-2">
                  <button onClick={() => onViewProfile(comment.user_id)}>
                    <Avatar className="h-7 w-7 cursor-pointer">
                      <AvatarImage src={comment.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{(comment.display_name || 'U')[0]}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 bg-muted rounded-xl px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold">{comment.display_name}</span>
                      {comment.is_verified && <CheckCircle className="h-3 w-3 text-blue-500 fill-blue-500" />}
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                </div>
                <div className="ml-9 flex gap-3 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: vi })}
                  </span>
                  <button className="text-[10px] text-muted-foreground hover:text-primary font-medium" onClick={() => setReplyTo({ id: comment.id, name: comment.display_name || '' })}>
                    Trả lời
                  </button>
                </div>
                {/* Replies */}
                {(replyMap.get(comment.id) || []).map(reply => (
                  <div key={reply.id} className="ml-9 mt-2 flex gap-2">
                    <button onClick={() => onViewProfile(reply.user_id)}>
                      <Avatar className="h-6 w-6 cursor-pointer">
                        <AvatarImage src={reply.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">{(reply.display_name || 'U')[0]}</AvatarFallback>
                      </Avatar>
                    </button>
                    <div className="flex-1 bg-muted rounded-xl px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold">{reply.display_name}</span>
                        {reply.is_verified && <CheckCircle className="h-3 w-3 text-blue-500 fill-blue-500" />}
                      </div>
                      <p className="text-sm">{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Comment input */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                {replyTo && (
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    Trả lời <span className="font-semibold">{replyTo.name}</span>
                    <button onClick={() => setReplyTo(null)} className="text-destructive ml-1">✕</button>
                  </div>
                )}
                <Input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Viết bình luận..."
                  className="h-8 text-sm pr-10"
                  onKeyDown={e => e.key === 'Enter' && handleComment()}
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleComment} disabled={!commentText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
