import { useState, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
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
  getLandingArticleById,
  LandingArticle,
  LandingArticleCategory,
  useReorderLandingArticles,
} from '@/hooks/useLandingArticles';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useTenantLandingSettings, useUpdateTenantLandingSettings } from '@/hooks/useTenantLanding';
import { getIndustryConfig } from '@/lib/industryConfig';
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
  ChevronDown, ChevronRight, Eye, EyeOff, FolderOpen, Folder,
  Image as ImageIcon, Home, Star, ArrowUp, ArrowDown, List,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ListPagination, paginateArray } from '@/components/ui/list-pagination';
import { SortableList, SortableItem, DragHandle } from '@/components/shared/SortableList';

const LazyRichTextEditor = lazy(() =>
  import('@/components/ui/rich-text-editor').then((m) => ({ default: m.RichTextEditor }))
);

// ─── Category Tree Node ───
function CategoryNode({
  category, level, onEdit, onDelete, onAddChild, onToggleHome, onTogglePage, onReorderSiblings, dragHandleProps,
}: {
  category: LandingArticleCategory;
  level: number;
  onEdit: (c: LandingArticleCategory) => void;
  onDelete: (c: LandingArticleCategory) => void;
  onAddChild: (parentId: string) => void;
  onToggleHome: (c: LandingArticleCategory) => void;
  onTogglePage: (c: LandingArticleCategory) => void;
  onReorderSiblings: (parentId: string | null, siblings: LandingArticleCategory[]) => void;
  dragHandleProps: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;
  const hiddenHome = (category as any).hidden_from_home === true;
  const hiddenPage = (category as any).hidden_from_articles_page === true;
  const fullyHidden = hiddenHome && hiddenPage;

  return (
    <div>
      <div className={cn('flex items-center gap-1.5 py-2 px-2 rounded-lg hover:bg-muted/50 group', level > 0 && 'ml-6')}>
        <DragHandle dragHandleProps={dragHandleProps} className="h-7 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none shrink-0" />

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

        <span className={cn('flex-1 font-medium text-sm truncate', fullyHidden && 'text-muted-foreground line-through')}>{category.name}</span>

        {hiddenHome && !hiddenPage && <Badge variant="outline" className="text-[10px] shrink-0">Ẩn trang chủ</Badge>}
        {hiddenPage && !hiddenHome && <Badge variant="outline" className="text-[10px] shrink-0">Ẩn trang tin tức</Badge>}
        {fullyHidden && <Badge variant="outline" className="text-[10px] shrink-0">Ẩn</Badge>}

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 relative border',
              hiddenHome
                ? 'bg-destructive/10 border-destructive/40 text-destructive hover:bg-destructive/20'
                : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
            )}
            onClick={() => onToggleHome(category)}
            title={hiddenHome ? 'Hiện trên trang chủ' : 'Ẩn khỏi trang chủ'}
          >
            <Home className="h-3.5 w-3.5" />
            {hiddenHome && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="block h-[1.5px] w-5 bg-destructive rotate-45 rounded" />
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 relative border',
              hiddenPage
                ? 'bg-destructive/10 border-destructive/40 text-destructive hover:bg-destructive/20'
                : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
            )}
            onClick={() => onTogglePage(category)}
            title={hiddenPage ? 'Hiện ở trang tin tức' : 'Ẩn khỏi trang tin tức'}
          >
            <List className="h-3.5 w-3.5" />
            {hiddenPage && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="block h-[1.5px] w-5 bg-destructive rotate-45 rounded" />
              </span>
            )}
          </Button>
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
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
        <SortableList<LandingArticleCategory>
          items={category.children!}
          onReorder={(reordered) => onReorderSiblings(category.id, reordered)}
          className="animate-fade-in"
        >
          {(child) => (
            <SortableItem key={child.id} id={child.id}>
              {({ dragHandleProps: childHandle }) => (
                <CategoryNode
                  category={child}
                  level={level + 1}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onToggleHome={onToggleHome}
                  onTogglePage={onTogglePage}
                  onReorderSiblings={onReorderSiblings}
                  dragHandleProps={childHandle}
                />
              )}
            </SortableItem>
          )}
        </SortableList>
      )}
    </div>
  );
}

export function LandingArticlesTab() {
  const { data: tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const { data: landingSettings } = useTenantLandingSettings();
  const updateSettings = useUpdateTenantLandingSettings();
  const [artSectionTitle, setArtSectionTitle] = useState('');
  const { data: categories = [], isLoading: catLoading } = useLandingArticleCategories(tenantId);
  const createCat = useCreateLandingArticleCategory();
  const updateCat = useUpdateLandingArticleCategory();
  const deleteCat = useDeleteLandingArticleCategory();
  const batchOrder = useBatchUpdateCategoryOrder();
  const { data: articles, isLoading: artLoading } = useLandingArticles(tenantId);
  const createArticle = useCreateLandingArticle();
  const updateArticle = useUpdateLandingArticle();
  const deleteArticle = useDeleteLandingArticle();
  const reorderArticles = useReorderLandingArticles();

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
  const [loadingEditArticleId, setLoadingEditArticleId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', summary: '', content: '', category_id: '_none_',
    thumbnail_url: '', is_published: false, is_featured: false, is_featured_home: false,
    seo_description: '',
  });

  const tree = useMemo(() => buildArticleCategoryTree(categories), [categories]);

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

  const replaceSiblings = (nodes: LandingArticleCategory[], parentId: string | null, reordered: LandingArticleCategory[]): LandingArticleCategory[] => {
    if (parentId === null) return reordered;
    return nodes.map(n => {
      if (n.id === parentId) return { ...n, children: reordered };
      if (n.children?.length) return { ...n, children: replaceSiblings(n.children, parentId, reordered) };
      return n;
    });
  };

  const handleReorderArticleSiblings = async (parentId: string | null, reordered: LandingArticleCategory[]) => {
    const newTree = replaceSiblings(tree, parentId, reordered);
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

  const handleToggleHome = async (cat: LandingArticleCategory) => {
    try {
      const next = !(cat as any).hidden_from_home;
      await updateCat.mutateAsync({ id: cat.id, hidden_from_home: next });
      toast({ title: next ? 'Đã ẩn khỏi trang chủ' : 'Đã hiện trên trang chủ' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const handleTogglePage = async (cat: LandingArticleCategory) => {
    try {
      const next = !(cat as any).hidden_from_articles_page;
      await updateCat.mutateAsync({ id: cat.id, hidden_from_articles_page: next });
      toast({ title: next ? 'Đã ẩn khỏi trang tin tức' : 'Đã hiện ở trang tin tức' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Article CRUD ───
  const openAddArticle = () => {
    setEditingArticle(null);
    setForm({ title: '', summary: '', content: '', category_id: '_none_', thumbnail_url: '', is_published: false, is_featured: false, is_featured_home: false, seo_description: '' });
    setArticleDialog(true);
  };

  const openEditArticle = async (a: LandingArticle) => {
    try {
      setLoadingEditArticleId(a.id);
      const detail = await getLandingArticleById(a.id);
      if (!detail) {
        toast({ title: 'Không tìm thấy bài viết', variant: 'destructive' });
        return;
      }

      setEditingArticle(detail);
      setForm({
        title: detail.title,
        summary: detail.summary || '',
        content: detail.content || '',
        category_id: detail.category_id || '_none_',
        thumbnail_url: detail.thumbnail_url || '',
        is_published: detail.is_published,
        is_featured: detail.is_featured,
        is_featured_home: detail.is_featured_home,
        seo_description: (detail as any).seo_description || '',
      });
      setArticleDialog(true);
    } catch (e: any) {
      toast({ title: 'Lỗi tải bài viết', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingEditArticleId(null);
    }
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
        seo_description: form.seo_description?.trim() || null,
      };
      if (editingArticle) {
        await updateArticle.mutateAsync({ id: editingArticle.id, ...payload });
        toast({ title: 'Đã cập nhật bài viết' });
        // Giữ popup mở khi cập nhật — chỉ đóng khi user nhấn nút X hoặc Huỷ
      } else {
        await createArticle.mutateAsync(payload);
        toast({ title: 'Đã thêm bài viết' });
        setArticleDialog(false);
      }
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
  const flatCategoriesForSelect = useMemo((): { id: string; name: string; level: number }[] => {
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

  const pagedArticles = useMemo(
    () => paginateArray(articles || [], articlePage, ARTICLE_PAGE_SIZE),
    [articles, articlePage]
  );

  const handleReorderArticlesPage = async (pageItems: LandingArticle[]) => {
    if (!articles || !pageItems) return;
    const startIdx = (articlePage - 1) * ARTICLE_PAGE_SIZE;
    const reordered = [...articles];
    pageItems.forEach((a, i) => {
      reordered[startIdx + i] = a;
    });
    await reorderArticles.mutateAsync(
      reordered.map((a, i) => ({ id: a.id, display_order: i }))
    );
  };

  const handleMoveArticleAcrossPage = async (
    articleId: string,
    direction: 'prev' | 'next'
  ) => {
    if (!articles) return;
    const currIdx = articles.findIndex(a => a.id === articleId);
    if (currIdx < 0) return;
    const reordered = [...articles];
    const [item] = reordered.splice(currIdx, 1);
    if (direction === 'next') {
      const targetIdx = Math.min(articlePage * ARTICLE_PAGE_SIZE, reordered.length);
      reordered.splice(targetIdx, 0, item);
      setArticlePage(articlePage + 1);
    } else {
      const targetIdx = Math.max((articlePage - 1) * ARTICLE_PAGE_SIZE - 1, 0);
      reordered.splice(targetIdx, 0, item);
      setArticlePage(Math.max(articlePage - 1, 1));
    }
    await reorderArticles.mutateAsync(
      reordered.map((a, i) => ({ id: a.id, display_order: i }))
    );
  };

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
          {/* Custom article section title */}
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">Tiêu đề hiển thị trên website</Label>
            <Input
              value={artSectionTitle || (landingSettings as any)?.article_section_title || ''}
              onChange={e => setArtSectionTitle(e.target.value)}
              onBlur={() => {
                if (artSectionTitle !== '' && artSectionTitle !== ((landingSettings as any)?.article_section_title || '')) {
                  updateSettings.mutate({ article_section_title: artSectionTitle } as any);
                }
              }}
              placeholder={getIndustryConfig((landingSettings as any)?.website_template || 'phone_store').articleSectionTitle}
              className="h-8 text-sm mt-1"
            />
          </div>
        </CardHeader>
        <CardContent>
          {catLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : tree.length > 0 ? (
            <SortableList<LandingArticleCategory>
              items={tree}
              onReorder={(reordered) => handleReorderArticleSiblings(null, reordered)}
              className="space-y-0.5"
            >
              {(cat) => (
                <SortableItem key={cat.id} id={cat.id}>
                  {({ dragHandleProps }) => (
                    <CategoryNode
                      category={cat}
                      level={0}
                      onEdit={openEditCategory}
                      onDelete={handleDeleteCategory}
                      onAddChild={(parentId) => openAddCategory(parentId)}
                      onToggleHome={handleToggleHome}
                      onTogglePage={handleTogglePage}
                      onReorderSiblings={handleReorderArticleSiblings}
                      dragHandleProps={dragHandleProps}
                    />
                  )}
                </SortableItem>
              )}
            </SortableList>
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
          {artLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : articles && articles.length > 0 ? (
            <>
              <SortableList<LandingArticle>
                items={pagedArticles}
                onReorder={handleReorderArticlesPage}
                className="space-y-2"
              >
                {(a, idx) => {
                  const pageItemsCount = Math.min(ARTICLE_PAGE_SIZE, articles.length - (articlePage - 1) * ARTICLE_PAGE_SIZE);
                  const totalPages = Math.ceil(articles.length / ARTICLE_PAGE_SIZE);
                  const isFirst = idx === 0;
                  const isLast = idx === pageItemsCount - 1;
                  const hasPrev = articlePage > 1;
                  const hasNext = articlePage < totalPages;
                  return (
                  <SortableItem key={a.id} id={a.id}>
                    {({ dragHandleProps }) => (
                      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                        <DragHandle
                          dragHandleProps={dragHandleProps}
                          className="h-8 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none shrink-0"
                        />
                        {isFirst && hasPrev && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Chuyển lên trang trước"
                            onClick={() => handleMoveArticleAcrossPage(a.id, 'prev')}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
                      {isLast && hasNext && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2 gap-1"
                          title="Chuyển xuống trang sau"
                          onClick={() => handleMoveArticleAcrossPage(a.id, 'next')}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                          Trang sau
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditArticle(a)}
                        disabled={loadingEditArticleId === a.id}
                      >
                        {loadingEditArticleId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Edit2 className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteArticle(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                      </div>
                    )}
                  </SortableItem>
                  );
                }}
              </SortableList>
              <ListPagination
                currentPage={articlePage}
                totalItems={articles.length}
                pageSize={ARTICLE_PAGE_SIZE}
                onPageChange={setArticlePage}
              />
            </>
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
                  {flatCategoriesForSelect
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

      {/* ─── Trang Thêm/Sửa bài viết (full-screen) ─── */}
      {articleDialog && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header sticky */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => setArticleDialog(false)} className="gap-1">
                ← Quay lại
              </Button>
              <h2 className="text-base sm:text-lg font-semibold truncate">
                {editingArticle ? 'Sửa bài viết' : 'Thêm bài viết mới'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setArticleDialog(false)}>Huỷ</Button>
              <Button size="sm" onClick={handleSaveArticle} disabled={!form.title.trim() || createArticle.isPending || updateArticle.isPending}>
                {(createArticle.isPending || updateArticle.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingArticle ? 'Cập nhật' : 'Thêm'}
              </Button>
            </div>
          </div>
          {/* Body scroll */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <div className="mx-auto w-full max-w-7xl grid gap-4 lg:gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* ===== CỘT TRÁI (sidebar) ===== */}
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start order-2 lg:order-1">
              {/* Ảnh đại diện */}
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <Label className="text-sm font-semibold">🖼️ Ảnh đại diện</Label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {form.thumbnail_url ? (
                  <div className="relative inline-block">
                    <img src={form.thumbnail_url} alt="" className="h-24 rounded-lg object-cover border" />
                    <button onClick={() => setForm(p => ({ ...p, thumbnail_url: '' }))} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5 w-full">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload ảnh
                </Button>
              </div>

              {/* Trạng thái hiển thị */}
              <div className="rounded-lg border bg-card p-3 space-y-3">
                <Label className="text-sm font-semibold">⚙️ Trạng thái hiển thị</Label>
                <div className="flex items-center justify-between">
                  <Label>Xuất bản</Label>
                  <Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label>Bài viết nổi bật</Label>
                    <p className="text-[10px] text-muted-foreground leading-tight">Hiển thị lớn, ưu tiên đầu trang tin tức</p>
                  </div>
                  <Switch checked={form.is_featured} onCheckedChange={v => setForm(p => ({ ...p, is_featured: v }))} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label className="flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> Hiển thị trang chủ</Label>
                    <p className="text-[10px] text-muted-foreground leading-tight">Đưa bài viết ra trang chủ website</p>
                  </div>
                  <Switch checked={form.is_featured_home} onCheckedChange={v => setForm(p => ({ ...p, is_featured_home: v }))} />
                </div>
              </div>
            </aside>

            {/* ===== CỘT GIỮA (form chính) ===== */}
            <div className="space-y-4 min-w-0 order-1 lg:order-2">
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
                  {flatCategoriesForSelect.map(c => (
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
              <Label className="flex items-center justify-between">
                <span>Mô tả SEO (Google search)</span>
                <span className={cn(
                  'text-xs font-normal',
                  (form.seo_description?.length || 0) > 160 ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {form.seo_description?.length || 0}/160
                </span>
              </Label>
              <textarea
                value={form.seo_description}
                onChange={e => setForm(p => ({ ...p, seo_description: e.target.value }))}
                placeholder="Mô tả ngắn gọn nội dung bài viết, hiển thị trên Google tìm kiếm. Tối ưu 120-160 ký tự."
                rows={2}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {/* Google preview */}
              {(form.title || form.seo_description) && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">🔍 Xem trước trên Google</p>
                  <p className="text-[11px] text-green-700 dark:text-green-500 truncate">
                    {typeof window !== 'undefined' ? window.location.host : 'website.vn'} › tin-tuc
                  </p>
                  <p className="text-base text-blue-700 dark:text-blue-400 font-medium leading-snug line-clamp-1">
                    {form.title || 'Tiêu đề bài viết'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                    {form.seo_description || form.summary || 'Mô tả SEO sẽ hiển thị ở đây...'}
                  </p>
                </div>
              )}
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
                <Suspense fallback={<div className="rounded-md border p-4 text-sm text-muted-foreground">Đang tải trình soạn thảo...</div>}>
                  <LazyRichTextEditor value={form.content} onChange={v => setForm(p => ({ ...p, content: v }))} />
                </Suspense>
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
          </div>
          {/* Footer sticky */}
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
            <Button variant="outline" onClick={() => setArticleDialog(false)}>Huỷ</Button>
            <Button onClick={handleSaveArticle} disabled={!form.title.trim() || createArticle.isPending || updateArticle.isPending}>
              {(createArticle.isPending || updateArticle.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingArticle ? 'Cập nhật' : 'Thêm'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
