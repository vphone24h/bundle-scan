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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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

  const handleAdd = () => { setEditCategory(null); setParentId('_none_'); setName(''); setDialogOpen(true); };
  const handleAddChild = (pid: string) => { setEditCategory(null); setParentId(pid || '_none_'); setName(''); setDialogOpen(true); };
  const handleEdit = (category: Category) => { setEditCategory(category); setParentId(category.parent_id || '_none_'); setName(category.name); setDialogOpen(true); };

  const handleDelete = async (category: Category) => {
    if (confirm(`${t('pages.categories.confirmDelete')} "${category.name}"?`)) {
      try {
        await deleteCategory.mutateAsync(category.id);
        toast({ title: t('pages.categories.deleted') });
      } catch (error: any) {
        toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      const parentIdValue = parentId === '_none_' ? null : parentId;
      if (editCategory) {
        await updateCategory.mutateAsync({ id: editCategory.id, name: name.trim(), parent_id: parentIdValue });
        toast({ title: t('pages.categories.updated') });
      } else {
        await createCategory.mutateAsync({ name: name.trim(), parent_id: parentIdValue });
        toast({ title: t('pages.categories.added') });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    }
  };

  const parentOptions = categories?.filter((c) => !c.parent_id) || [];
  const mappedCategories = categories?.map(c => ({ id: c.id, name: c.name, parentId: c.parent_id || undefined, createdAt: new Date(c.created_at) })) || [];

  return (
    <MainLayout>
      <PageHeader
        title={t('pages.categories.title')}
        description={t('pages.categories.description')}
        helpText={t('pages.categories.helpText')}
        actions={
          <Button onClick={handleAdd}>
            <FolderPlus className="mr-2 h-4 w-4" />
            {t('pages.categories.addCategory')}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editCategory ? t('pages.categories.editCategory') : t('pages.categories.addNewCategory')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="form-field">
              <Label htmlFor="name">{t('pages.categories.categoryName')}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pages.categories.enterName')} />
            </div>
            <div className="form-field">
              <Label htmlFor="parent">{t('pages.categories.parentCategory')}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder={t('pages.categories.selectParent')} /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">{t('pages.categories.noParent')}</SelectItem>
                  {parentOptions.filter((c) => c.id !== editCategory?.id).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('pages.categories.cancel')}</Button>
            <Button onClick={handleSave} disabled={!name.trim() || createCategory.isPending || updateCategory.isPending}>
              {(createCategory.isPending || updateCategory.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editCategory ? t('pages.categories.update') : t('pages.categories.addNew')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
