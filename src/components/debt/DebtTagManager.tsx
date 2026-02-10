import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useDebtTags, useCreateDebtTag, useUpdateDebtTag, useDeleteDebtTag } from '@/hooks/useDebtTags';
import { toast } from '@/hooks/use-toast';
import { Plus, X, Hash, Pencil, Check } from 'lucide-react';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const { data: tags } = useDebtTags();
  const createTag = useCreateDebtTag();
  const updateTag = useUpdateDebtTag();
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

  const handleStartEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateTag.mutateAsync({ id: editingId, name: editName.trim(), color: editColor });
      setEditingId(null);
      toast({ title: 'Đã cập nhật hashtag' });
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
            <div className="flex flex-col gap-2 min-h-[40px]">
              {tags?.map((tag) => (
                <div key={tag.id}>
                  {editingId === tag.id ? (
                    <div className="flex flex-col gap-2 p-2 rounded-md border bg-muted/50">
                      <div className="flex gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          autoFocus
                        />
                        <Button size="sm" className="h-8" onClick={handleSaveEdit} disabled={!editName.trim() || updateTag.isPending}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`h-6 w-6 rounded-full border-2 transition-transform ${editColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setEditColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-white border-0 gap-1"
                        style={{ backgroundColor: tag.color }}
                      >
                        #{tag.name}
                      </Badge>
                      <div className="flex-1" />
                      <button
                        onClick={() => handleStartEdit(tag)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(tag.id)}
                        className="p-1 hover:bg-destructive/10 rounded"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
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
