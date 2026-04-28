import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
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
  getLandingProductById,
  LandingProduct,
  LandingProductVariant,
  LandingProductCategory,
  VariantOption,
  VariantPriceEntry,
  useProductPackageGroups,
  useSavePackageGroups,
  LandingProductPackage,
  PackageGroupWithItems,
  VariantGroup,
  MAX_VARIANT_LEVELS,
  getVariantGroups,
} from '@/hooks/useLandingProducts';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useTenantLandingSettings, useUpdateTenantLandingSettings } from '@/hooks/useTenantLanding';
import { getIndustryConfig } from '@/lib/industryConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { BADGE_POSITION_MAP, LayoutProductCard, EXTRA_DISCOUNT_COLORS } from '@/components/website-templates/layouts/ProductCardVariants';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit2, Loader2, Upload, X, FolderPlus, Package, ImagePlus, Warehouse, Info, ChevronRight, ChevronDown, ChevronUp, Folder, FolderOpen, Pencil, Eye, EyeOff, ArrowUp, ArrowDown, CalendarDays, Tag, Check, Home, List } from 'lucide-react';
import { SortableList, SortableItem, DragHandle } from '@/components/shared/SortableList';
import { formatNumber } from '@/lib/formatNumber';
import { BlockedDatesCalendar } from './BlockedDatesCalendar';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { PriceInput } from '@/components/ui/price-input';
import { ImportFromWarehouseDialog } from './ImportFromWarehouseDialog';
import { ListPagination, paginateArray } from '@/components/ui/list-pagination';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

// Badge options for products
const PRODUCT_BADGE_OPTIONS = [
  { id: 'new', label: '🆕 Hàng mới', color: 'bg-red-500', text: 'NEW' },
  { id: 'hot', label: '🔥 Hàng hot', color: 'bg-orange-500', text: 'HOT' },
  { id: 'trending', label: '📈 Trending', color: 'bg-purple-500', text: 'Trending' },
  { id: 'popular', label: '👀 Được quan tâm', color: 'bg-blue-500', text: 'Quan tâm' },
  { id: 'best_choice', label: '👍 Đề xuất', color: 'bg-emerald-500', text: 'Đề xuất' },
  { id: 'sale', label: '💥 Giảm giá sốc', color: 'bg-red-600', text: 'SALE' },
  { id: 'deal', label: '💰 Deal hôm nay', color: 'bg-amber-500', text: 'Deal' },
  { id: 'clearance', label: '📦 Xả kho', color: 'bg-rose-600', text: 'Xả kho' },
  { id: 'genuine', label: '✅ Chính hãng', color: 'bg-green-600', text: 'Chính hãng' },
  { id: 'warranty', label: '🛡️ Bảo hành tốt', color: 'bg-teal-500', text: 'BH tốt' },
  { id: 'quality', label: '⭐ Chất lượng cao', color: 'bg-indigo-500', text: 'CL cao' },
  { id: 'preorder', label: '🚀 Pre-order', color: 'bg-violet-500', text: 'Pre-order' },
  { id: 'limited', label: '💎 Limited', color: 'bg-pink-600', text: 'Limited' },
  { id: 'exclusive', label: '👑 Độc quyền', color: 'bg-yellow-600', text: 'Độc quyền' },
  // === Bán cực mạnh ===
  { id: 'best_seller', label: '🏆 Bán chạy nhất', color: 'bg-red-700', text: 'Best Seller' },
  { id: 'top_1', label: '🥇 Top 1 bán chạy', color: 'bg-yellow-500', text: 'TOP 1' },
  { id: 'hot_deal', label: '🔥 Hot Deal', color: 'bg-orange-600', text: 'Hot Deal' },
  { id: 'shock_deal', label: '⚡ Deal sốc', color: 'bg-red-500', text: 'Deal sốc' },
  { id: 'good_price', label: '💵 Giá hời', color: 'bg-green-500', text: 'Giá hời' },
  { id: 'worth_buy', label: '👌 Đáng mua', color: 'bg-emerald-600', text: 'Đáng mua' },
  { id: 'many_buy', label: '🛒 Mua nhiều', color: 'bg-blue-600', text: 'Mua nhiều' },
  // === FOMO ===
  { id: 'almost_sold', label: '⏳ Sắp hết hàng', color: 'bg-orange-700', text: 'Sắp hết' },
  { id: 'few_left', label: '📉 Chỉ còn vài cái', color: 'bg-red-600', text: 'Còn ít' },
  { id: 'today_hot', label: '🌟 Bán chạy hôm nay', color: 'bg-amber-600', text: 'Hot hôm nay' },
  { id: 'limited_deal', label: '🎯 Deal giới hạn', color: 'bg-rose-700', text: 'Deal giới hạn' },
  { id: 'flash_sale', label: '⚡ Flash Sale 24h', color: 'bg-red-600', text: 'Flash Sale' },
  { id: 'price_up_soon', label: '📈 Sắp tăng giá', color: 'bg-orange-600', text: 'Sắp tăng giá' },
  // === Cao cấp ===
  { id: 'premium', label: '💎 Cao cấp', color: 'bg-slate-800', text: 'Cao cấp' },
  { id: 'premium_en', label: '✨ Premium', color: 'bg-zinc-800', text: 'Premium' },
  { id: 'flagship', label: '🚩 Flagship', color: 'bg-neutral-900', text: 'Flagship' },
  { id: 'super_product', label: '🌠 Siêu phẩm', color: 'bg-purple-700', text: 'Siêu phẩm' },
  { id: 'must_own', label: '🎖️ Đáng sở hữu', color: 'bg-indigo-700', text: 'Đáng sở hữu' },
  { id: 'top_tier', label: '🏔️ Đỉnh cao', color: 'bg-cyan-700', text: 'Đỉnh cao' },
  // === Hỗ trợ quyết định ===
  { id: 'high_rated', label: '⭐ Được đánh giá cao', color: 'bg-yellow-600', text: 'Đánh giá cao' },
  { id: 'good_review', label: '📝 Review tốt', color: 'bg-lime-600', text: 'Review tốt' },
  { id: 'customer_pick', label: '❤️ Khách chọn nhiều', color: 'bg-pink-500', text: 'Khách chọn' },
  { id: 'staff_pick', label: '👨‍💼 Nhân viên khuyên dùng', color: 'bg-sky-600', text: 'NV khuyên dùng' },
  { id: 'worth_money', label: '💯 Đáng tiền', color: 'bg-teal-600', text: 'Đáng tiền' },
  // === Marketing nâng cao ===
  { id: 'new_today', label: '📅 Mới về hôm nay', color: 'bg-fuchsia-600', text: 'Mới hôm nay' },
  { id: 'just_updated', label: '🔄 Vừa cập nhật', color: 'bg-cyan-600', text: 'Vừa cập nhật' },
  { id: 'rare', label: '🦄 Hàng hiếm', color: 'bg-violet-700', text: 'Hàng hiếm' },
  { id: 'limited_stock', label: '📦 Limited stock', color: 'bg-rose-600', text: 'Limited stock' },
  { id: 'unique', label: '🌈 Độc lạ', color: 'bg-pink-700', text: 'Độc lạ' },
  { id: 'new_version', label: '🆕 Phiên bản mới', color: 'bg-blue-700', text: 'Bản mới' },
  // === Giá & ưu đãi ===
  { id: 'best_price', label: '💲 Giá tốt nhất', color: 'bg-green-700', text: 'Giá tốt nhất' },
  { id: 'internal_price', label: '🔒 Giá nội bộ', color: 'bg-zinc-700', text: 'Giá nội bộ' },
  { id: 'wholesale_price', label: '📊 Giá sỉ', color: 'bg-emerald-700', text: 'Giá sỉ' },
  { id: 'combo_save', label: '🎁 Combo tiết kiệm', color: 'bg-amber-700', text: 'Combo' },
  { id: 'free_gift', label: '🎀 Tặng kèm', color: 'bg-pink-600', text: 'Tặng kèm' },
  { id: 'special_offer', label: '🎊 Ưu đãi riêng', color: 'bg-fuchsia-700', text: 'Ưu đãi riêng' },
];

export { PRODUCT_BADGE_OPTIONS };

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
  categories, level, onEdit, onAddChild, onDelete, onUploadImage, onRemoveImage, uploadingCatId, onToggleHome, onTogglePage, onReorderSiblings,
}: {
  categories: LandingProductCategory[];
  level: number;
  onEdit: (cat: LandingProductCategory) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (cat: LandingProductCategory) => void;
  onUploadImage: (catId: string) => void;
  onRemoveImage: (catId: string) => void;
  uploadingCatId: string | null;
  onToggleHome: (cat: LandingProductCategory) => void;
  onTogglePage: (cat: LandingProductCategory) => void;
  onReorderSiblings: (siblings: LandingProductCategory[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <SortableList<LandingProductCategory>
      items={categories}
      onReorder={onReorderSiblings}
    >
      {(cat, idx) => {
        const hasChildren = cat.children && cat.children.length > 0;
        const isExpanded = expanded[cat.id] !== false; // default expanded
        const hiddenHome = (cat as any).hidden_from_home === true;
        const hiddenPage = (cat as any).hidden_from_products_page === true;
        const fullyHidden = hiddenHome && hiddenPage;
        return (
          <SortableItem key={cat.id} id={cat.id}>
            {({ dragHandleProps }) => (
            <div>
            <div className={`flex flex-wrap items-center gap-1.5 py-2 px-2 rounded-lg hover:bg-muted/50 group ${level > 0 ? 'ml-5' : ''}`}>
              <DragHandle dragHandleProps={dragHandleProps} className="h-7 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none shrink-0" />
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
                <p className={`font-medium text-sm break-words ${fullyHidden ? 'text-muted-foreground line-through' : ''}`}>{cat.name}</p>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {hasChildren && <p className="text-[10px] text-muted-foreground">{cat.children!.length} danh mục con</p>}
                  {hiddenHome && <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">Ẩn trang chủ</span>}
                  {hiddenPage && <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">Ẩn trang sản phẩm</span>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 relative border ${hiddenHome ? 'bg-destructive/10 border-destructive/40 text-destructive hover:bg-destructive/20' : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'}`}
                  onClick={() => onToggleHome(cat)}
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
                  className={`h-7 w-7 relative border ${hiddenPage ? 'bg-destructive/10 border-destructive/40 text-destructive hover:bg-destructive/20' : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'}`}
                  onClick={() => onTogglePage(cat)}
                  title={hiddenPage ? 'Hiện ở trang sản phẩm' : 'Ẩn khỏi trang sản phẩm'}
                >
                  <List className="h-3.5 w-3.5" />
                  {hiddenPage && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="block h-[1.5px] w-5 bg-destructive rotate-45 rounded" />
                    </span>
                  )}
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
                onToggleHome={onToggleHome}
                onTogglePage={onTogglePage}
                onReorderSiblings={onReorderSiblings}
              />
            )}
            </div>
            )}
          </SortableItem>
        );
      }}
    </SortableList>
  );
}

export function LandingProductsTab() {
  const { data: tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const { data: landingSettings } = useTenantLandingSettings();
  const updateSettings = useUpdateTenantLandingSettings();
  const [catSectionTitle, setCatSectionTitle] = useState('');
  const { data: categories, isLoading: catLoading } = useLandingProductCategories(tenantId);
  const createCat = useCreateLandingProductCategory();
  const deleteCat = useDeleteLandingProductCategory();
  const updateCat = useUpdateLandingProductCategory();
  const { data: products, isLoading: prodLoading } = useLandingProducts(tenantId);
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
  const [blockedDatesProduct, setBlockedDatesProduct] = useState<LandingProduct | null>(null);
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LandingProduct | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingCatId, setUploadingCatId] = useState<string | null>(null);
  const [uploadingVariantIdx, setUploadingVariantIdx] = useState<number | null>(null);
  const [uploadingVariantPriceIdx, setUploadingVariantPriceIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const variantFileRef = useRef<HTMLInputElement>(null);
  const catImageRef = useRef<HTMLInputElement>(null);
  const [pendingCatId, setPendingCatId] = useState<string | null>(null);
  const [productPage, setProductPage] = useState(1);
  const PRODUCT_PAGE_SIZE = 20;
  const [loadingEditProductId, setLoadingEditProductId] = useState<string | null>(null);
  const [pendingVariantIdx, setPendingVariantIdx] = useState<number | null>(null);
  const [pendingVariantPriceIdx, setPendingVariantPriceIdx] = useState<number | null>(null);
  // Multi-group packages state
  type PkgItemForm = {
    name: string;
    price: number;
    description: string;
    image_url: string;
    is_default: boolean;
    is_active: boolean;
    allow_quantity: boolean;
  };
  type PkgGroupForm = {
    name: string;
    selection_mode: 'single' | 'multiple';
    items: PkgItemForm[];
  };
  const [groupsForm, setGroupsForm] = useState<PkgGroupForm[]>([]);
  const savePackageGroups = useSavePackageGroups();
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const { data: existingGroups } = useProductPackageGroups(editingProductId);
  const [pendingPkgImage, setPendingPkgImage] = useState<{ groupIdx: number; itemIdx: number } | null>(null);
  const pkgImageRef = useRef<HTMLInputElement>(null);

  const categoryTree = useMemo(() => buildCategoryTree(categories || []), [categories]);
  const flatCategories = useMemo(() => flattenCategoriesForSelect(categoryTree), [categoryTree]);

  const customProductTabs = (landingSettings as any)?.custom_product_tabs || [];

  // Load groups when editing a product
  useEffect(() => {
    if (existingGroups && editingProductId) {
      setGroupsForm(existingGroups.map(g => ({
        // Migrate legacy: use saved package_selection_mode for ungrouped batch
        name: g.isLegacy ? 'Gói bảo hành' : g.name,
        selection_mode: g.isLegacy
          ? ((form.package_selection_mode as 'single' | 'multiple') || 'multiple')
          : g.selection_mode,
        items: g.items.map(p => ({
          name: p.name,
          price: p.price,
          description: p.description || '',
          image_url: p.image_url || '',
          is_default: p.is_default,
          is_active: p.is_active,
          allow_quantity: !!p.allow_quantity,
        })),
      })));
    }
  }, [existingGroups, editingProductId]);

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
    is_sold_out: false,
    variants: [] as LandingProductVariant[],
    home_tab_ids: [] as string[],
    // Variant system (up to 5 levels)
    variant_groups: [] as VariantGroup[],
    // Legacy 2-level fields kept for backward compatibility
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
    package_selection_mode: 'multiple',
    // Promotional
    student_discount_label: 'HỌC SINH SINH VIÊN',
    student_discount_text: '',
    extra_discount_labels: [] as Array<{ label: string; text: string; color?: string }>,
    installment_down_payment: null as number | null,
    seo_description: '',
    sold_count: 0,
    show_sold_count: true,
  });
  // Add badges to form - stored separately to avoid re-init issues
  const [formBadges, setFormBadges] = useState<string[]>([]);
  const [badgeStyle, setBadgeStyle] = useState<'simple' | 'luxury' | 'modern' | 'tiktok'>('simple');

  const [showBadges, setShowBadges] = useState(false);
  const badgesPanelRef = useRef<HTMLDivElement>(null);

  const handleToggleBadges = () => {
    const next = !showBadges;
    setShowBadges(next);
    if (next) {
      // Auto-scroll panel into view so users see the content opens up
      setTimeout(() => {
        badgesPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

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
    setEditingProductId(null);
    setGroupsForm([]);
    setForm({
      name: '', description: '', price: 0, sale_price: null, category_id: '_none_',
      image_url: '', images: [], is_featured: false, is_active: true, is_sold_out: false, variants: [], home_tab_ids: [],
      variant_group_1_name: 'Màu sắc', variant_group_2_name: 'Dung lượng',
      variant_options_1: [], variant_options_2: [], variant_prices: [],
      promotion_title: 'KHUYẾN MÃI', promotion_content: '',
      warranty_title: 'BẢO HÀNH', warranty_content: '',
      package_selection_mode: 'multiple',
      student_discount_label: 'HỌC SINH SINH VIÊN', student_discount_text: '', installment_down_payment: null,
      extra_discount_labels: [],
      seo_description: '',
      sold_count: 0,
      show_sold_count: true,
    });
    setShowBadges(false);
    setFormBadges([]);
    setBadgeStyle('simple');
    setProductDialog(true);
  };

  const openEditProduct = async (p: LandingProduct) => {
    try {
      setLoadingEditProductId(p.id);
      const detail = await getLandingProductById(p.id);
      if (!detail) {
        toast({ title: 'Không tìm thấy sản phẩm', variant: 'destructive' });
        return;
      }

      setEditingProduct(detail);
      setEditingProductId(detail.id);
      setForm({
        name: detail.name,
        description: detail.description || '',
        price: detail.price,
        sale_price: detail.sale_price,
        category_id: detail.category_id || '_none_',
        image_url: detail.image_url || '',
        images: Array.isArray(detail.images) ? detail.images : [],
        is_featured: detail.is_featured,
        is_active: detail.is_active,
        is_sold_out: detail.is_sold_out || false,
        variants: Array.isArray(detail.variants) ? detail.variants : [],
        home_tab_ids: Array.isArray((detail as any).home_tab_ids) ? (detail as any).home_tab_ids : [],
        variant_group_1_name: detail.variant_group_1_name || 'Màu sắc',
        variant_group_2_name: detail.variant_group_2_name || 'Dung lượng',
        variant_options_1: Array.isArray(detail.variant_options_1) ? detail.variant_options_1 : [],
        variant_options_2: Array.isArray(detail.variant_options_2) ? detail.variant_options_2 : [],
        variant_prices: Array.isArray(detail.variant_prices) ? detail.variant_prices : [],
        promotion_title: detail.promotion_title || 'KHUYẾN MÃI',
        promotion_content: detail.promotion_content || '',
        warranty_title: detail.warranty_title || 'BẢO HÀNH',
        warranty_content: detail.warranty_content || '',
        package_selection_mode: (detail as any).package_selection_mode || 'multiple',
        student_discount_label: (detail as any).student_discount_label || 'HỌC SINH SINH VIÊN',
        student_discount_text: (detail as any).student_discount_text || '',
        installment_down_payment: (detail as any).installment_down_payment ?? null,
        extra_discount_labels: Array.isArray((detail as any).extra_discount_labels) ? (detail as any).extra_discount_labels : [],
        seo_description: (detail as any).seo_description || '',
        sold_count: Number((detail as any).sold_count ?? 0),
        show_sold_count: (detail as any).show_sold_count !== false,
      });
      setShowBadges(Array.isArray((detail as any).badges) && (detail as any).badges.length > 0);
      setFormBadges(Array.isArray((detail as any).badges) ? (detail as any).badges : []);
      setBadgeStyle(
        (detail as any).badge_style === 'luxury'
          ? 'luxury'
          : (detail as any).badge_style === 'modern'
          ? 'modern'
          : (detail as any).badge_style === 'tiktok'
          ? 'tiktok'
          : 'simple',
      );
      setProductDialog(true);
    } catch (e: any) {
      toast({ title: 'Lỗi tải sản phẩm', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingEditProductId(null);
    }
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
    const legacyIdx = pendingVariantIdx;
    const matrixIdx = pendingVariantPriceIdx;

    if (!file || (legacyIdx === null && matrixIdx === null)) return;

    if (legacyIdx !== null) setUploadingVariantIdx(legacyIdx);
    if (matrixIdx !== null) setUploadingVariantPriceIdx(matrixIdx);

    try {
      const url = await handleUploadImage(file);
      if (url) {
        setForm(prev => {
          if (legacyIdx !== null) {
            const variants = [...prev.variants];
            variants[legacyIdx] = { ...variants[legacyIdx], image_url: url };
            return { ...prev, variants };
          }

          if (matrixIdx !== null) {
            const variant_prices = [...prev.variant_prices];
            variant_prices[matrixIdx] = { ...variant_prices[matrixIdx], image_url: url };
            return { ...prev, variant_prices };
          }

          return prev;
        });
      }
    } finally {
      setUploadingVariantIdx(null);
      setUploadingVariantPriceIdx(null);
      setPendingVariantIdx(null);
      setPendingVariantPriceIdx(null);
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
    const newPrices: VariantPriceEntry[] = [...existing];
    
    if (form.variant_options_1.length === 0) return;
    
    for (const opt1 of form.variant_options_1) {
      if (form.variant_options_2.length > 0) {
        for (const opt2 of form.variant_options_2) {
          const alreadyExists = existing.find(p => p.option1 === opt1.name && p.option2 === opt2.name);
          if (!alreadyExists) {
            newPrices.push({ option1: opt1.name, option2: opt2.name, price: form.price, sale_price: 0, stock: 0 });
          }
        }
      } else {
        const alreadyExists = existing.find(p => p.option1 === opt1.name && !p.option2);
        if (!alreadyExists) {
          newPrices.push({ option1: opt1.name, price: form.price, sale_price: 0, stock: 0 });
        }
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
        is_sold_out: form.is_sold_out,
        variants: form.variants,
        badges: formBadges,
        badge_style: badgeStyle,
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
        package_selection_mode: form.package_selection_mode,
        student_discount_label: form.student_discount_label || null,
        student_discount_text: form.student_discount_text || null,
        installment_down_payment: form.installment_down_payment,
        extra_discount_labels: (form.extra_discount_labels || []).filter(x => x && (x.text || '').trim()),
        seo_description: form.seo_description?.trim() || null,
        sold_count: Number(form.sold_count) || 0,
        show_sold_count: form.show_sold_count !== false,
      };
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, ...payload });
        // Save package groups
        if (tenantId) {
          await savePackageGroups.mutateAsync({ productId: editingProduct.id, tenantId, groups: groupsForm });
        }
        toast({ title: 'Đã cập nhật sản phẩm' });
        // Giữ popup mở khi cập nhật — chỉ đóng khi user nhấn nút X hoặc Huỷ
      } else {
        const created = await createProduct.mutateAsync(payload);
        // Save package groups for new product
        if (tenantId && (created as any)?.id && groupsForm.length > 0) {
          await savePackageGroups.mutateAsync({ productId: (created as any).id, tenantId, groups: groupsForm });
        }
        toast({ title: 'Đã thêm sản phẩm' });
        setProductDialog(false);
      }
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

  const handleReorderCatSiblings = async (reordered: LandingProductCategory[]) => {
    await reorderCats.mutateAsync(
      reordered.map((c, i) => ({ id: c.id, display_order: i }))
    );
  };

  const handleReorderProductsPage = async (pageItems: typeof products) => {
    if (!products || !pageItems) return;
    const startIdx = (productPage - 1) * PRODUCT_PAGE_SIZE;
    const reordered = [...products];
    // Replace the slice for the current page with the new ordering
    pageItems.forEach((p, i) => {
      reordered[startIdx + i] = p;
    });
    await reorderProds.mutateAsync(
      reordered.map((p, i) => ({ id: p.id, display_order: i }))
    );
  };

  const handleMoveProductAcrossPage = async (
    productId: string,
    direction: 'prev' | 'next'
  ) => {
    if (!products) return;
    const currIdx = products.findIndex(p => p.id === productId);
    if (currIdx < 0) return;
    const reordered = [...products];
    const [item] = reordered.splice(currIdx, 1);
    if (direction === 'next') {
      // Insert as the first item of the next page
      const targetIdx = Math.min(productPage * PRODUCT_PAGE_SIZE, reordered.length);
      reordered.splice(targetIdx, 0, item);
      setProductPage(productPage + 1);
    } else {
      // Insert as the last item of the previous page
      const targetIdx = Math.max((productPage - 1) * PRODUCT_PAGE_SIZE - 1, 0);
      reordered.splice(targetIdx, 0, item);
      setProductPage(Math.max(productPage - 1, 1));
    }
    await reorderProds.mutateAsync(
      reordered.map((p, i) => ({ id: p.id, display_order: i }))
    );
  };

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
          {/* Custom category section title */}
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">Tiêu đề hiển thị trên website</Label>
            <Input
              value={catSectionTitle || (landingSettings as any)?.category_section_title || ''}
              onChange={e => setCatSectionTitle(e.target.value)}
              onBlur={() => {
                if (catSectionTitle !== '' && catSectionTitle !== ((landingSettings as any)?.category_section_title || '')) {
                  updateSettings.mutate({ category_section_title: catSectionTitle } as any);
                }
              }}
              placeholder={getIndustryConfig((landingSettings as any)?.website_template || 'phone_store').categorySectionTitle}
              className="h-8 text-sm mt-1"
            />
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
            {catLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : categoryTree.length > 0 ? (
              <CategoryTreeNode
                categories={categoryTree}
                level={0}
                onEdit={openEditCat}
                onAddChild={openAddChildCat}
                onDelete={async (cat) => { if (confirm(`Xoá danh mục "${cat.name}"?`)) deleteCat.mutate(cat.id); }}
                onUploadImage={(catId) => { setPendingCatId(catId); catImageRef.current?.click(); }}
                onRemoveImage={async (catId) => { await updateCat.mutateAsync({ id: catId, image_url: null }); toast({ title: 'Đã xóa ảnh bìa' }); }}
                uploadingCatId={uploadingCatId}
                onToggleHome={async (cat) => {
                  const next = !(cat as any).hidden_from_home;
                  await updateCat.mutateAsync({ id: cat.id, hidden_from_home: next } as any);
                  toast({ title: next ? 'Đã ẩn khỏi trang chủ' : 'Đã hiện trên trang chủ' });
                }}
                onTogglePage={async (cat) => {
                  const next = !(cat as any).hidden_from_products_page;
                  await updateCat.mutateAsync({ id: cat.id, hidden_from_products_page: next } as any);
                  toast({ title: next ? 'Đã ẩn khỏi trang sản phẩm' : 'Đã hiện ở trang sản phẩm' });
                }}
                onReorderSiblings={handleReorderCatSiblings}
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
          {prodLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : products && products.length > 0 ? (
            <>
              <SortableList<typeof products[number]>
                items={paginateArray(products, productPage, PRODUCT_PAGE_SIZE)}
                onReorder={handleReorderProductsPage}
                className="space-y-2"
              >
                {(p, idx) => {
                  const pageItemsCount = Math.min(PRODUCT_PAGE_SIZE, products.length - (productPage - 1) * PRODUCT_PAGE_SIZE);
                  const totalPages = Math.ceil(products.length / PRODUCT_PAGE_SIZE);
                  const isFirst = idx === 0;
                  const isLast = idx === pageItemsCount - 1;
                  const hasPrev = productPage > 1;
                  const hasNext = productPage < totalPages;
                  return (
                  <SortableItem key={p.id} id={p.id}>
                    {({ dragHandleProps }) => (
                  <div className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <DragHandle dragHandleProps={dragHandleProps} />
                      {isFirst && hasPrev && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="Chuyển lên trang trước"
                          onClick={() => handleMoveProductAcrossPage(p.id, 'prev')}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-lg object-cover border shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm line-clamp-2 ${p.is_sold_out ? 'text-muted-foreground line-through' : ''}`}>{p.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {p.sale_price ? (
                            <>
                              <span className="line-through">{formatNumber(p.price)}đ</span>
                              <span className="text-destructive font-medium">{formatNumber(p.sale_price)}đ</span>
                            </>
                          ) : (
                            <span>{formatNumber(p.price)}đ</span>
                          )}
                        </div>
                        {/* Badges row — hiển thị tất cả nhãn rõ ràng để dễ quản lý */}
                        {(p.is_sold_out || !p.is_active || p.is_featured || (Array.isArray((p as any).badges) && (p as any).badges.length > 0) || (p as any).student_discount_text || (p as any).installment_down_payment > 0) && (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {p.is_sold_out && <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-bold">Hết hàng</Badge>}
                            {!p.is_active && <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">Ẩn</Badge>}
                            {p.is_featured && <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-500 hover:bg-blue-500 text-white font-bold">⭐ Nổi bật</Badge>}
                            {Array.isArray((p as any).badges) && (p as any).badges.map((b: string) => {
                              const opt = PRODUCT_BADGE_OPTIONS.find(o => o.id === b);
                              return opt ? (
                                <Badge key={b} className={`text-[10px] px-1.5 py-0.5 text-white font-bold ${opt.color} hover:${opt.color}`}>
                                  {opt.text}
                                </Badge>
                              ) : null;
                            })}
                            {(p as any).student_discount_text && (
                              <Badge className="text-[10px] px-1.5 py-0.5 text-white bg-red-600 hover:bg-red-600 font-bold">
                                🎓 {((p as any).student_discount_label || 'HSSV').toUpperCase()}: {((p as any).student_discount_text || '').toUpperCase()}
                              </Badge>
                            )}
                            {(p as any).installment_down_payment > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-red-300 text-red-600 font-medium">
                                💳 Trả trước {formatNumber((p as any).installment_down_payment)}đ
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      {isLast && hasNext && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2 shrink-0 gap-1"
                          title="Chuyển xuống trang sau"
                          onClick={() => handleMoveProductAcrossPage(p.id, 'next')}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                          Trang sau
                        </Button>
                      )}
                      <Button
                        variant={p.is_sold_out ? "destructive" : "outline"}
                        size="sm"
                        className="h-8 text-xs px-2 shrink-0"
                        onClick={async () => {
                          await updateProduct.mutateAsync({ id: p.id, is_sold_out: !p.is_sold_out } as any);
                          toast({ title: p.is_sold_out ? 'Đã bỏ hết hàng' : 'Đã đánh dấu hết hàng' });
                        }}
                      >
                        {p.is_sold_out ? '✓ Hết' : 'Hết hàng'}
                      </Button>
                      {landingSettings?.website_template === 'hotel_store' && (
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Quản lý ngày chặn" onClick={() => setBlockedDatesProduct(p)}>
                          <CalendarDays className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditProduct(p)}
                        disabled={loadingEditProductId === p.id}
                      >
                        {loadingEditProductId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Edit2 className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteProduct(p.id)}>
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
                currentPage={productPage}
                totalItems={products.length}
                pageSize={PRODUCT_PAGE_SIZE}
                onPageChange={setProductPage}
              />
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để bắt đầu.</p>
          )}
        </CardContent>
      </Card>

      {/* Hidden file inputs */}
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleMultiImageUpload} className="hidden" />
      <input ref={variantFileRef} type="file" accept="image/*" onChange={handleVariantImageUpload} className="hidden" />

      {/* Trang Thêm/Sửa sản phẩm (full-screen, không dùng popup) */}
      {productDialog && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => setProductDialog(false)} className="gap-1">
                ← Quay lại
              </Button>
              <h2 className="text-base sm:text-lg font-semibold truncate">
                {editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
              </h2>
            </div>
            {/* Nút Huỷ/Cập nhật chỉ giữ ở footer dưới */}
          </div>
          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <div className="mx-auto w-full max-w-[1600px] grid gap-4 lg:gap-6 lg:grid-cols-3">
            {/* ===== CỘT TRÁI: Thông tin chính → Biến thể → Gói dịch vụ ===== */}
            <div className="space-y-4 min-w-0">
            {/* Hình ảnh sản phẩm (chuyển lên đầu cột trái — đồng bộ với Biến thể) */}
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

            {/* ===== MÔ TẢ SEO ===== */}
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
                placeholder="VD: iPhone 17 Pro Max chính hãng VN/A, trả góp 0% lãi, bảo hành 12 tháng. Giao hàng nhanh toàn quốc."
                rows={2}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {(form.name || form.seo_description) && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">🔍 Xem trước trên Google</p>
                  <p className="text-[11px] text-green-700 dark:text-green-500 truncate">
                    {typeof window !== 'undefined' ? window.location.host : 'website.vn'} › san-pham
                  </p>
                  <p className="text-base text-blue-700 dark:text-blue-400 font-medium leading-snug line-clamp-1">
                    {form.name || 'Tên sản phẩm'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                    {form.seo_description || form.description || 'Mô tả SEO sẽ hiển thị ở đây...'}
                  </p>
                </div>
              )}
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
                      <div key={i} className={`flex flex-col gap-1.5 p-2 rounded border text-xs ${vp.is_sold_out ? 'bg-muted/60 opacity-70' : 'bg-card'}`}>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0">
                            <Checkbox
                              checked={vp.is_sold_out || false}
                              onCheckedChange={(checked) => {
                                const prices = [...form.variant_prices];
                                prices[i] = { ...prices[i], is_sold_out: !!checked };
                                setForm(p => ({ ...p, variant_prices: prices }));
                              }}
                              className="h-3.5 w-3.5"
                            />
                            <span className={`font-medium truncate ${vp.is_sold_out ? 'line-through text-muted-foreground' : ''}`}>
                              {vp.option1}{vp.option2 ? ` / ${vp.option2}` : ''}
                            </span>
                          </label>
                          {vp.is_sold_out && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">Hết</Badge>}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              type="button" variant="ghost" size="icon"
                              className="h-6 w-6"
                              disabled={i === 0}
                              onClick={() => {
                                const prices = [...form.variant_prices];
                                [prices[i - 1], prices[i]] = [prices[i], prices[i - 1]];
                                setForm(p => ({ ...p, variant_prices: prices }));
                              }}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button" variant="ghost" size="icon"
                              className="h-6 w-6"
                              disabled={i === form.variant_prices.length - 1}
                              onClick={() => {
                                const prices = [...form.variant_prices];
                                [prices[i], prices[i + 1]] = [prices[i + 1], prices[i]];
                                setForm(p => ({ ...p, variant_prices: prices }));
                              }}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button" variant="ghost" size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => {
                                const prices = form.variant_prices.filter((_, idx) => idx !== i);
                                setForm(p => ({ ...p, variant_prices: prices }));
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <PriceInput
                            value={vp.price}
                            onChange={val => {
                              const prices = [...form.variant_prices];
                              prices[i] = { ...prices[i], price: val };
                              setForm(p => ({ ...p, variant_prices: prices }));
                            }}
                            className="h-7 text-xs flex-1 min-w-0"
                            placeholder="Giá"
                          />
                          <PriceInput
                            value={vp.sale_price || 0}
                            onChange={val => {
                              const prices = [...form.variant_prices];
                              prices[i] = { ...prices[i], sale_price: val || undefined };
                              setForm(p => ({ ...p, variant_prices: prices }));
                            }}
                            className="h-7 text-xs flex-1 min-w-0"
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
                            className="h-7 text-xs w-16 shrink-0"
                            placeholder="SL"
                          />
                          {vp.image_url ? (
                            <div className="relative shrink-0">
                              <img src={vp.image_url} alt="" className="h-8 w-8 rounded object-cover border" />
                              <button
                                type="button"
                                onClick={() => {
                                  const prices = [...form.variant_prices];
                                  prices[i] = { ...prices[i], image_url: undefined };
                                  setForm(p => ({ ...p, variant_prices: prices }));
                                }}
                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-2 shrink-0"
                              disabled={uploadingVariantPriceIdx === i}
                              onClick={() => {
                                setPendingVariantIdx(null);
                                setPendingVariantPriceIdx(i);
                                variantFileRef.current?.click();
                              }}
                            >
                              {uploadingVariantPriceIdx === i ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ảnh'}
                            </Button>
                          )}
                        </div>
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
                              onClick={() => {
                                setPendingVariantPriceIdx(null);
                                setPendingVariantIdx(i);
                                variantFileRef.current?.click();
                              }}>
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

            {/* ===== GÓI DỊCH VỤ / BẢO HÀNH ===== */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">📦 Gói dịch vụ kèm theo</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1"
                    onClick={async () => {
                      const source = (products || []).find((p: any) => p.id !== editingProductId);
                      if (!source) {
                        toast({ title: 'Chưa có sản phẩm nguồn', description: 'Cần ít nhất 1 sản phẩm khác để đồng bộ.', variant: 'destructive' });
                        return;
                      }
                      try {
                        const [groupsRes, itemsRes] = await Promise.all([
                          supabase.from('landing_product_package_groups' as any).select('*').eq('product_id', (source as any).id).order('display_order', { ascending: true }),
                          supabase.from('landing_product_packages' as any).select('*').eq('product_id', (source as any).id).order('display_order', { ascending: true }),
                        ]);
                        if (groupsRes.error) throw groupsRes.error;
                        if (itemsRes.error) throw itemsRes.error;
                        const srcGroups = (groupsRes.data as any[]) || [];
                        const srcItems = (itemsRes.data as any[]) || [];
                        const mapItem = (p: any): PkgItemForm => ({
                          name: p.name || '',
                          price: Number(p.price) || 0,
                          description: p.description || '',
                          image_url: p.image_url || '',
                          is_default: !!p.is_default,
                          is_active: p.is_active !== false,
                          allow_quantity: !!p.allow_quantity,
                        });
                        const grouped: PkgGroupForm[] = srcGroups.map(g => ({
                          name: g.name,
                          selection_mode: (g.selection_mode === 'single' ? 'single' : 'multiple'),
                          items: srcItems.filter(it => it.group_id === g.id).map(mapItem),
                        }));
                        const orphans = srcItems.filter(it => !it.group_id).map(mapItem);
                        if (orphans.length > 0) {
                          grouped.unshift({ name: 'Gói bảo hành', selection_mode: 'multiple', items: orphans });
                        }
                        if (grouped.length === 0) {
                          toast({ title: 'Sản phẩm nguồn chưa có gói', description: `"${(source as any).name}" chưa cấu hình gói dịch vụ.`, variant: 'destructive' });
                          return;
                        }
                        setGroupsForm(grouped);
                        toast({ title: '✅ Đã đồng bộ', description: `Copy ${grouped.length} nhóm từ "${(source as any).name}" (kèm hình ảnh).` });
                      } catch (err: any) {
                        toast({ title: 'Lỗi đồng bộ', description: err.message || String(err), variant: 'destructive' });
                      }
                    }}
                  >
                    🔄 Đồng bộ hệ thống
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs"
                    onClick={() => setGroupsForm(prev => [...prev, {
                      name: prev.length === 0 ? 'Gói bảo hành' : `Nhóm ${prev.length + 1}`,
                      selection_mode: 'single',
                      items: [],
                    }])}>
                    <FolderPlus className="h-3 w-3" /> Thêm nhóm
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Tạo nhiều nhóm tuỳ ngành: <b>Gói bảo hành</b>, <b>Phụ kiện đi kèm</b>, <b>Sim/Cốp</b>... Mỗi nhóm có thể chọn 1 hoặc nhiều mục. Bill sẽ liệt kê chi tiết theo từng nhóm.
              </p>
              {/* Hidden file input for package item images */}
              <input
                ref={pkgImageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !pendingPkgImage) return;
                  const url = await handleUploadImage(file);
                  if (url) {
                    const { groupIdx, itemIdx } = pendingPkgImage;
                    setGroupsForm(prev => prev.map((g, gi) => gi !== groupIdx ? g : {
                      ...g,
                      items: g.items.map((it, ii) => ii !== itemIdx ? it : { ...it, image_url: url }),
                    }));
                  }
                  setPendingPkgImage(null);
                  if (pkgImageRef.current) pkgImageRef.current.value = '';
                }}
              />
              {groupsForm.map((group, gi) => (
                <div key={gi} className="rounded-lg border bg-muted/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={group.name}
                      onChange={e => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? { ...g, name: e.target.value } : g))}
                      placeholder="Tên nhóm (VD: Gói bảo hành, Phụ kiện đi kèm...)"
                      className="h-8 text-sm font-semibold flex-1"
                    />
                    <Select
                      value={group.selection_mode}
                      onValueChange={(v) => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? { ...g, selection_mode: v as 'single' | 'multiple' } : g))}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Chỉ chọn 1</SelectItem>
                        <SelectItem value="multiple">Chọn nhiều</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => setGroupsForm(prev => prev.filter((_, idx) => idx !== gi))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-2 pl-2 border-l-2 border-dashed">
                    {group.items.map((item, ii) => (
                      <div key={ii} className="p-2 rounded-md border bg-background space-y-1.5">
                        <div className="flex items-center gap-2">
                          {item.image_url ? (
                            <div className="relative h-9 w-9 shrink-0">
                              <button type="button" className="h-9 w-9 rounded border overflow-hidden block"
                                onClick={() => { setPendingPkgImage({ groupIdx: gi, itemIdx: ii }); pkgImageRef.current?.click(); }}>
                                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                              </button>
                              <button
                                type="button"
                                title="Xoá ảnh"
                                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGroupsForm(prev => prev.map((g, idx) => idx === gi ? {
                                    ...g, items: g.items.map((it, j) => j === ii ? { ...it, image_url: '' } : it),
                                  } : g));
                                }}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
                              onClick={() => { setPendingPkgImage({ groupIdx: gi, itemIdx: ii }); pkgImageRef.current?.click(); }}>
                              <ImagePlus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Input
                            value={item.name}
                            onChange={e => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? {
                              ...g, items: g.items.map((it, j) => j === ii ? { ...it, name: e.target.value } : it),
                            } : g))}
                            placeholder="Tên mục (VD: VIP 13 tháng, Ốp lưng silicon...)"
                            className="h-8 text-sm flex-1"
                          />
                          <PriceInput
                            value={item.price}
                            onChange={val => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? {
                              ...g, items: g.items.map((it, j) => j === ii ? { ...it, price: val } : it),
                            } : g))}
                            className="w-28 h-8 text-sm"
                            placeholder="Giá"
                          />
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? {
                              ...g, items: g.items.filter((_, j) => j !== ii),
                            } : g))}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Input
                          value={item.description}
                          onChange={e => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? {
                            ...g, items: g.items.map((it, j) => j === ii ? { ...it, description: e.target.value } : it),
                          } : g))}
                          placeholder="Mô tả ngắn (không bắt buộc)"
                          className="h-7 text-xs"
                        />
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={item.is_default}
                              onCheckedChange={(checked) => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? {
                                ...g,
                                items: g.items.map((it, j) => ({
                                  ...it,
                                  // For single-select groups, only one default
                                  is_default: j === ii ? !!checked : (g.selection_mode === 'single' ? false : it.is_default),
                                })),
                              } : g))}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs">Mặc định chọn</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={item.is_active}
                              onCheckedChange={(checked) => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? {
                                ...g, items: g.items.map((it, j) => j === ii ? { ...it, is_active: !!checked } : it),
                              } : g))}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs">Hiển thị</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={item.allow_quantity}
                              onCheckedChange={(checked) => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? {
                                ...g, items: g.items.map((it, j) => j === ii ? { ...it, allow_quantity: !!checked } : it),
                              } : g))}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs">Cho chọn số lượng</span>
                          </label>
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs w-full"
                      onClick={() => setGroupsForm(prev => prev.map((g, idx) => idx === gi ? {
                        ...g, items: [...g.items, { name: '', price: 0, description: '', image_url: '', is_default: false, is_active: true, allow_quantity: false }],
                      } : g))}>
                      <Plus className="h-3 w-3" /> Thêm mục vào nhóm
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            </div>
            {/* ===== /CỘT TRÁI ===== */}

            {/* ===== CỘT GIỮA: Khuyến mãi / Bảo hành / Mô tả ===== */}
            <div className="space-y-4 min-w-0">
            {/* ===== KHUYẾN MÃI ===== */}
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
            </div>
            {/* ===== /CỘT GIỮA ===== */}

            {/* ===== CỘT PHẢI: Hình ảnh / Trạng thái / Nhãn / Hiển thị trang chủ / HSSV / Trả góp ===== */}
            <div className="space-y-4 min-w-0">
            {/* Khung xem trước card sản phẩm (giống ngoài website) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">👁️ Xem trước trên website</Label>
              <div className="rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-muted/40 to-background p-3">
                <div className="mx-auto w-full max-w-[260px]">
                  <LayoutProductCard
                    layoutStyle={(() => {
                      const tpl = (landingSettings as any)?.website_template || 'phone_store';
                      const custom = (landingSettings as any)?.custom_layout_style;
                      try {
                        return (custom || getIndustryConfig(tpl).layoutStyle) as any;
                      } catch {
                        return 'minimal' as any;
                      }
                    })()}
                    accentColor={(landingSettings as any)?.primary_color || '#2563eb'}
                    onClick={() => {}}
                    product={{
                      id: 'preview',
                      name: form.name || 'Tên sản phẩm sẽ hiển thị tại đây',
                      price: form.price || 0,
                      sale_price: form.sale_price || null,
                      image_url: form.images?.[0] || form.image_url || null,
                      images: form.images || [],
                      is_active: true,
                      is_featured: form.is_featured,
                      is_sold_out: form.is_sold_out,
                      badges: formBadges,
                      badge_style: badgeStyle,
                      student_discount_label: form.student_discount_label || null,
                      student_discount_text: form.student_discount_text || null,
                      installment_down_payment: form.installment_down_payment || null,
                      extra_discount_labels: form.extra_discount_labels || [],
                    } as any}
                  />
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Xem trước cập nhật theo thông tin bạn nhập (ảnh, tên, giá, nhãn, HS-SV, trả góp…)
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">Hết hàng <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Sold out</Badge></Label>
              <Switch checked={form.is_sold_out} onCheckedChange={v => setForm(p => ({ ...p, is_sold_out: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Sản phẩm nổi bật</Label>
              <Switch checked={form.is_featured} onCheckedChange={v => setForm(p => ({ ...p, is_featured: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Hiển thị</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
            </div>

            {/* Số lượng đã bán */}
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">🔥 Hiển thị "Đã bán"</Label>
                <Switch
                  checked={form.show_sold_count !== false}
                  onCheckedChange={v => setForm(p => ({ ...p, show_sold_count: v }))}
                />
              </div>
              {form.show_sold_count !== false && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Số lượng khởi tạo (sẽ tự +1 mỗi đơn mới từ web)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.sold_count ?? 0}
                    onChange={e => setForm(p => ({ ...p, sold_count: Math.max(0, Number(e.target.value) || 0) }))}
                    placeholder="Ví dụ: 150"
                  />
                </div>
              )}
            </div>


            {/* Hiển thị trên trang chủ */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">📍 Hiển thị trên trang chủ</Label>
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

            {/* Ưu đãi HS-SV */}
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold">🎓 Nhãn ưu đãi HS-SV</Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1"
                    disabled={(form.extra_discount_labels?.length || 0) >= 4}
                    onClick={() => {
                      setForm(p => {
                        const cur = Array.isArray(p.extra_discount_labels) ? p.extra_discount_labels : [];
                        if (cur.length >= 4) return p;
                        const color = EXTRA_DISCOUNT_COLORS[cur.length % EXTRA_DISCOUNT_COLORS.length];
                        return { ...p, extra_discount_labels: [...cur, { label: '', text: '', color }] };
                      });
                    }}
                  >
                    ➕ Thêm Nhãn Ưu Đãi
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => {
                      const source = (products || []).find((p: any) =>
                        p.id !== editingProductId && (p.student_discount_text || p.student_discount_label || (Array.isArray(p.extra_discount_labels) && p.extra_discount_labels.length > 0))
                      ) || (products || []).find((p: any) => p.id !== editingProductId);
                      if (!source) {
                        toast({ title: 'Chưa có sản phẩm nguồn', description: 'Cần ít nhất 1 sản phẩm khác đã cấu hình nhãn ưu đãi.', variant: 'destructive' });
                        return;
                      }
                      setForm(p => ({
                        ...p,
                        student_discount_label: (source as any).student_discount_label || 'HỌC SINH SINH VIÊN',
                        student_discount_text: (source as any).student_discount_text || '',
                        extra_discount_labels: Array.isArray((source as any).extra_discount_labels) ? (source as any).extra_discount_labels : [],
                      }));
                      toast({ title: '✅ Đã đồng bộ', description: `Copy nhãn ưu đãi từ "${(source as any).name}".` });
                    }}
                  >
                    🔄 Đồng bộ
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Nhãn đầu tiên hiển thị kiểu tem đỏ HSSV. Có thể thêm tối đa 4 nhãn phụ (tổng 5), mỗi nhãn 1 màu khác nhau.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nhãn 1 - Tiêu đề</Label>
                  <Input
                    value={form.student_discount_label}
                    onChange={e => setForm(p => ({ ...p, student_discount_label: e.target.value }))}
                    placeholder="HỌC SINH SINH VIÊN"
                    className="h-8 text-sm uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nhãn 1 - Nội dung giảm</Label>
                  <Input
                    value={form.student_discount_text}
                    onChange={e => setForm(p => ({ ...p, student_discount_text: e.target.value }))}
                    placeholder="VD: GIẢM 100.000Đ"
                    className="h-8 text-sm uppercase"
                  />
                </div>
              </div>
              {(form.extra_discount_labels || []).map((it, idx) => (
                <div key={idx} className="rounded-md border border-dashed p-2 space-y-1.5 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold">Nhãn {idx + 2}</span>
                      <input
                        type="color"
                        value={it.color || EXTRA_DISCOUNT_COLORS[idx % EXTRA_DISCOUNT_COLORS.length]}
                        onChange={e => {
                          const v = e.target.value;
                          setForm(p => ({
                            ...p,
                            extra_discount_labels: (p.extra_discount_labels || []).map((x, i) => i === idx ? { ...x, color: v } : x),
                          }));
                        }}
                        className="h-6 w-8 rounded border cursor-pointer"
                        title="Màu nhãn"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                      onClick={() => {
                        setForm(p => ({
                          ...p,
                          extra_discount_labels: (p.extra_discount_labels || []).filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={it.label}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(p => ({
                          ...p,
                          extra_discount_labels: (p.extra_discount_labels || []).map((x, i) => i === idx ? { ...x, label: v } : x),
                        }));
                      }}
                      placeholder="VD: Smember giảm đến"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={it.text}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(p => ({
                          ...p,
                          extra_discount_labels: (p.extra_discount_labels || []).map((x, i) => i === idx ? { ...x, text: v } : x),
                        }));
                      }}
                      placeholder="VD: 300.000đ"
                      className="h-8 text-sm font-semibold"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Trả góp */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">💳 Trả góp - Trả trước</Label>
              <p className="text-[10px] text-muted-foreground">Hiển thị "Hoặc trả trước XXX,000đ". Để 0 nếu không hiển thị.</p>
              <PriceInput
                value={form.installment_down_payment ?? 0}
                onChange={v => setForm(p => ({ ...p, installment_down_payment: v || null }))}
                placeholder="VD: 600000"
              />
            </div>
            {/* Product Badges */}
            <Separator />
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-between text-sm font-medium border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary"
                onClick={handleToggleBadges}
                aria-expanded={showBadges}
              >
                <span className="flex items-center gap-2">
                  🏷️ Nhãn sản phẩm {formBadges.length > 0 && `(${formBadges.length}/3)`}
                  {!showBadges && (
                    <span className="text-[10px] font-normal text-muted-foreground">— nhấn để mở</span>
                  )}
                </span>
                {showBadges ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 animate-pulse" />}
              </Button>
              {showBadges && (
                <div ref={badgesPanelRef} className="space-y-3 p-3 bg-muted/50 rounded-lg scroll-mt-4">
                  {/* Chọn phong cách nhãn */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold flex items-center gap-1.5">
                      🎨 Phong cách nhãn
                    </Label>
                    <Select value={badgeStyle} onValueChange={(v) => setBadgeStyle(v as 'simple' | 'luxury' | 'modern' | 'tiktok')}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">✨ Đơn giản (Simple)</span>
                            <span className="text-[10px] text-muted-foreground">Pill / Flame phẳng — gọn gàng, hiện đại</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="modern">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">⚡ Hiện đại (Modern)</span>
                            <span className="text-[10px] text-muted-foreground">Chip bo nhẹ, gradient mềm, chấm sáng — phong cách tech</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="luxury">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">👑 Sang trọng (Royal Luxe)</span>
                            <span className="text-[10px] text-muted-foreground">Ribbon + huy hiệu vàng, gradient cao cấp</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="tiktok">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">🎀 Dải Ưu Đãi (Promo Strip)</span>
                            <span className="text-[10px] text-muted-foreground">Dải băng nhiều màu sát đáy ảnh — phong cách sàn TMĐT</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>


                  <div className="grid grid-cols-2 gap-1.5">
                  {(() => {
                    const cornerLabel: Record<string, string> = {
                      tl: '↖ Trên-Trái', tr: '↗ Trên-Phải', bl: '↙ Dưới-Trái', br: '↘ Dưới-Phải',
                    };
                    // Tính các góc đã được chiếm bởi nhãn đang chọn
                    const usedCorners = new Set<string>();
                    formBadges.forEach(id => {
                      const c = BADGE_POSITION_MAP[id]?.corner;
                      if (c) usedCorners.add(c);
                    });
                    return PRODUCT_BADGE_OPTIONS.map(opt => {
                      const isActive = formBadges.includes(opt.id);
                      const corner = BADGE_POSITION_MAP[opt.id]?.corner;
                      const cornerTaken = !isActive && corner ? usedCorners.has(corner) : false;
                      const limitReached = !isActive && formBadges.length >= 3;
                      const disabled = limitReached || cornerTaken;
                      return (
                        <label key={opt.id} className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-xs transition-colors ${isActive ? 'bg-primary/10 ring-1 ring-primary/30' : disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted'}`}
                          title={cornerTaken ? `Góc ${cornerLabel[corner!]} đã được chọn bởi nhãn khác` : limitReached ? 'Tối đa 3 nhãn' : ''}
                        >
                          <Checkbox
                            checked={isActive}
                            disabled={disabled}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                if (formBadges.length < 3 && !cornerTaken) setFormBadges(prev => [...prev, opt.id]);
                              } else {
                                setFormBadges(prev => prev.filter(b => b !== opt.id));
                              }
                            }}
                          />
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-[10px] font-bold ${opt.color}`}>{opt.text}</span>
                          <span className="truncate flex-1">{opt.label.split(' ').slice(1).join(' ')}</span>
                          {corner && (
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap">{cornerLabel[corner].split(' ')[0]}</span>
                          )}
                        </label>
                      );
                    });
                  })()}
                    <p className="col-span-2 text-[10px] text-muted-foreground mt-1">
                    Tối đa 3 nhãn. Mỗi nhãn có vị trí cố định (↖↗↙↘). Không thể chọn 2 nhãn cùng góc để tránh chồng lên nhau.
                    </p>
                  </div>
                </div>
              )}
            </div>
            </div>
            {/* ===== /CỘT PHẢI ===== */}
            </div>
          </div>
          {/* Footer sticky */}
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
            <Button variant="outline" onClick={() => setProductDialog(false)}>Huỷ</Button>
            <Button onClick={handleSaveProduct} disabled={!form.name.trim() || createProduct.isPending || updateProduct.isPending}>
              {(createProduct.isPending || updateProduct.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? 'Cập nhật' : 'Thêm'}
            </Button>
          </div>
        </div>
      )}

      {/* Dialog nhập từ kho */}
      <ImportFromWarehouseDialog
        open={warehouseDialog}
        onOpenChange={setWarehouseDialog}
        existingProducts={products || []}
      />

      {/* Dialog quản lý ngày chặn - chỉ cho khách sạn */}
      {blockedDatesProduct && tenant?.id && landingSettings?.website_template === 'hotel_store' && (
        <BlockedDatesCalendar
          open={!!blockedDatesProduct}
          onClose={() => setBlockedDatesProduct(null)}
          tenantId={tenant.id}
          productId={blockedDatesProduct.id}
          productName={blockedDatesProduct.name}
        />
      )}
    </div>
  );
}
