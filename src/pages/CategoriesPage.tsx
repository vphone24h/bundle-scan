import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { CategoryTree } from '@/components/categories/CategoryTree';
import { mockCategories } from '@/lib/mockData';
import { Category } from '@/types/warehouse';
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
import { Plus, FolderPlus } from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [parentId, setParentId] = useState<string>('');
  const [name, setName] = useState('');

  const handleAdd = () => {
    setEditCategory(null);
    setParentId('');
    setName('');
    setDialogOpen(true);
  };

  const handleAddChild = (pid: string) => {
    setEditCategory(null);
    setParentId(pid);
    setName('');
    setDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditCategory(category);
    setParentId(category.parentId || '');
    setName(category.name);
    setDialogOpen(true);
  };

  const handleDelete = (category: Category) => {
    if (confirm(`Bạn có chắc muốn xoá danh mục "${category.name}"?`)) {
      setCategories(categories.filter((c) => c.id !== category.id && c.parentId !== category.id));
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (editCategory) {
      setCategories(
        categories.map((c) =>
          c.id === editCategory.id
            ? { ...c, name: name.trim(), parentId: parentId || undefined }
            : c
        )
      );
    } else {
      const newCategory: Category = {
        id: String(Date.now()),
        name: name.trim(),
        parentId: parentId || undefined,
        createdAt: new Date(),
      };
      setCategories([...categories, newCategory]);
    }
    setDialogOpen(false);
  };

  // Get only parent categories for the select
  const parentOptions = categories.filter((c) => !c.parentId);

  return (
    <MainLayout>
      <PageHeader
        title="Quản lý danh mục"
        description="Phân loại sản phẩm theo danh mục cha - con"
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
            categories={categories}
            onEdit={handleEdit}
            onDelete={handleDelete}
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
                  <SelectItem value="">Không có (danh mục gốc)</SelectItem>
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
            <Button onClick={handleSave} disabled={!name.trim()}>
              {editCategory ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
