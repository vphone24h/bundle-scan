import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriceInput } from '@/components/ui/price-input';
import { Loader2, Save, Layers } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCategories } from '@/hooks/useCategories';
import { VariantConfigPanel, VariantConfig, VariantLevel } from '@/components/import/VariantConfig';
import type { Product } from '@/hooks/useProducts';

interface EditTemplateProductDialogProps {
  product: (Product & { isTemplateGroup?: boolean; childProducts?: Product[] }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTemplateProductDialog({ product, open, onOpenChange }: EditTemplateProductDialogProps) {
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [baseName, setBaseName] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('');
  const [categoryId, setCategoryId] = useState('_none_');
  const [importPrice, setImportPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [note, setNote] = useState('');

  const [variantConfig, setVariantConfig] = useState<VariantConfig>({ enabled: false, levels: [] });
  // Track original variant combinations to diff on save
  const [originalVariantNames, setOriginalVariantNames] = useState<Set<string>>(new Set());
  const [originalBaseName, setOriginalBaseName] = useState('');
  const [existingVariantMap, setExistingVariantMap] = useState<Map<string, string>>(new Map()); // fullName -> id

  useEffect(() => {
    if (!product || !open) return;
    loadProductData();
  }, [product, open]);

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

  const loadProductData = async () => {
    if (!product) return;
    setIsLoading(true);

    try {
      const name = extractBaseName(product.name, product.variant_1, product.variant_2, product.variant_3);
      setBaseName(name);
      setOriginalBaseName(name);
      setSkuPrefix(product.sku || '');
      setCategoryId(product.category_id || '_none_');
      setImportPrice(String(product.import_price || 0));
      setSalePrice(product.sale_price != null ? String(product.sale_price) : '');
      setNote(product.note || '');

      // Run both queries in parallel for speed
      const [groupResult, variantResult] = await Promise.all([
        supabase
          .from('product_groups')
          .select('*')
          .ilike('name', name)
          .limit(1),
        supabase
          .from('products')
          .select('id, name, variant_1, variant_2, variant_3')
          .eq('status', 'template')
          .ilike('name', `${name}%`)
          .order('name'),
      ]);

      const groupData = groupResult.data;
      const variantProducts = variantResult.data;

      const variants = (variantProducts || []).filter(p => p.variant_1);
      const nameMap = new Map<string, string>();
      const nameSet = new Set<string>();
      variants.forEach(v => {
        nameMap.set(v.name, v.id);
        const combo = [v.variant_1, v.variant_2, v.variant_3].filter(Boolean).join(' ');
        nameSet.add(combo);
      });
      setExistingVariantMap(nameMap);
      setOriginalVariantNames(nameSet);

      const group = groupData?.[0] as any;
      if (group && (group.variant_1_label || group.variant_1_values?.length)) {
        // Rebuild VariantConfig from product_group
        const levels: VariantLevel[] = [];
        if (group.variant_1_label || group.variant_1_values?.length) {
          levels.push({ label: group.variant_1_label || 'Thuộc tính 1', values: group.variant_1_values || [] });
        }
        if (group.variant_2_label || group.variant_2_values?.length) {
          levels.push({ label: group.variant_2_label || 'Thuộc tính 2', values: group.variant_2_values || [] });
        }
        if (group.variant_3_label || group.variant_3_values?.length) {
          levels.push({ label: group.variant_3_label || 'Thuộc tính 3', values: group.variant_3_values || [] });
        }
        setVariantConfig({ enabled: levels.length > 0, levels });
      } else if (variants.length > 0) {
        // No product_group but has variants - reconstruct from variant data
        const v1Set = new Set<string>();
        const v2Set = new Set<string>();
        const v3Set = new Set<string>();
        variants.forEach(v => {
          if (v.variant_1) v1Set.add(v.variant_1);
          if (v.variant_2) v2Set.add(v.variant_2);
          if (v.variant_3) v3Set.add(v.variant_3);
        });
        const levels: VariantLevel[] = [];
        if (v1Set.size > 0) levels.push({ label: 'Thuộc tính 1', values: [...v1Set] });
        if (v2Set.size > 0) levels.push({ label: 'Thuộc tính 2', values: [...v2Set] });
        if (v3Set.size > 0) levels.push({ label: 'Thuộc tính 3', values: [...v3Set] });
        setVariantConfig({ enabled: levels.length > 0, levels });
      } else {
        setVariantConfig({ enabled: false, levels: [] });
      }
    } catch (err) {
      console.error('Error loading product data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCombinations = (levels: VariantLevel[]): string[][] => {
    const activeLevels = levels.filter(l => l.values.length > 0);
    if (activeLevels.length === 0) return [[]];
    const [first, ...rest] = activeLevels;
    const restCombos = generateCombinations(rest);
    const result: string[][] = [];
    for (const value of first.values) {
      for (const combo of restCombos) {
        result.push([value, ...combo]);
      }
    }
    return result;
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

      const defImportPrice = Math.round(Number(importPrice) || 0);
      const defSalePrice = salePrice ? Math.round(Number(salePrice)) : null;
      const catId = categoryId === '_none_' ? null : categoryId;
      const trimmedName = baseName.trim();

      if (variantConfig.enabled && variantConfig.levels.some(l => l.values.length > 0)) {
        const activeLevels = variantConfig.levels.filter(l => l.values.length > 0);
        const combinations = generateCombinations(activeLevels);

        // Build new variant names
        const newVariantFullNames = new Set<string>();
        const newProducts: any[] = [];

        for (const combo of combinations) {
          const variantParts = combo.join(' ');
          const fullName = `${trimmedName} ${variantParts}`;
          newVariantFullNames.add(fullName);

          if (!existingVariantMap.has(fullName)) {
            // Also check if name changed - look by combo
            const oldFullName = `${originalBaseName} ${variantParts}`;
            if (existingVariantMap.has(oldFullName)) {
              // Rename existing
              const existingId = existingVariantMap.get(oldFullName)!;
              const skuSuffix = combo.map(v => v.replace(/\s+/g, '')).join('-');
              await supabase.from('products').update({
                name: fullName,
                sku: skuPrefix ? `${skuPrefix}-${skuSuffix}` : skuSuffix,
                category_id: catId,
                note: note || null,
              }).eq('id', existingId);
            } else {
              // Truly new
              const skuSuffix = combo.map(v => v.replace(/\s+/g, '')).join('-');
              newProducts.push({
                name: fullName,
                sku: skuPrefix ? `${skuPrefix}-${skuSuffix}` : skuSuffix,
                category_id: catId,
                import_price: defImportPrice,
                sale_price: defSalePrice,
                note: note || null,
                tenant_id: tenantId.data,
                status: 'template',
                quantity: 0,
                total_import_cost: 0,
                variant_1: combo[0] || null,
                variant_2: combo[1] || null,
                variant_3: combo[2] || null,
              });
            }
          } else {
            // Existing - update metadata (category, note, name if changed)
            const existingId = existingVariantMap.get(fullName)!;
            await supabase.from('products').update({
              category_id: catId,
              note: note || null,
            }).eq('id', existingId);
          }
        }

        // Also handle renamed base: update existing that match old base name
        if (trimmedName !== originalBaseName) {
          const oldNameVariants = [...existingVariantMap.entries()].filter(
            ([name]) => name.startsWith(originalBaseName) && !newVariantFullNames.has(name)
          );
          // These are variants whose combo was removed - check below in delete logic
        }

        // Delete variants that are no longer in combinations
        const toDeleteIds: string[] = [];
        for (const [fullName, id] of existingVariantMap.entries()) {
          const oldCombo = fullName.replace(`${originalBaseName} `, '');
          const newFullName = `${trimmedName} ${oldCombo}`;
          if (!newVariantFullNames.has(fullName) && !newVariantFullNames.has(newFullName)) {
            toDeleteIds.push(id);
          }
        }

        if (toDeleteIds.length > 0) {
          await supabase.from('products').delete().in('id', toDeleteIds);
        }

        if (newProducts.length > 0) {
          const { error } = await supabase.from('products').insert(newProducts);
          if (error) throw error;
        }

        // Update product_group
        const { data: existingGroup } = await supabase
          .from('product_groups')
          .select('id')
          .ilike('name', originalBaseName)
          .limit(1);

        const groupPayload = {
          name: trimmedName,
          sku_prefix: skuPrefix || null,
          category_id: catId,
          variant_1_label: activeLevels[0]?.label || null,
          variant_2_label: activeLevels[1]?.label || null,
          variant_3_label: activeLevels[2]?.label || null,
          variant_1_values: activeLevels[0]?.values || [],
          variant_2_values: activeLevels[1]?.values || [],
          variant_3_values: activeLevels[2]?.values || [],
        };

        if (existingGroup?.[0]) {
          await supabase.from('product_groups').update(groupPayload as any).eq('id', (existingGroup[0] as any).id);
        } else {
          await supabase.from('product_groups').insert([{ ...groupPayload, tenant_id: tenantId.data } as any]);
        }

        toast({
          title: 'Cập nhật thành công',
          description: `Đã cập nhật biến thể sản phẩm`,
        });
      } else {
        // No variants - update single product
        if (product) {
          const { error } = await supabase
            .from('products')
            .update({
              name: trimmedName,
              sku: skuPrefix.trim() || trimmedName.replace(/\s+/g, '-'),
              import_price: defImportPrice,
              sale_price: defSalePrice,
              category_id: catId,
              note: note || null,
            })
            .eq('id', product.id);
          if (error) throw error;
          toast({ title: 'Cập nhật sản phẩm mẫu thành công' });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-groups'] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview how many variants will be created
  const activeLevels = variantConfig.levels.filter(l => l.values.length > 0);
  const totalCombinations = variantConfig.enabled
    ? activeLevels.reduce((acc, l) => acc * Math.max(l.values.length, 1), 1)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Chỉnh sửa sản phẩm mẫu
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Đang tải...</span>
          </div>
        ) : (
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

            {/* Variant config - same as create dialog */}
            <VariantConfigPanel
              config={variantConfig}
              onChange={setVariantConfig}
              baseProductName={baseName}
            />

            {/* SKU prefix */}
            <div className="space-y-1.5">
              <Label className="text-sm">SKU {variantConfig.enabled ? '(tiền tố)' : ''}</Label>
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

            {/* Prices */}
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

            {/* Variant summary */}
            {variantConfig.enabled && totalCombinations > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                <p>📦 Tổng số biến thể: <span className="font-medium text-foreground">{totalCombinations}</span></p>
                <p className="mt-1">Hiện có: {existingVariantMap.size} | Mới thêm: {Math.max(0, totalCombinations - existingVariantMap.size)}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !baseName.trim() || isLoading}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
