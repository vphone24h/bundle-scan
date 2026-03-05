import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useCustomerTags, useCreateCustomerTag, useDeleteCustomerTag, useUpdateCustomerTag, CustomerTag } from '@/hooks/useCRM';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
];

interface TagManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagManagementDialog({ open, onOpenChange }: TagManagementDialogProps) {
  const { data: tags } = useCustomerTags();
  const createTag = useCreateCustomerTag();
  const deleteTag = useDeleteCustomerTag();
  const updateTag = useUpdateCustomerTag();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createTag.mutateAsync({ name: newName.trim(), color: newColor });
      setNewName('');
      toast.success('Đã tạo tag');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi tạo tag');
    }
  };

  const handleStartEdit = (tag: CustomerTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateTag.mutateAsync({ id: editingId, name: editName.trim(), color: editColor });
      setEditingId(null);
      toast.success('Đã cập nhật tag');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi cập nhật tag');
    }
  };

  const handleDelete = async (tagId: string) => {
    if (!confirm('Xóa tag này? Tất cả khách hàng được gắn tag này sẽ bị gỡ.')) return;
    try {
      await deleteTag.mutateAsync(tagId);
      toast.success('Đã xóa tag');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi xóa tag');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quản lý Tag khách hàng</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new tag */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <p className="text-sm font-medium">Tạo tag mới</p>
            <div className="flex gap-2">
              <Input
                placeholder="Tên tag..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-9 flex-1"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createTag.isPending} className="h-9">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    newColor === color ? 'border-foreground scale-125' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewColor(color)}
                />
              ))}
            </div>
          </div>

          {/* Tag list */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Danh sách tag ({tags?.length || 0})</p>
            {(!tags || tags.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chưa có tag nào</p>
            ) : (
              <div className="space-y-1.5">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50">
                    {editingId === tag.id ? (
                      <>
                        <span
                          className="w-4 h-4 rounded-full shrink-0 cursor-pointer"
                          style={{ backgroundColor: editColor }}
                        />
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="h-7 text-sm flex-1"
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                        />
                        <div className="flex gap-0.5">
                          {PRESET_COLORS.slice(0, 8).map(c => (
                            <button
                              key={c}
                              className={`w-3.5 h-3.5 rounded-full ${editColor === c ? 'ring-1 ring-foreground' : ''}`}
                              style={{ backgroundColor: c }}
                              onClick={() => setEditColor(c)}
                            />
                          ))}
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="text-sm flex-1">{tag.name}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStartEdit(tag)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(tag.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
