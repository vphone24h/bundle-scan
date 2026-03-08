import { memo, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStories, useCreateStory, useViewStory, StoryGroup } from '@/hooks/useStories';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from './VerifiedBadge';

export const StoriesBar = memo(function StoriesBar() {
  const { user } = useAuth();
  const { data: storyGroups } = useStories();
  const createStory = useCreateStory();
  const viewStory = useViewStory();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCreateStory = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `stories/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('tenant-assets').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
      await createStory.mutateAsync({ mediaUrl: data.publicUrl });
      toast.success('Đã đăng story');
    } catch {
      toast.error('Lỗi khi đăng story');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }, [user?.id, createStory]);

  const openStory = (group: StoryGroup) => {
    setViewingGroup(group);
    setCurrentStoryIdx(0);
    // Mark first story as viewed
    if (group.stories[0]) viewStory.mutate(group.stories[0].id);
  };

  const nextStory = () => {
    if (!viewingGroup) return;
    if (currentStoryIdx < viewingGroup.stories.length - 1) {
      const next = currentStoryIdx + 1;
      setCurrentStoryIdx(next);
      viewStory.mutate(viewingGroup.stories[next].id);
    } else {
      setViewingGroup(null);
    }
  };

  const prevStory = () => {
    if (currentStoryIdx > 0) setCurrentStoryIdx(currentStoryIdx - 1);
  };

  const currentStory = viewingGroup?.stories[currentStoryIdx];

  return (
    <>
      <div className="relative">
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto py-2 px-1 scrollbar-hide">
          {/* Create story button */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Plus className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <span className="text-[10px] text-muted-foreground w-16 text-center truncate">Tạo story</span>
          </div>

          {/* Story groups */}
          {(storyGroups || []).map(group => (
            <button
              key={group.user_id}
              onClick={() => openStory(group)}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <div className={cn(
                'w-16 h-16 rounded-full p-0.5',
                group.has_unviewed
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                  : 'bg-muted-foreground/20'
              )}>
                <Avatar className="w-full h-full border-2 border-background">
                  <AvatarImage src={group.avatar_url || undefined} />
                  <AvatarFallback className="text-sm">{(group.display_name || 'U')[0]}</AvatarFallback>
                </Avatar>
              </div>
              <span className="text-[10px] text-foreground w-16 text-center truncate">
                {group.user_id === user?.id ? 'Bạn' : group.display_name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleCreateStory} />

      {/* Story viewer */}
      <Dialog open={!!viewingGroup} onOpenChange={(open) => !open && setViewingGroup(null)}>
        <DialogContent className="max-w-lg w-[95vw] p-0 bg-black border-0 overflow-hidden max-h-[90vh]">
          {currentStory && (
            <div className="relative flex flex-col h-[80vh]">
              {/* Progress bars */}
              <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
                {viewingGroup!.stories.map((_, i) => (
                  <div key={i} className="flex-1 h-0.5 rounded bg-white/30">
                    <div className={cn('h-full rounded bg-white transition-all', i <= currentStoryIdx ? 'w-full' : 'w-0')} />
                  </div>
                ))}
              </div>

              {/* Header */}
              <div className="absolute top-4 left-0 right-0 z-20 flex items-center gap-2 px-3 pt-2">
                <Avatar className="h-8 w-8 border border-white/50">
                  <AvatarImage src={viewingGroup!.avatar_url || undefined} />
                  <AvatarFallback className="text-xs text-white bg-white/20">{(viewingGroup!.display_name || 'U')[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium flex items-center gap-1">
                    {viewingGroup!.display_name}
                    {viewingGroup!.is_verified && <VerifiedBadge size="sm" />}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setViewingGroup(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 flex items-center justify-center bg-black">
                {currentStory.media_url ? (
                  <img src={currentStory.media_url} alt="" className="max-w-full max-h-full object-contain" />
                ) : (
                  <p className="text-white text-lg p-8 text-center">{currentStory.content}</p>
                )}
              </div>

              {/* Navigation */}
              <button onClick={prevStory} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
              <button onClick={nextStory} className="absolute right-0 top-0 bottom-0 w-2/3 z-10" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});
