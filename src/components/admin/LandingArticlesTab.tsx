import { useState, useRef, useCallback } from 'react';
import {
  useLandingArticleCategories,
  useCreateLandingArticleCategory,
  useUpdateLandingArticleCategory,
  useDeleteLandingArticleCategory,
  useBatchUpdateCategoryOrder,
  useLandingArticles,
  useCreateLandingArticle,
  useUpdateLandingArticle,
  useDeleteLandingArticle,
  uploadLandingArticleImage,
  buildArticleCategoryTree,
  LandingArticle,
  LandingArticleCategory,
} from '@/hooks/useLandingArticles';
import { useCurrentTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Trash2, Edit2, Loader2, Upload, X, FolderPlus, FileText,
  ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, FolderOpen, Folder,
  Image as ImageIcon, Home, Star,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ListPagination, paginateArray } from '@/components/ui/list-pagination';

// ─── Category Tree Node ───
function CategoryNode({
  category, level, onEdit, onDelete, onAddChild, onToggleVisible, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: {
  category: LandingArticleCategory;
  level: number;
  onEdit: (c: LandingArticleCategory) => void;
  onDelete: (c: LandingArticleCategory) => void;
  onAddChild: (parentId: string) => void;
  onToggleVisible: (c: LandingArticleCategory) => void;
  onMoveUp: (c: LandingArticleCategory) => void;
  onMoveDown: (c: LandingArticleCategory) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div>
      <div className={cn('flex items-center gap-1.5 py-2 px-2 rounded-lg hover:bg-muted/50 group', level > 0 && 'ml-6')}>
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => canMoveUp && onMoveUp(category)} disabled={!canMoveUp} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronDown className="h-3 w-3 rotate-180" />
          </button>
          <button onClick={() => canMoveDown && onMoveDown(category)} disabled={!canMoveDown} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className={cn('h-6 w-6 flex items-center justify-center rounded hover:bg-muted shrink-0', !hasChildren && 'invisible')}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {category.image_url ? (
          <img src={category.image_url} alt="" className="h-8 w-8 rounded object-cover border shrink-0" />
        ) : (
          hasChildren || level === 0 ? (
            expanded ? <FolderOpen className="h-5 w-5 text-primary shrink-0" /> : <Folder className="h-5 w-5 text-primary shrink-0" />
          ) : (
            <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
          )
        )}

        <span className={cn('flex-1 font-medium text-sm truncate', !category.is_visible && 'text-muted-foreground line-through')}>{category.name}</span>

        {!category.is_visible && <Badge variant="outline" className="text-[10px] shrink-0">Ẩn</Badge>}

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleVisible(category)} title={category.is_visible ? 'Ẩn danh mục' : 'Hiện danh mục'}>
            {category.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddChild(category.id)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(category)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(category)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="animate-fade-in">
          {category.children!.map((child, idx) => (
            <CategoryNode
              key={child.id}
              category={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onToggleVisible={onToggleVisible}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              canMoveUp={idx > 0}
              canMoveDown={idx < category.children!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LandingArticlesTab() {
  const { data: tenant } = useCurrentTenant();
  const { data: categories = [], isLoading: catLoading } = useLandingArticleCategories();
  const createCat = useCreateLandingArticleCategory();
  const updateCat = useUpdateLandingArticleCategory();
  const deleteCat = useDeleteLandingArticleCategory();
  const batchOrder = useBatchUpdateCategoryOrder();
  const { data: articles, isLoading: artLoading } = useLandingArticles();
  const createArticle = useCreateLandingArticle();
  const updateArticle = useUpdateLandingArticle();
  const deleteArticle = useDeleteLandingArticle();

  // Category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<LandingArticleCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: '', parent_id: '_none_' as string, image_url: '' });
  const [catImageUploading, setCatImageUploading] = useState(false);
  const catFileRef = useRef<HTMLInputElement>(null);

  // Article dialog
  const [articleDialog, setArticleDialog] = useState(false);
  const [editingArticle, setEditingArticle] = useState<LandingArticle | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [articlePage, setArticlePage] = useState(1);
  const ARTICLE_PAGE_SIZE = 20;
  const [form, setForm] = useState({
    title: '', summary: '', content: '', category_id: '_none_',
    thumbnail_url: '', is_published: false, is_featured: false, is_featured_home: false,
  });

  const tree = buildArticleCategoryTree(categories);

  // Flatten for ordering
  const flattenTree = useCallback((nodes: LandingArticleCategory[], parentId: string | null = null): { id: string; parent_id: string | null; display_order: number }[] => {
    const result: { id: string; parent_id: string | null; display_order: number }[] = [];
    nodes.forEach((n, i) => {
      result.push({ id: n.id, parent_id: parentId, display_order: i });
      if (n.children?.length) {
        result.push(...flattenTree(n.children, n.id));
      }
    });
    return result;
  }, []);

  const swapInTree = (nodes: LandingArticleCategory[], targetId: string, direction: 'up' | 'down'): LandingArticleCategory[] => {
    const idx = nodes.findIndex(n => n.id === targetId);
    if (idx >= 0) {
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx >= 0 && swapIdx < nodes.length) {
        const copy = [...nodes];
        [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
        return copy;
      }
      return nodes;
    }
    return nodes.map(n => ({
      ...n,
      children: n.children?.length ? swapInTree(n.children, targetId, direction) : n.children,
    }));
  };

  const handleMove = async (cat: LandingArticleCategory, direction: 'up' | 'down') => {
    const newTree = swapInTree(tree, cat.id, direction);
    const flat = flattenTree(newTree);
    try {
      await batchOrder.mutateAsync(flat);
    } catch (e: any) {
      toast({ title: 'Lỗi sắp xếp', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Category CRUD ───
  const openAddCategory = (parentId?: string) => {
    setEditingCat(null);
    setCatForm({ name: '', parent_id: parentId || '_none_', image_url: '' });
    setCatDialog(true);
  };

  const openEditCategory = (cat: LandingArticleCategory) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, parent_id: cat.parent_id || '_none_', image_url: cat.image_url || '' });
    setCatDialog(true);
  };

  const handleCatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'Ảnh không quá 5MB', variant: 'destructive' }); return; }
    setCatImageUploading(true);
    try {
      const url = await uploadLandingArticleImage(file, tenant.id);
      setCatForm(p => ({ ...p, image_url: url }));
    } catch { toast({ title: 'Lỗi upload ảnh', variant: 'destructive' }); }
    finally { setCatImageUploading(false); }
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) return;
    try {
      const parentId = catForm.parent_id === '_none_' ? null : catForm.parent_id;
      if (editingCat) {
        await updateCat.mutateAsync({ id: editingCat.id, name: catForm.name.trim(), parent_id: parentId, image_url: catForm.image_url || null });
        toast({ title: 'Đã cập nhật danh mục' });
      } else {
        await createCat.mutateAsync({ name: catForm.name.trim(), parent_id: parentId, image_url: catForm.image_url || null });
        toast({ title: 'Đã thêm danh mục' });
      }
      setCatDialog(false);
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteCategory = async (cat: LandingArticleCategory) => {
    if (!confirm(`Xoá danh mục "${cat.name}"?`)) return;
    try {
      await deleteCat.mutateAsync(cat.id);
      toast({ title: 'Đã xoá danh mục' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggleVisible = async (cat: LandingArticleCategory) => {
    try {
      await updateCat.mutateAsync({ id: cat.id, is_visible: !cat.is_visible });
      toast({ title: cat.is_visible ? 'Đã ẩn danh mục' : 'Đã hiện danh mục' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Article CRUD ───
  const openAddArticle = () => {
    setEditingArticle(null);
    setForm({ title: '', summary: '', content: '', category_id: '_none_', thumbnail_url: '', is_published: false, is_featured: false, is_featured_home: false });
    setArticleDialog(true);
  };

  const openEditArticle = (a: LandingArticle) => {
    setEditingArticle(a);
    setForm({
      title: a.title, summary: a.summary || '', content: a.content || '',
      category_id: a.category_id || '_none_', thumbnail_url: a.thumbnail_url || '',
      is_published: a.is_published, is_featured: a.is_featured, is_featured_home: a.is_featured_home,
    });
    setArticleDialog(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'Ảnh không quá 5MB', variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const url = await uploadLandingArticleImage(file, tenant.id);
      setForm(prev => ({ ...prev, thumbnail_url: url }));
    } catch { toast({ title: 'Lỗi upload ảnh', variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  const handleSaveArticle = async () => {
    if (!form.title.trim()) return;
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary || null,
        content: form.content || null,
        category_id: form.category_id === '_none_' ? null : form.category_id,
        thumbnail_url: form.thumbnail_url || null,
        is_published: form.is_published,
        is_featured: form.is_featured,
        is_featured_home: form.is_featured_home,
      };
      if (editingArticle) {
        await updateArticle.mutateAsync({ id: editingArticle.id, ...payload });
        toast({ title: 'Đã cập nhật bài viết' });
      } else {
        await createArticle.mutateAsync(payload);
        toast({ title: 'Đã thêm bài viết' });
      }
      setArticleDialog(false);
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Xoá bài viết này?')) return;
    try {
      await deleteArticle.mutateAsync(id);
      toast({ title: 'Đã xoá bài viết' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  // Get all categories flat for selects (with indentation)
  const flatCategoriesForSelect = useCallback((): { id: string; name: string; level: number }[] => {
    const result: { id: string; name: string; level: number }[] = [];
    const traverse = (nodes: LandingArticleCategory[], level: number) => {
      nodes.forEach(n => {
        result.push({ id: n.id, name: n.name, level });
        if (n.children?.length) traverse(n.children, level + 1);
      });
    };
    traverse(tree, 0);
    return result;
  }, [tree]);

  if (catLoading || artLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Danh mục bài viết */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderPlus className="h-4 w-4" />
              Danh mục bài viết
            </CardTitle>
            <Button onClick={() => openAddCategory()} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Thêm danh mục
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tree.length > 0 ? (
            <div className="space-y-0.5">
              {tree.map((cat, idx) => (
                <CategoryNode
                  key={cat.id}
                  category={cat}
                  level={0}
                  onEdit={openEditCategory}
                  onDelete={handleDeleteCategory}
                  onAddChild={(parentId) => openAddCategory(parentId)}
                  onToggleVisible={handleToggleVisible}
                  onMoveUp={(c) => handleMove(c, 'up')}
                  onMoveDown={(c) => handleMove(c, 'down')}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < tree.length - 1}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Chưa có danh mục nào</p>
          )}
        </CardContent>
      </Card>

      {/* Danh sách bài viết */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Bài viết ({articles?.length || 0})
            </CardTitle>
            <Button onClick={openAddArticle} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Thêm bài viết
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {articles && articles.length > 0 ? (
            <div className="space-y-2">
              {articles.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  {a.thumbnail_url ? (
                    <img src={a.thumbnail_url} alt={a.title} className="h-12 w-16 rounded-lg object-cover border shrink-0" />
                  ) : (
                    <div className="h-12 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{a.title}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                      <span>{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</span>
                      {!a.is_published && <Badge variant="outline" className="text-[10px]">Nháp</Badge>}
                      {a.is_featured && <Badge className="text-[10px] gap-0.5"><Star className="h-2.5 w-2.5" />Nổi bật</Badge>}
                      {a.is_featured_home && <Badge variant="secondary" className="text-[10px] gap-0.5"><Home className="h-2.5 w-2.5" />Trang chủ</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditArticle(a)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteArticle(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Chưa có bài viết nào. Nhấn "Thêm bài viết" để bắt đầu.</p>
          )}
        </CardContent>
      </Card>

      {/* ─── Category Dialog ─── */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Sửa danh mục' : 'Thêm danh mục'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên danh mục *</Label>
              <Input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="Tên danh mục..." />
            </div>
            <div className="space-y-2">
              <Label>Danh mục cha</Label>
              <Select value={catForm.parent_id} onValueChange={v => setCatForm(p => ({ ...p, parent_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">— Không (danh mục gốc) —</SelectItem>
                  {flatCategoriesForSelect()
                    .filter(c => c.id !== editingCat?.id)
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {'—'.repeat(c.level)} {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ảnh danh mục</Label>
              <input ref={catFileRef} type="file" accept="image/*" onChange={handleCatImageUpload} className="hidden" />
              {catForm.image_url ? (
                <div className="relative inline-block">
                  <img src={catForm.image_url} alt="" className="h-20 rounded-lg object-cover border" />
                  <button onClick={() => setCatForm(p => ({ ...p, image_url: '' }))} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => catFileRef.current?.click()} disabled={catImageUploading} className="gap-1.5">
                {catImageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                Upload ảnh
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Huỷ</Button>
            <Button onClick={handleSaveCategory} disabled={!catForm.name.trim() || createCat.isPending || updateCat.isPending}>
              {(createCat.isPending || updateCat.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCat ? 'Cập nhật' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Article Dialog ─── */}
      <Dialog open={articleDialog} onOpenChange={setArticleDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Sửa bài viết' : 'Thêm bài viết mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Tiêu đề *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Tiêu đề bài viết..." />
            </div>
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">Không phân loại</SelectItem>
                  {flatCategoriesForSelect().map(c => (
                    <SelectItem key={c.id} value={c.id}>{'—'.repeat(c.level)} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tóm tắt</Label>
              <Input value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="Tóm tắt ngắn..." />
            </div>
            <div className="space-y-2">
              <Label>Ảnh đại diện</Label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              {form.thumbnail_url ? (
                <div className="relative inline-block">
                  <img src={form.thumbnail_url} alt="" className="h-24 rounded-lg object-cover border" />
                  <button onClick={() => setForm(p => ({ ...p, thumbnail_url: '' }))} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload ảnh
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Nội dung</Label>
              <RichTextEditor value={form.content} onChange={v => setForm(p => ({ ...p, content: v }))} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Xuất bản</Label>
              <Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Bài viết nổi bật</Label>
                <p className="text-xs text-muted-foreground">Hiển thị lớn và ưu tiên đầu trang tin tức</p>
              </div>
              <Switch checked={form.is_featured} onCheckedChange={v => setForm(p => ({ ...p, is_featured: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> Hiển thị trang chủ</Label>
                <p className="text-xs text-muted-foreground">Đưa bài viết ra trang chủ website</p>
              </div>
              <Switch checked={form.is_featured_home} onCheckedChange={v => setForm(p => ({ ...p, is_featured_home: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleDialog(false)}>Huỷ</Button>
            <Button onClick={handleSaveArticle} disabled={!form.title.trim() || createArticle.isPending || updateArticle.isPending}>
              {(createArticle.isPending || updateArticle.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingArticle ? 'Cập nhật' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
