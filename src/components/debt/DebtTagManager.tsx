import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useDebtTags, useCreateDebtTag, useDeleteDebtTag } from '@/hooks/useDebtTags';
import { toast } from '@/hooks/use-toast';
import { Plus, X, Hash } from 'lucide-react';

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78716c',
];

interface DebtTagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebtTagManager({ open, onOpenChange }: DebtTagManagerProps) {
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const { data: tags } = useDebtTags();
  const createTag = useCreateDebtTag();
  const deleteTag = useDeleteDebtTag();

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await createTag.mutateAsync({ name: trimmed, color: selectedColor });
      setNewName('');
      toast({ title: 'Đã tạo hashtag' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message?.includes('unique') ? 'Hashtag đã tồn tại' : err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTag.mutateAsync(id);
      toast({ title: 'Đã xóa hashtag' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Quản lý Hashtag công nợ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new tag */}
          <div className="space-y-2">
            <Label>Tên hashtag</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="VD: Ưu tiên, Chờ xử lý..."
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button onClick={handleCreate} disabled={!newName.trim() || createTag.isPending} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>Màu sắc</Label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${selectedColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          {/* Existing tags */}
          <div className="space-y-2">
            <Label>Danh sách hashtag ({tags?.length || 0})</Label>
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-white border-0 gap-1 pr-1"
                  style={{ backgroundColor: tag.color }}
                >
                  #{tag.name}
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {(!tags || tags.length === 0) && (
                <p className="text-sm text-muted-foreground">Chưa có hashtag nào</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
