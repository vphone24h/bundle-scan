import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { useUpdatePost, SocialPost } from '@/hooks/useSocial';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  post: SocialPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPostDialog({ post, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const updatePost = useUpdatePost();
  const [content, setContent] = useState(post.content);
  const [imageUrls, setImageUrls] = useState<string[]>(post.image_urls || []);
  const [uploading, setUploading] = useState(false);
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
    if (fileRef.current) fileRef.current.value = '';
  }, [user?.id]);

  const removeImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!content.trim() && imageUrls.length === 0) return;
    try {
      await updatePost.mutateAsync({ postId: post.id, content: content.trim(), imageUrls });
      toast.success('Đã cập nhật bài viết');
      onOpenChange(false);
    } catch {
      toast.error('Lỗi khi cập nhật');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa bài viết</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Nội dung bài viết..."
            className="min-h-[120px] resize-none"
          />

          {imageUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-full h-32 object-cover rounded-lg" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
        <DialogFooter className="shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ImagePlus className="h-4 w-4 mr-1" />}
            Thêm ảnh
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updatePost.isPending || (!content.trim() && imageUrls.length === 0)}>
            {updatePost.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
