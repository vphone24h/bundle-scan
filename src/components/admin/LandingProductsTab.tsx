import { useState, useRef, useMemo, useCallback } from 'react';
import {
  useLandingProductCategories,
  useCreateLandingProductCategory,
  useDeleteLandingProductCategory,
  useUpdateLandingProductCategory,
  useReorderLandingProductCategories,
  useReorderLandingProducts,
  useLandingProducts,
  useCreateLandingProduct,
  useUpdateLandingProduct,
  useDeleteLandingProduct,
  uploadLandingProductImage,
  LandingProduct,
  LandingProductVariant,
  LandingProductCategory,
  VariantOption,
  VariantPriceEntry,
} from '@/hooks/useLandingProducts';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useTenantLandingSettings } from '@/hooks/useTenantLanding';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit2, Loader2, Upload, X, FolderPlus, Package, ImagePlus, Warehouse, Info, ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { PriceInput } from '@/components/ui/price-input';
import { ImportFromWarehouseDialog } from './ImportFromWarehouseDialog';
import { ListPagination, paginateArray } from '@/components/ui/list-pagination';

// Helper: build tree from flat categories
function buildCategoryTree(categories: LandingProductCategory[]): LandingProductCategory[] {
  const map = new Map<string, LandingProductCategory>();
  const roots: LandingProductCategory[] = [];
  categories.forEach(c => map.set(c.id, { ...c, children: [] }));
  categories.forEach(c => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// Helper: flatten tree for select with indentation
function flattenCategoriesForSelect(categories: LandingProductCategory[], level = 0): { id: string; name: string; level: number }[] {
  const result: { id: string; name: string; level: number }[] = [];
  for (const cat of categories) {
    result.push({ id: cat.id, name: cat.name, level });
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenCategoriesForSelect(cat.children, level + 1));
    }
  }
  return result;
}
// Category tree node component
function CategoryTreeNode({
  categories, level, onEdit, onAddChild, onDelete, onUploadImage, onRemoveImage, uploadingCatId, onToggleHidden, onMoveUp, onMoveDown,
}: {
  categories: LandingProductCategory[];
  level: number;
  onEdit: (cat: LandingProductCategory) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (cat: LandingProductCategory) => void;
  onUploadImage: (catId: string) => void;
  onRemoveImage: (catId: string) => void;
  uploadingCatId: string | null;
  onToggleHidden: (cat: LandingProductCategory) => void;
  onMoveUp: (cat: LandingProductCategory, siblings: LandingProductCategory[]) => void;
  onMoveDown: (cat: LandingProductCategory, siblings: LandingProductCategory[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <>
      {categories.map((cat, idx) => {
        const hasChildren = cat.children && cat.children.length > 0;
        const isExpanded = expanded[cat.id] !== false; // default expanded
        const isFirst = idx === 0;
        const isLast = idx === categories.length - 1;
        return (
          <div key={cat.id}>
            <div className={`flex flex-wrap items-center gap-1.5 py-2 px-2 rounded-lg hover:bg-muted/50 group ${level > 0 ? 'ml-5' : ''}`}>
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [cat.id]: !isExpanded }))}
                className={`h-6 w-6 flex items-center justify-center rounded hover:bg-muted shrink-0 ${!hasChildren ? 'invisible' : ''}`}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <button
                onClick={() => onUploadImage(cat.id)}
                className="shrink-0 h-10 w-10 rounded-lg border border-dashed border-border overflow-hidden flex items-center justify-center bg-muted/30 hover:bg-muted/60 transition-colors"
                disabled={uploadingCatId === cat.id}
              >
                {uploadingCatId === cat.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-[80px] flex-1">
                <p className={`font-medium text-sm break-words ${cat.is_hidden ? 'text-muted-foreground line-through' : ''}`}>{cat.name}</p>
                {hasChildren && <p className="text-[10px] text-muted-foreground">{cat.children!.length} danh mục con</p>}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {/* Move up/down */}
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isFirst} onClick={() => onMoveUp(cat, categories)} title="Di chuyển lên">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isLast} onClick={() => onMoveDown(cat, categories)} title="Di chuyển xuống">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${cat.is_hidden ? 'text-muted-foreground' : 'text-primary'}`}
                  onClick={() => onToggleHidden(cat)}
                  title={cat.is_hidden ? 'Hiện danh mục trên website' : 'Ẩn danh mục trên website'}
                >
                  {cat.is_hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddChild(cat.id)} title="Thêm danh mục con">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(cat)} title="Sửa">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {cat.image_url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onRemoveImage(cat.id)} title="Xóa ảnh">
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(cat)} title="Xóa">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            {hasChildren && isExpanded && (
              <CategoryTreeNode
                categories={cat.children!}
                level={level + 1}
                onEdit={onEdit}
                onAddChild={onAddChild}
                onDelete={onDelete}
                onUploadImage={onUploadImage}
                onRemoveImage={onRemoveImage}
                uploadingCatId={uploadingCatId}
                onToggleHidden={onToggleHidden}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export function LandingProductsTab() {
  const { data: tenant } = useCurrentTenant();
  const { data: landingSettings } = useTenantLandingSettings();
  const { data: categories, isLoading: catLoading } = useLandingProductCategories();
  const createCat = useCreateLandingProductCategory();
  const deleteCat = useDeleteLandingProductCategory();
  const updateCat = useUpdateLandingProductCategory();
  const { data: products, isLoading: prodLoading } = useLandingProducts();
  const createProduct = useCreateLandingProduct();
  const updateProduct = useUpdateLandingProduct();
  const deleteProduct = useDeleteLandingProduct();

  const reorderCats = useReorderLandingProductCategories();
  const reorderProds = useReorderLandingProducts();

  const [catName, setCatName] = useState('');
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<LandingProductCategory | null>(null);
  const [catParentId, setCatParentId] = useState<string>('_none_');
  const [catEditName, setCatEditName] = useState('');
  const [warehouseDialog, setWarehouseDialog] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LandingProduct | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingCatId, setUploadingCatId] = useState<string | null>(null);
  const [uploadingVariantIdx, setUploadingVariantIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const variantFileRef = useRef<HTMLInputElement>(null);
  const catImageRef = useRef<HTMLInputElement>(null);
  const [pendingCatId, setPendingCatId] = useState<string | null>(null);
  const [productPage, setProductPage] = useState(1);
  const PRODUCT_PAGE_SIZE = 20;
  const [pendingVariantIdx, setPendingVariantIdx] = useState<number | null>(null);

  const categoryTree = useMemo(() => buildCategoryTree(categories || []), [categories]);
  const flatCategories = useMemo(() => flattenCategoriesForSelect(categoryTree), [categoryTree]);

  const customProductTabs = (landingSettings as any)?.custom_product_tabs || [];

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    sale_price: null as number | null,
    category_id: '_none_',
    image_url: '',
    images: [] as string[],
    is_featured: false,
    is_active: true,
    variants: [] as LandingProductVariant[],
    home_tab_ids: [] as string[],
    // 2-level variants
    variant_group_1_name: 'Màu sắc',
    variant_group_2_name: 'Dung lượng',
    variant_options_1: [] as VariantOption[],
    variant_options_2: [] as VariantOption[],
    variant_prices: [] as VariantPriceEntry[],
    // Sections
    promotion_title: 'KHUYẾN MÃI',
    promotion_content: '',
    warranty_title: 'BẢO HÀNH',
    warranty_content: '',
  });

  const handleAddCategory = async () => {
    if (!catName.trim()) return;
    try {
      await createCat.mutateAsync({ name: catName.trim() });
      setCatName('');
      toast({ title: 'Đã thêm danh mục' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const openEditCat = (cat: LandingProductCategory) => {
    setEditingCat(cat);
    setCatEditName(cat.name);
    setCatParentId(cat.parent_id || '_none_');
    setCatDialog(true);
  };

  const openAddChildCat = (parentId: string) => {
    setEditingCat(null);
    setCatEditName('');
    setCatParentId(parentId);
    setCatDialog(true);
  };

  const handleSaveCat = async () => {
    if (!catEditName.trim()) return;
    const parentVal = catParentId === '_none_' ? null : catParentId;
    try {
      if (editingCat) {
        await updateCat.mutateAsync({ id: editingCat.id, name: catEditName.trim(), parent_id: parentVal } as any);
        toast({ title: 'Đã cập nhật danh mục' });
      } else {
        await createCat.mutateAsync({ name: catEditName.trim(), parent_id: parentVal });
        toast({ title: 'Đã thêm danh mục' });
      }
      setCatDialog(false);
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setForm({
      name: '', description: '', price: 0, sale_price: null, category_id: '_none_',
      image_url: '', images: [], is_featured: false, is_active: true, variants: [], home_tab_ids: [],
      variant_group_1_name: 'Màu sắc', variant_group_2_name: 'Dung lượng',
      variant_options_1: [], variant_options_2: [], variant_prices: [],
      promotion_title: 'KHUYẾN MÃI', promotion_content: '',
      warranty_title: 'BẢO HÀNH', warranty_content: '',
    });
    setProductDialog(true);
  };

  const openEditProduct = (p: LandingProduct) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      sale_price: p.sale_price,
      category_id: p.category_id || '_none_',
      image_url: p.image_url || '',
      images: Array.isArray(p.images) ? p.images : [],
      is_featured: p.is_featured,
      is_active: p.is_active,
      variants: Array.isArray(p.variants) ? p.variants : [],
      home_tab_ids: Array.isArray((p as any).home_tab_ids) ? (p as any).home_tab_ids : [],
      variant_group_1_name: p.variant_group_1_name || 'Màu sắc',
      variant_group_2_name: p.variant_group_2_name || 'Dung lượng',
      variant_options_1: Array.isArray(p.variant_options_1) ? p.variant_options_1 : [],
      variant_options_2: Array.isArray(p.variant_options_2) ? p.variant_options_2 : [],
      variant_prices: Array.isArray(p.variant_prices) ? p.variant_prices : [],
      promotion_title: p.promotion_title || 'KHUYẾN MÃI',
      promotion_content: p.promotion_content || '',
      warranty_title: p.warranty_title || 'BẢO HÀNH',
      warranty_content: p.warranty_content || '',
    });
    setProductDialog(true);
  };

  const handleUploadImage = async (file: File): Promise<string | null> => {
    if (!tenant?.id) return null;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Ảnh không quá 5MB', variant: 'destructive' });
      return null;
    }
    try {
      return await uploadLandingProductImage(file, tenant.id);
    } catch {
      toast({ title: 'Lỗi upload ảnh', variant: 'destructive' });
      return null;
    }
  };

  const handleMultiImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await handleUploadImage(file);
        if (url) newUrls.push(url);
      }
      setForm(prev => {
        const allImages = [...prev.images, ...newUrls];
        return { ...prev, images: allImages, image_url: allImages[0] || prev.image_url };
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleVariantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pendingVariantIdx === null) return;
    const idx = pendingVariantIdx;
    setUploadingVariantIdx(idx);
    try {
      const url = await handleUploadImage(file);
      if (url) {
        setForm(prev => {
          const variants = [...prev.variants];
          variants[idx] = { ...variants[idx], image_url: url };
          return { ...prev, variants };
        });
      }
    } finally {
      setUploadingVariantIdx(null);
      setPendingVariantIdx(null);
      if (variantFileRef.current) variantFileRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setForm(prev => {
      const images = prev.images.filter((_, i) => i !== idx);
      return { ...prev, images, image_url: images[0] || '' };
    });
  };

  // Auto-generate variant price matrix
  const generateVariantPrices = () => {
    const existing = form.variant_prices;
    const newPrices: VariantPriceEntry[] = [];
    
    if (form.variant_options_1.length === 0) return;
    
    for (const opt1 of form.variant_options_1) {
      if (form.variant_options_2.length > 0) {
        for (const opt2 of form.variant_options_2) {
          const found = existing.find(p => p.option1 === opt1.name && p.option2 === opt2.name);
          newPrices.push(found || { option1: opt1.name, option2: opt2.name, price: form.price, sale_price: 0, stock: 0 });
        }
      } else {
        const found = existing.find(p => p.option1 === opt1.name && !p.option2);
        newPrices.push(found || { option1: opt1.name, price: form.price, sale_price: 0, stock: 0 });
      }
    }
    setForm(p => ({ ...p, variant_prices: newPrices }));
  };

  const handleSaveProduct = async () => {
    if (!form.name.trim()) return;
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description || null,
        price: form.price,
        sale_price: form.sale_price,
        category_id: form.category_id === '_none_' ? null : form.category_id,
        image_url: form.images[0] || form.image_url || null,
        images: form.images,
        is_featured: form.is_featured,
        is_active: form.is_active,
        variants: form.variants,
        home_tab_ids: form.home_tab_ids,
        variant_group_1_name: form.variant_group_1_name,
        variant_group_2_name: form.variant_group_2_name,
        variant_options_1: form.variant_options_1,
        variant_options_2: form.variant_options_2,
        variant_prices: form.variant_prices,
        promotion_title: form.promotion_title,
        promotion_content: form.promotion_content || null,
        warranty_title: form.warranty_title,
        warranty_content: form.warranty_content || null,
      };
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, ...payload });
        toast({ title: 'Đã cập nhật sản phẩm' });
      } else {
        await createProduct.mutateAsync(payload);
        toast({ title: 'Đã thêm sản phẩm' });
      }
      setProductDialog(false);
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Xoá sản phẩm này?')) return;
    try {
      await deleteProduct.mutateAsync(id);
      toast({ title: 'Đã xoá sản phẩm' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const handleMoveCat = async (cat: LandingProductCategory, siblings: LandingProductCategory[], direction: 'up' | 'down') => {
    const idx = siblings.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const updates = [
      { id: siblings[idx].id, display_order: siblings[swapIdx].display_order },
      { id: siblings[swapIdx].id, display_order: siblings[idx].display_order },
    ];
    // If both have same display_order, use index-based
    if (updates[0].display_order === updates[1].display_order) {
      updates[0].display_order = swapIdx;
      updates[1].display_order = idx;
    }
    await reorderCats.mutateAsync(updates);
  };

  const handleMoveProduct = async (idx: number, direction: 'up' | 'down') => {
    if (!products) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= products.length) return;
    const updates = [
      { id: products[idx].id, display_order: products[swapIdx].display_order },
      { id: products[swapIdx].id, display_order: products[idx].display_order },
    ];
    if (updates[0].display_order === updates[1].display_order) {
      updates[0].display_order = swapIdx;
      updates[1].display_order = idx;
    }
    await reorderProds.mutateAsync(updates);
  };

  if (catLoading || prodLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Hidden input for category cover image */}
      <input
        ref={catImageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !pendingCatId || !tenant?.id) return;
          setUploadingCatId(pendingCatId);
          try {
            const url = await uploadLandingProductImage(file, tenant.id);
            await updateCat.mutateAsync({ id: pendingCatId, image_url: url });
            toast({ title: 'Đã cập nhật ảnh bìa' });
          } catch (err: any) {
            toast({ title: 'Lỗi upload', description: err.message, variant: 'destructive' });
          } finally {
            setUploadingCatId(null);
            setPendingCatId(null);
            if (catImageRef.current) catImageRef.current.value = '';
          }
        }}
      />

      {/* Danh mục sản phẩm */}
      <Card data-tour="landing-products-category">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderPlus className="h-4 w-4" />
              Danh mục sản phẩm
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setEditingCat(null); setCatEditName(''); setCatParentId('_none_'); setCatDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Thêm
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Quick add */}
          <div className="flex gap-2">
            <Input
              value={catName}
              onChange={e => setCatName(e.target.value)}
              placeholder="Thêm nhanh danh mục gốc..."
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} disabled={!catName.trim() || createCat.isPending} size="sm">
              {createCat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          {/* Category tree */}
          <div className="space-y-1">
            {categoryTree.length > 0 ? (
              <CategoryTreeNode
                categories={categoryTree}
                level={0}
                onEdit={openEditCat}
                onAddChild={openAddChildCat}
                onDelete={async (cat) => { if (confirm(`Xoá danh mục "${cat.name}"?`)) deleteCat.mutate(cat.id); }}
                onUploadImage={(catId) => { setPendingCatId(catId); catImageRef.current?.click(); }}
                onRemoveImage={async (catId) => { await updateCat.mutateAsync({ id: catId, image_url: null }); toast({ title: 'Đã xóa ảnh bìa' }); }}
                uploadingCatId={uploadingCatId}
                onToggleHidden={async (cat) => {
                  await updateCat.mutateAsync({ id: cat.id, is_hidden: !cat.is_hidden } as any);
                  toast({ title: cat.is_hidden ? 'Đã hiện danh mục' : 'Đã ẩn danh mục' });
                }}
                onMoveUp={(cat, siblings) => handleMoveCat(cat, siblings, 'up')}
                onMoveDown={(cat, siblings) => handleMoveCat(cat, siblings, 'down')}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Chưa có danh mục nào</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog thêm/sửa danh mục */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Sửa danh mục' : 'Thêm danh mục'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên danh mục</Label>
              <Input value={catEditName} onChange={e => setCatEditName(e.target.value)} placeholder="Nhập tên danh mục" />
            </div>
            <div className="space-y-2">
              <Label>Danh mục cha</Label>
              <Select value={catParentId} onValueChange={setCatParentId}>
                <SelectTrigger><SelectValue placeholder="Chọn danh mục cha" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">Không có (danh mục gốc)</SelectItem>
                  {flatCategories.filter(c => c.id !== editingCat?.id).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {'— '.repeat(c.level)}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Huỷ</Button>
            <Button onClick={handleSaveCat} disabled={!catEditName.trim() || createCat.isPending || updateCat.isPending}>
              {(createCat.isPending || updateCat.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCat ? 'Cập nhật' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Danh sách sản phẩm */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Sản phẩm ({products?.length || 0})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={() => setWarehouseDialog(true)} size="sm" variant="outline" className="gap-1">
                <Warehouse className="h-4 w-4" />
                Thêm từ kho
              </Button>
              <Button onClick={openAddProduct} size="sm" className="gap-1" data-tour="landing-products-add-btn">
                <Plus className="h-4 w-4" />
                Thêm sản phẩm
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {products && products.length > 0 ? (
            <div className="space-y-2">
              {products.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  {/* Move up/down */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0 || reorderProds.isPending} onClick={() => handleMoveProduct(idx, 'up')}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === products.length - 1 || reorderProds.isPending} onClick={() => handleMoveProduct(idx, 'down')}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-lg object-cover border" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {p.sale_price ? (
                        <>
                          <span className="line-through">{formatNumber(p.price)}đ</span>
                          <span className="text-destructive font-medium">{formatNumber(p.sale_price)}đ</span>
                        </>
                      ) : (
                        <span>{formatNumber(p.price)}đ</span>
                      )}
                      {!p.is_active && <Badge variant="outline" className="text-[10px]">Ẩn</Badge>}
                      {p.is_featured && <Badge variant="default" className="text-[10px]">Nổi bật</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditProduct(p)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteProduct(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để bắt đầu.</p>
          )}
        </CardContent>
      </Card>

      {/* Hidden file inputs */}
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleMultiImageUpload} className="hidden" />
      <input ref={variantFileRef} type="file" accept="image/*" onChange={handleVariantImageUpload} className="hidden" />

      {/* Dialog thêm/sửa sản phẩm */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            <div className="space-y-2">
              <Label>Tên sản phẩm *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="iPhone 17 Pro Max..." />
            </div>
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">Không phân loại</SelectItem>
                  {flatCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {'— '.repeat(c.level)}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Giá gốc</Label>
                <PriceInput value={form.price} onChange={v => setForm(p => ({ ...p, price: v }))} />
              </div>
              <div className="space-y-2">
                <Label>Giá khuyến mãi</Label>
                <PriceInput value={form.sale_price ?? 0} onChange={v => setForm(p => ({ ...p, sale_price: v || null }))} placeholder="Để trống nếu không" />
              </div>
            </div>

            {/* ===== BIẾN THỂ 2 CẤP ===== */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Biến thể sản phẩm (2 cấp)</Label>
              </div>
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                VD biến thể cấp 1: Màu sắc / Loại máy / Phiên bản. VD cấp 2: Dung lượng / Size / RAM / Bộ nhớ.
              </p>

              {/* Group 1 */}
              <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">Tên cấp 1:</Label>
                  <Input
                    value={form.variant_group_1_name}
                    onChange={e => setForm(p => ({ ...p, variant_group_1_name: e.target.value }))}
                    placeholder="VD: Màu sắc"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  {form.variant_options_1.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={opt.name}
                        onChange={e => {
                          const opts = [...form.variant_options_1];
                          opts[i] = { ...opts[i], name: e.target.value };
                          setForm(p => ({ ...p, variant_options_1: opts }));
                        }}
                        placeholder={`Giá trị ${i + 1}`}
                        className="h-8 text-sm flex-1"
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => setForm(p => ({ ...p, variant_options_1: p.variant_options_1.filter((_, j) => j !== i) }))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setForm(p => ({ ...p, variant_options_1: [...p.variant_options_1, { name: '' }] }))}>
                    <Plus className="h-3 w-3" /> Thêm
                  </Button>
                </div>
              </div>

              {/* Group 2 */}
              <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">Tên cấp 2:</Label>
                  <Input
                    value={form.variant_group_2_name}
                    onChange={e => setForm(p => ({ ...p, variant_group_2_name: e.target.value }))}
                    placeholder="VD: Dung lượng"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  {form.variant_options_2.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={opt.name}
                        onChange={e => {
                          const opts = [...form.variant_options_2];
                          opts[i] = { ...opts[i], name: e.target.value };
                          setForm(p => ({ ...p, variant_options_2: opts }));
                        }}
                        placeholder={`Giá trị ${i + 1}`}
                        className="h-8 text-sm flex-1"
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => setForm(p => ({ ...p, variant_options_2: p.variant_options_2.filter((_, j) => j !== i) }))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setForm(p => ({ ...p, variant_options_2: [...p.variant_options_2, { name: '' }] }))}>
                    <Plus className="h-3 w-3" /> Thêm
                  </Button>
                </div>
              </div>

              {/* Generate price matrix button */}
              {form.variant_options_1.length > 0 && (
                <Button variant="outline" size="sm" onClick={generateVariantPrices} className="gap-1">
                  🔄 Tạo bảng giá biến thể
                </Button>
              )}

              {/* Price matrix */}
              {form.variant_prices.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Bảng giá theo biến thể</Label>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {form.variant_prices.map((vp, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded border bg-card text-xs">
                        <span className="font-medium shrink-0 w-28 truncate">
                          {vp.option1}{vp.option2 ? ` / ${vp.option2}` : ''}
                        </span>
                        <PriceInput
                          value={vp.price}
                          onChange={val => {
                            const prices = [...form.variant_prices];
                            prices[i] = { ...prices[i], price: val };
                            setForm(p => ({ ...p, variant_prices: prices }));
                          }}
                          className="h-7 text-xs flex-1"
                          placeholder="Giá"
                        />
                        <PriceInput
                          value={vp.sale_price || 0}
                          onChange={val => {
                            const prices = [...form.variant_prices];
                            prices[i] = { ...prices[i], sale_price: val || undefined };
                            setForm(p => ({ ...p, variant_prices: prices }));
                          }}
                          className="h-7 text-xs flex-1"
                          placeholder="Giá KM"
                        />
                        <Input
                          type="number"
                          value={vp.stock || ''}
                          onChange={e => {
                            const prices = [...form.variant_prices];
                            prices[i] = { ...prices[i], stock: parseInt(e.target.value) || 0 };
                            setForm(p => ({ ...p, variant_prices: prices }));
                          }}
                          className="h-7 text-xs w-16"
                          placeholder="SL"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Legacy single-level variants (backward compat) */}
            {form.variant_options_1.length === 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Biến thể đơn giản (cũ)</Label>
                  <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs"
                    onClick={() => setForm(p => ({ ...p, variants: [...p.variants, { name: '', price: 0 }] }))}>
                    <Plus className="h-3 w-3" /> Thêm
                  </Button>
                </div>
                {form.variants.length > 0 && (
                  <div className="space-y-2">
                    {form.variants.map((v, i) => (
                      <div key={i} className="p-2 rounded-lg border bg-muted/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input value={v.name} onChange={e => { const variants = [...form.variants]; variants[i] = { ...variants[i], name: e.target.value }; setForm(p => ({ ...p, variants })); }} placeholder="VD: 256GB Zin đẹp" className="flex-1 h-8 text-sm" />
                          <PriceInput value={v.price} onChange={val => { const variants = [...form.variants]; variants[i] = { ...variants[i], price: val }; setForm(p => ({ ...p, variants })); }} className="w-32 h-8 text-sm" />
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => setForm(p => ({ ...p, variants: p.variants.filter((_, j) => j !== i) }))}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 pl-1">
                          {v.image_url ? (
                            <div className="relative">
                              <img src={v.image_url} alt="" className="h-10 w-10 rounded object-cover border" />
                              <button onClick={() => { const variants = [...form.variants]; variants[i] = { ...variants[i], image_url: undefined }; setForm(p => ({ ...p, variants })); }}
                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={uploadingVariantIdx === i}
                              onClick={() => { setPendingVariantIdx(i); variantFileRef.current?.click(); }}>
                              {uploadingVariantIdx === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                              Ảnh biến thể
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== KHUYẾN MÃI ===== */}
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">🎁 Khung khuyến mãi</Label>
              </div>
              <Input
                value={form.promotion_title}
                onChange={e => setForm(p => ({ ...p, promotion_title: e.target.value }))}
                placeholder="KHUYẾN MÃI"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Có thể đổi tên: Ưu đãi hôm nay, Quà tặng kèm, Deal đặc biệt...</p>
              <RichTextEditor
                value={form.promotion_content}
                onChange={v => setForm(p => ({ ...p, promotion_content: v }))}
                placeholder="Nội dung khuyến mãi..."
                minHeight="100px"
              />
            </div>

            {/* ===== BẢO HÀNH ===== */}
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">🛡️ Khung bảo hành</Label>
              </div>
              <Input
                value={form.warranty_title}
                onChange={e => setForm(p => ({ ...p, warranty_title: e.target.value }))}
                placeholder="BẢO HÀNH"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Có thể đổi tên: Chính sách bảo hành, Cam kết cửa hàng, Hậu mãi...</p>
              <RichTextEditor
                value={form.warranty_content}
                onChange={v => setForm(p => ({ ...p, warranty_content: v }))}
                placeholder="Nội dung bảo hành..."
                minHeight="100px"
              />
            </div>

            {/* ===== MÔ TẢ ===== */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">📝 Mô tả sản phẩm</Label>
              <RichTextEditor
                value={form.description}
                onChange={v => setForm(p => ({ ...p, description: v }))}
                placeholder="Mô tả chi tiết sản phẩm..."
                minHeight="150px"
              />
            </div>

            {/* Multiple images */}
            <Separator />
            <div className="space-y-2">
              <Label>Hình ảnh sản phẩm (ảnh đầu tiên = ảnh chính)</Label>
              {form.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.images.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img src={url} alt="" className={`h-20 w-20 rounded-lg object-cover border-2 ${idx === 0 ? 'border-primary' : 'border-muted'}`} />
                      {idx === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[9px] text-center py-0.5 rounded-b-lg">Ảnh chính</span>
                      )}
                      <button onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Thêm ảnh
              </Button>
            </div>

            <Separator />

            {/* Hiển thị trên trang chủ */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Hiển thị trên trang chủ</Label>
              <div className="space-y-1.5">
                {[
                  { id: 'flashSale', icon: '⚡', name: 'Flash Sale' },
                  { id: 'combo', icon: '🎁', name: 'Combo ưu đãi' },
                ].map(section => (
                  <label key={section.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.home_tab_ids.includes(section.id)}
                      onCheckedChange={(checked) => {
                        setForm(p => ({
                          ...p,
                          home_tab_ids: checked ? [...p.home_tab_ids, section.id] : p.home_tab_ids.filter(id => id !== section.id)
                        }));
                      }}
                    />
                    <span className="text-sm">{section.icon} {section.name}</span>
                  </label>
                ))}
                {customProductTabs.map((tab: any) => (
                  <label key={tab.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.home_tab_ids.includes(tab.id)}
                      onCheckedChange={(checked) => {
                        setForm(p => ({
                          ...p,
                          home_tab_ids: checked ? [...p.home_tab_ids, tab.id] : p.home_tab_ids.filter((id: string) => id !== tab.id)
                        }));
                      }}
                    />
                    <span className="text-sm">{tab.icon || '📦'} {tab.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Sản phẩm nổi bật</Label>
              <Switch checked={form.is_featured} onCheckedChange={v => setForm(p => ({ ...p, is_featured: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Hiển thị</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(false)}>Huỷ</Button>
            <Button onClick={handleSaveProduct} disabled={!form.name.trim() || createProduct.isPending || updateProduct.isPending}>
              {(createProduct.isPending || updateProduct.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? 'Cập nhật' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nhập từ kho */}
      <ImportFromWarehouseDialog
        open={warehouseDialog}
        onOpenChange={setWarehouseDialog}
        existingProducts={products || []}
      />
    </div>
  );
}
