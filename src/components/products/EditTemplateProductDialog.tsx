import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriceInput } from '@/components/ui/price-input';
import { Loader2, Save, Plus, X, Pencil, Trash2, Layers } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCategories } from '@/hooks/useCategories';
import { formatCurrency } from '@/lib/mockData';
import type { Product } from '@/hooks/useProducts';

interface EditTemplateProductDialogProps {
  /** The product being edited — could be a grouped summary or individual template */
  product: (Product & { isTemplateGroup?: boolean; childProducts?: Product[] }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VariantRow {
  id: string;
  name: string;
  sku: string;
  variant_1: string | null;
  variant_2: string | null;
  variant_3: string | null;
  import_price: number;
  sale_price: number | null;
  isNew?: boolean;
  isDeleted?: boolean;
  isEditing?: boolean;
}

export function EditTemplateProductDialog({ product, open, onOpenChange }: EditTemplateProductDialogProps) {
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [baseName, setBaseName] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('');
  const [categoryId, setCategoryId] = useState('_none_');
  const [importPrice, setImportPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [note, setNote] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [originalBaseName, setOriginalBaseName] = useState('');
  
  // New variant form
  const [newVariantName, setNewVariantName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', sku: '', import_price: '', sale_price: '' });

  useEffect(() => {
    if (!product || !open) return;
    
    // If it's a template group, the name was already extracted to baseName by groupTemplateProducts
    const name = product.isTemplateGroup
      ? extractBaseName(product.name, product.variant_1, product.variant_2, product.variant_3)
      : product.name;
    setBaseName(name);
    setSkuPrefix(product.sku || '');
    setCategoryId(product.category_id || '_none_');
    setImportPrice(String(product.import_price || 0));
    setSalePrice(product.sale_price != null ? String(product.sale_price) : '');
    setNote(product.note || '');
    setEditingId(null);
    setNewVariantName('');
    
    // Load all variant products for this template group
    loadVariants(name, product);
  }, [product, open]);

  const loadVariants = async (name: string, prod: any) => {
    setIsLoadingVariants(true);
    try {
      // If it's a grouped template, load child products from DB
      // Find all template products that share the same base name
      const baseNameExtracted = extractBaseName(name, prod.variant_1, prod.variant_2, prod.variant_3);
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, variant_1, variant_2, variant_3, import_price, sale_price, status')
        .eq('status', 'template')
        .ilike('name', `${baseNameExtracted}%`)
        .order('name');
      
      if (error) throw error;
      
      // Filter to only variants (has variant_1)
      const variantProducts = (data || []).filter(p => p.variant_1);
      
      if (variantProducts.length > 0) {
        setBaseName(baseNameExtracted);
        setOriginalBaseName(baseNameExtracted);
        setVariants(variantProducts.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          variant_1: p.variant_1,
          variant_2: p.variant_2,
          variant_3: p.variant_3,
          import_price: Number(p.import_price),
          sale_price: p.sale_price ? Number(p.sale_price) : null,
        })));
      } else {
        // Single template, no variants
        setVariants([]);
      }
    } catch (err) {
      console.error('Error loading variants:', err);
      setVariants([]);
    } finally {
      setIsLoadingVariants(false);
    }
  };

  const extractBaseName = (name: string, v1?: string | null, v2?: string | null, v3?: string | null): string => {
    let base = name;
    const parts = [v3, v2, v1].filter(Boolean) as string[];
    for (const part of parts) {
      if (base.endsWith(part)) {
        base = base.slice(0, -part.length).trimEnd();
      }
    }
    return base || name;
  };

  const getVariantLabel = (v: VariantRow) => {
    return [v.variant_1, v.variant_2, v.variant_3].filter(Boolean).join(' · ');
  };

  const handleAddVariant = async () => {
    const trimmed = newVariantName.trim();
    if (!trimmed) return;
    
    // Parse variant parts (space or comma separated)
    const parts = trimmed.split(/[,/]+/).map(s => s.trim()).filter(Boolean);
    const fullName = `${baseName} ${parts.join(' ')}`;
    const skuSuffix = parts.map(v => v.replace(/\s+/g, '')).join('-');
    const sku = skuPrefix ? `${skuPrefix}-${skuSuffix}` : skuSuffix;
    
    // Check duplicate
    if (variants.some(v => !v.isDeleted && v.name === fullName)) {
      toast({ title: 'Biến thể đã tồn tại', variant: 'destructive' });
      return;
    }

    const newVariant: VariantRow = {
      id: `new_${Date.now()}`,
      name: fullName,
      sku,
      variant_1: parts[0] || null,
      variant_2: parts[1] || null,
      variant_3: parts[2] || null,
      import_price: importPrice ? Number(importPrice) : 0,
      sale_price: salePrice ? Number(salePrice) : null,
      isNew: true,
    };
    
    setVariants(prev => [...prev, newVariant]);
    setNewVariantName('');
  };

  const handleDeleteVariant = (id: string) => {
    setVariants(prev => prev.map(v => 
      v.id === id 
        ? v.isNew ? { ...v, isDeleted: true } : { ...v, isDeleted: !v.isDeleted }
        : v
    ));
  };

  const startEdit = (v: VariantRow) => {
    setEditingId(v.id);
    setEditForm({
      name: v.name,
      sku: v.sku,
      import_price: String(v.import_price),
      sale_price: v.sale_price != null ? String(v.sale_price) : '',
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    setVariants(prev => prev.map(v => 
      v.id === editingId
        ? {
            ...v,
            name: editForm.name,
            sku: editForm.sku,
            import_price: Math.round(Number(editForm.import_price) || 0),
            sale_price: editForm.sale_price ? Math.round(Number(editForm.sale_price)) : null,
          }
        : v
    ));
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!baseName.trim()) {
      toast({ title: 'Vui lòng nhập tên sản phẩm', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const tenantId = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId.data) throw new Error('Không tìm thấy tenant');

      const activeVariants = variants.filter(v => !v.isDeleted);
      const hasVariants = activeVariants.length > 0;

      if (hasVariants) {
        // Handle variant updates
        const toDelete = variants.filter(v => v.isDeleted && !v.isNew).map(v => v.id);
        const toCreate = variants.filter(v => v.isNew && !v.isDeleted);
        const toUpdate = variants.filter(v => !v.isNew && !v.isDeleted);

        // Delete removed variants
        if (toDelete.length > 0) {
          const { error } = await supabase
            .from('products')
            .delete()
            .in('id', toDelete);
          if (error) throw error;
        }

        // Update existing variants
        for (const v of toUpdate) {
          const { error } = await supabase
            .from('products')
            .update({
              name: v.name,
              sku: v.sku,
              import_price: Math.round(v.import_price),
              sale_price: v.sale_price != null ? Math.round(v.sale_price) : null,
              category_id: categoryId === '_none_' ? null : categoryId,
              note: note || null,
            })
            .eq('id', v.id);
          if (error) throw error;
        }

        // Create new variants
        if (toCreate.length > 0) {
          const newProducts = toCreate.map(v => ({
            name: v.name,
            sku: v.sku,
            variant_1: v.variant_1,
            variant_2: v.variant_2,
            variant_3: v.variant_3,
            import_price: Math.round(v.import_price),
            sale_price: v.sale_price != null ? Math.round(v.sale_price) : null,
            category_id: categoryId === '_none_' ? null : categoryId,
            note: note || null,
            tenant_id: tenantId.data,
            status: 'template' as const,
            quantity: 0,
            total_import_cost: 0,
          }));
          const { error } = await supabase.from('products').insert(newProducts as any[]);
          if (error) throw error;
        }

        toast({
          title: 'Cập nhật thành công',
          description: `Đã cập nhật ${toUpdate.length} biến thể, thêm ${toCreate.length}, xóa ${toDelete.length}`,
        });
      } else {
        // No variants — update the single product
        if (product) {
          const { error } = await supabase
            .from('products')
            .update({
              name: baseName.trim(),
              sku: skuPrefix.trim() || baseName.trim().replace(/\s+/g, '-'),
              import_price: Math.round(Number(importPrice) || 0),
              sale_price: salePrice ? Math.round(Number(salePrice)) : null,
              category_id: categoryId === '_none_' ? null : categoryId,
              note: note || null,
            })
            .eq('id', product.id);
          if (error) throw error;
          toast({ title: 'Cập nhật sản phẩm mẫu thành công' });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeVariants = variants.filter(v => !v.isDeleted);
  const deletedCount = variants.filter(v => v.isDeleted && !v.isNew).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Chỉnh sửa sản phẩm mẫu
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Base product name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tên sản phẩm <span className="text-destructive">*</span></Label>
            <Input
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              placeholder="VD: iPhone 16 Pro Max"
            />
          </div>

          {/* SKU prefix */}
          <div className="space-y-1.5">
            <Label className="text-sm">SKU {variants.length > 0 ? '(tiền tố)' : ''}</Label>
            <Input
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value)}
              placeholder="Mã SKU"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm">Danh mục</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="_none_">-- Không chọn --</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.parent_id ? `— ${cat.name}` : cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prices (default for new variants) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Giá nhập (mặc định)</Label>
              <PriceInput
                value={importPrice}
                onChange={(v) => setImportPrice(String(v))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Giá bán (mặc định)</Label>
              <PriceInput
                value={salePrice}
                onChange={(v) => setSalePrice(String(v))}
                placeholder="0"
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-sm">Ghi chú</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú..."
              rows={2}
            />
          </div>

          {/* Variant Management Section */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                Biến thể ({activeVariants.length})
              </Label>
            </div>

            {isLoadingVariants ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Đang tải...</span>
              </div>
            ) : (
              <>
                {/* Existing variants list */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {variants.map((v) => {
                    if (v.isNew && v.isDeleted) return null;
                    
                    const isEditing = editingId === v.id;
                    
                    if (isEditing) {
                      return (
                        <div key={v.id} className="border rounded-lg p-2.5 space-y-2 bg-primary/5">
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="h-8 text-sm"
                            placeholder="Tên biến thể"
                          />
                          <Input
                            value={editForm.sku}
                            onChange={(e) => setEditForm(f => ({ ...f, sku: e.target.value }))}
                            className="h-8 text-sm"
                            placeholder="SKU"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <PriceInput
                              value={editForm.import_price}
                              onChange={(val) => setEditForm(f => ({ ...f, import_price: String(val) }))}
                              placeholder="Giá nhập"
                              className="h-8 text-sm"
                            />
                            <PriceInput
                              value={editForm.sale_price}
                              onChange={(val) => setEditForm(f => ({ ...f, sale_price: String(val) }))}
                              placeholder="Giá bán"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="flex gap-1.5 justify-end">
                            <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingId(null)}>Hủy</Button>
                            <Button size="sm" className="h-7" onClick={saveEdit}>Lưu</Button>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={v.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm ${
                          v.isDeleted ? 'opacity-40 line-through bg-destructive/5' : 'bg-card'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-xs">{getVariantLabel(v) || v.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{v.sku}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatCurrency(v.import_price)}
                        </span>
                        <div className="flex gap-0.5 shrink-0">
                          {!v.isDeleted && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => startEdit(v)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 ${v.isDeleted ? 'text-primary' : 'text-destructive'}`}
                            onClick={() => handleDeleteVariant(v.id)}
                          >
                            {v.isDeleted ? <Plus className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add new variant */}
                <div className="flex gap-2">
                  <Input
                    value={newVariantName}
                    onChange={(e) => setNewVariantName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariant())}
                    placeholder="VD: 256GB Trắng"
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={handleAddVariant}
                    disabled={!newVariantName.trim()}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Thêm
                  </Button>
                </div>

                {deletedCount > 0 && (
                  <p className="text-xs text-destructive">
                    {deletedCount} biến thể sẽ bị xóa khi lưu
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !baseName.trim()}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
