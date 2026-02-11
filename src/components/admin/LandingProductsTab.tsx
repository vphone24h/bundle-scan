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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit2, Loader2, Upload, X, FolderPlus, Package } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { PriceInput } from '@/components/ui/price-input';

export function LandingProductsTab() {
  const { data: tenant } = useCurrentTenant();
  const { data: categories, isLoading: catLoading } = useLandingProductCategories();
  const createCat = useCreateLandingProductCategory();
  const deleteCat = useDeleteLandingProductCategory();
  const { data: products, isLoading: prodLoading } = useLandingProducts();
  const createProduct = useCreateLandingProduct();
  const updateProduct = useUpdateLandingProduct();
  const deleteProduct = useDeleteLandingProduct();

  const [catName, setCatName] = useState('');
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LandingProduct | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    sale_price: null as number | null,
    category_id: '_none_',
    image_url: '',
    is_featured: false,
    is_active: true,
    variants: [] as LandingProductVariant[],
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
    setForm({ name: '', description: '', price: 0, sale_price: null, category_id: '_none_', image_url: '', is_featured: false, is_active: true, variants: [] });
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
      is_featured: p.is_featured,
      is_active: p.is_active,
      variants: Array.isArray(p.variants) ? p.variants : [],
    });
    setProductDialog(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Ảnh không quá 5MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadLandingProductImage(file, tenant.id);
      setForm(prev => ({ ...prev, image_url: url }));
    } catch {
      toast({ title: 'Lỗi upload ảnh', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
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
        image_url: form.image_url || null,
        is_featured: form.is_featured,
        is_active: form.is_active,
        variants: form.variants,
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
      <Card>
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
            <Button onClick={openAddProduct} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Thêm sản phẩm
            </Button>
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
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
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
            <div className="space-y-2">
              <Label>Hình ảnh</Label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              {form.image_url ? (
                <div className="relative inline-block">
                  <img src={form.image_url} alt="" className="h-24 w-24 rounded-lg object-cover border" />
                  <button onClick={() => setForm(p => ({ ...p, image_url: '' }))} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload ảnh
              </Button>
            </div>
            <Separator />
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
    </div>
  );
}
