import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Plus, Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useCashBookCategories,
  useCreateCashBookCategory,
  useUpdateCashBookCategory,
  useDeleteCashBookCategory,
  type CashBookCategory,
} from '@/hooks/useCashBook';
import type { Database } from '@/integrations/supabase/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type CashBookType = Database['public']['Enums']['cash_book_type'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: CashBookType;
  onCategorySelect?: (name: string) => void;
}

export function CategoryManageDialog({ open, onOpenChange, type, onCategorySelect }: Props) {
  const { data: categories } = useCashBookCategories(type);
  const createCategory = useCreateCashBookCategory();
  const updateCategory = useUpdateCashBookCategory();
  const deleteCategory = useDeleteCashBookCategory();
  const { toast } = useToast();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingCat, setDeletingCat] = useState<CashBookCategory | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const trimmed = newName.trim();
    // Pre-check duplicate within this tenant + type for a friendly message
    const dup = categories?.find(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (dup) {
      toast({
        title: 'Danh mục đã tồn tại',
        description: `Danh mục "${dup.name}" đã có trong danh sách ${typeLabel}${
          dup.is_default ? ' (mặc định hệ thống)' : ''
        }. Vui lòng chọn tên khác.`,
        variant: 'destructive',
      });
      return;
    }
    try {
      await createCategory.mutateAsync({ name: trimmed, type });
      toast({ title: `Đã thêm danh mục "${trimmed}"` });
      if (onCategorySelect) onCategorySelect(trimmed);
      setNewName('');
    } catch (e: any) {
      const raw = e?.message || '';
      const isDup =
        e?.code === '23505' ||
        /duplicate key|unique constraint|cannot coerce/i.test(raw);
      toast({
        title: isDup ? 'Danh mục đã tồn tại' : 'Lỗi tạo danh mục',
        description: isDup
          ? `Tên "${trimmed}" đã tồn tại trong danh sách ${typeLabel}. Vui lòng chọn tên khác.`
          : raw || 'Không thể tạo danh mục. Vui lòng thử lại.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await updateCategory.mutateAsync({ id, name: editingName.trim() });
      toast({ title: 'Đã cập nhật danh mục' });
      setEditingId(null);
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;
    try {
      await deleteCategory.mutateAsync(deletingCat.id);
      toast({ title: `Đã xóa danh mục "${deletingCat.name}"` });
      setDeletingCat(null);
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
      setDeletingCat(null);
    }
  };

  const typeLabel = type === 'expense' ? 'chi' : 'thu';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Quản lý danh mục {typeLabel}</DialogTitle>
          </DialogHeader>

          {/* Add new */}
          <div className="flex gap-2">
            <Input
              placeholder={`Nhập tên danh mục ${typeLabel} mới`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newName.trim() || createCategory.isPending}
            >
              {createCategory.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Category list */}
          <div className="flex-1 overflow-auto space-y-1 min-h-0">
            {categories?.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group"
              >
                {editingId === cat.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(cat.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleUpdate(cat.id)}
                      disabled={updateCategory.isPending}
                    >
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className="flex-1 text-sm cursor-pointer truncate"
                      onClick={() => {
                        onCategorySelect?.(cat.name);
                        onOpenChange(false);
                      }}
                    >
                      {cat.name}
                    </span>
                    {cat.is_default ? (
                      <span className="text-xs text-muted-foreground shrink-0">Mặc định</span>
                    ) : (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingId(cat.id);
                            setEditingName(cat.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeletingCat(cat)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingCat} onOpenChange={(open) => !open && setDeletingCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa danh mục</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa danh mục "{deletingCat?.name}"? Thao tác này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCategory.isPending ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
