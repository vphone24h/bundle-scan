import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { CategoryTree } from '@/components/categories/CategoryTree';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, Category } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FolderPlus, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function CategoriesPage() {
  const { t } = useTranslation();
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [parentId, setParentId] = useState<string>('_none_');
  const [name, setName] = useState('');

  const handleAdd = () => {
    setEditCategory(null);
    setParentId('_none_');
    setName('');
    setDialogOpen(true);
  };

  const handleAddChild = (pid: string) => {
    setEditCategory(null);
    setParentId(pid || '_none_');
    setName('');
    setDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditCategory(category);
    setParentId(category.parent_id || '_none_');
    setName(category.name);
    setDialogOpen(true);
  };

  const handleDelete = async (category: Category) => {
    if (confirm(`Bạn có chắc muốn xoá danh mục "${category.name}"?`)) {
      try {
        await deleteCategory.mutateAsync(category.id);
        toast({ title: 'Đã xoá danh mục' });
      } catch (error: any) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      const parentIdValue = parentId === '_none_' ? null : parentId;
      
      if (editCategory) {
        await updateCategory.mutateAsync({
          id: editCategory.id,
          name: name.trim(),
          parent_id: parentIdValue,
        });
        toast({ title: 'Đã cập nhật danh mục' });
      } else {
        await createCategory.mutateAsync({
          name: name.trim(),
          parent_id: parentIdValue,
        });
        toast({ title: 'Đã thêm danh mục mới' });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  // Get only parent categories for the select
  const parentOptions = categories?.filter((c) => !c.parent_id) || [];

  // Map to old Category format for CategoryTree
  const mappedCategories = categories?.map(c => ({
    id: c.id,
    name: c.name,
    parentId: c.parent_id || undefined,
    createdAt: new Date(c.created_at),
  })) || [];

  // Shell-first: no spinner

  return (
    <MainLayout>
      <PageHeader
        title={t('pages.categories.title')}
        description={t('pages.categories.description')}
        helpText={t('pages.categories.helpText')}
        actions={
          <Button onClick={handleAdd}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Thêm danh mục
          </Button>
        }
      />

      <div className="p-6 lg:p-8">
        <div className="bg-card border rounded-xl p-4">
          <CategoryTree
            categories={mappedCategories}
            onEdit={(cat) => handleEdit(categories?.find(c => c.id === cat.id) as Category)}
            onDelete={(cat) => handleDelete(categories?.find(c => c.id === cat.id) as Category)}
            onAddChild={handleAddChild}
          />
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="form-field">
              <Label htmlFor="name">Tên danh mục</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên danh mục"
              />
            </div>

            <div className="form-field">
              <Label htmlFor="parent">Danh mục cha (tuỳ chọn)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục cha" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">Không có (danh mục gốc)</SelectItem>
                  {parentOptions
                    .filter((c) => c.id !== editCategory?.id)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!name.trim() || createCategory.isPending || updateCategory.isPending}
            >
              {(createCategory.isPending || updateCategory.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editCategory ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
