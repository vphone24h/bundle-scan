import { useState, useRef } from 'react';
import {
  useLandingProductCategories,
  useCreateLandingProductCategory,
  useDeleteLandingProductCategory,
  useLandingProducts,
  useCreateLandingProduct,
  useUpdateLandingProduct,
  useDeleteLandingProduct,
  uploadLandingProductImage,
  LandingProduct,
  LandingProductVariant,
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
import { Plus, Trash2, Edit2, Loader2, Upload, X, FolderPlus, Package, ImagePlus, Warehouse } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { PriceInput } from '@/components/ui/price-input';
import { ImportFromWarehouseDialog } from './ImportFromWarehouseDialog';

export function LandingProductsTab() {
  const { data: tenant } = useCurrentTenant();
  const { data: landingSettings } = useTenantLandingSettings();
  const { data: categories, isLoading: catLoading } = useLandingProductCategories();
  const createCat = useCreateLandingProductCategory();
  const deleteCat = useDeleteLandingProductCategory();
  const { data: products, isLoading: prodLoading } = useLandingProducts();
  const createProduct = useCreateLandingProduct();
  const updateProduct = useUpdateLandingProduct();
  const deleteProduct = useDeleteLandingProduct();

  const [catName, setCatName] = useState('');
  const [warehouseDialog, setWarehouseDialog] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LandingProduct | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingVariantIdx, setUploadingVariantIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const variantFileRef = useRef<HTMLInputElement>(null);
  const [pendingVariantIdx, setPendingVariantIdx] = useState<number | null>(null);

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

  const openAddProduct = () => {
    setEditingProduct(null);
    setForm({ name: '', description: '', price: 0, sale_price: null, category_id: '_none_', image_url: '', images: [], is_featured: false, is_active: true, variants: [], home_tab_ids: [] });
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
        return {
          ...prev,
          images: allImages,
          image_url: allImages[0] || prev.image_url, // first image = main
        };
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

  const handleSaveProduct = async () => {
    if (!form.name.trim()) return;
    try {
      const payload = {
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

  if (catLoading || prodLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Danh mục sản phẩm */}
      <Card data-tour="landing-products-category">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderPlus className="h-4 w-4" />
            Danh mục sản phẩm
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={catName}
              onChange={e => setCatName(e.target.value)}
              placeholder="Tên danh mục mới..."
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} disabled={!catName.trim() || createCat.isPending} size="sm">
              {createCat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories?.map(cat => (
              <Badge key={cat.id} variant="secondary" className="gap-1 pr-1">
                {cat.name}
                <button
                  onClick={() => { if (confirm(`Xoá danh mục "${cat.name}"?`)) deleteCat.mutate(cat.id); }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {(!categories || categories.length === 0) && (
              <p className="text-sm text-muted-foreground">Chưa có danh mục nào</p>
            )}
          </div>
        </CardContent>
      </Card>


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
              {products.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Tên sản phẩm *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="iPhone 15 Pro Max..." />
            </div>
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">Không phân loại</SelectItem>
                  {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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

            {/* Biến thể sản phẩm */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Biến thể (màu sắc, dung lượng, tình trạng...)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={() => setForm(p => ({ ...p, variants: [...p.variants, { name: '', price: 0 }] }))}
                >
                  <Plus className="h-3 w-3" /> Thêm biến thể
                </Button>
              </div>
              {form.variants.length > 0 ? (
                <div className="space-y-2">
                  {form.variants.map((v, i) => (
                    <div key={i} className="p-2 rounded-lg border bg-muted/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={v.name}
                          onChange={e => {
                            const variants = [...form.variants];
                            variants[i] = { ...variants[i], name: e.target.value };
                            setForm(p => ({ ...p, variants }));
                          }}
                          placeholder="VD: 256GB Zin đẹp"
                          className="flex-1 h-8 text-sm"
                        />
                        <PriceInput
                          value={v.price}
                          onChange={val => {
                            const variants = [...form.variants];
                            variants[i] = { ...variants[i], price: val };
                            setForm(p => ({ ...p, variants }));
                          }}
                          className="w-32 h-8 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive shrink-0"
                          onClick={() => setForm(p => ({ ...p, variants: p.variants.filter((_, j) => j !== i) }))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {/* Variant image */}
                      <div className="flex items-center gap-2 pl-1">
                        {v.image_url ? (
                          <div className="relative">
                            <img src={v.image_url} alt="" className="h-10 w-10 rounded object-cover border" />
                            <button
                              onClick={() => {
                                const variants = [...form.variants];
                                variants[i] = { ...variants[i], image_url: undefined };
                                setForm(p => ({ ...p, variants }));
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
                            className="h-7 text-xs gap-1"
                            disabled={uploadingVariantIdx === i}
                            onClick={() => {
                              setPendingVariantIdx(i);
                              variantFileRef.current?.click();
                            }}
                          >
                            {uploadingVariantIdx === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                            Ảnh biến thể
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Chưa có biến thể. Nhấn "Thêm biến thể" để thêm.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Mô tả</Label>
              <RichTextEditor
                value={form.description}
                onChange={v => setForm(p => ({ ...p, description: v }))}
                placeholder="Mô tả chi tiết sản phẩm..."
                minHeight="150px"
              />
            </div>

            {/* Multiple images */}
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
                {/* Built-in sections */}
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
                          home_tab_ids: checked
                            ? [...p.home_tab_ids, section.id]
                            : p.home_tab_ids.filter(id => id !== section.id)
                        }));
                      }}
                    />
                    <span className="text-sm">{section.icon} {section.name}</span>
                  </label>
                ))}
                {/* Custom tabs */}
                {customProductTabs.map(tab => (
                  <label key={tab.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.home_tab_ids.includes(tab.id)}
                      onCheckedChange={(checked) => {
                        setForm(p => ({
                          ...p,
                          home_tab_ids: checked
                            ? [...p.home_tab_ids, tab.id]
                            : p.home_tab_ids.filter(id => id !== tab.id)
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
