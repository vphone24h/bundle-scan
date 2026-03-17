import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useCategories, useCreateCategory } from '@/hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { VariantConfigPanel, VariantConfig, VariantLevel } from '@/components/import/VariantConfig';
import { VariantSelector, SelectedVariants, buildVariantProductName } from '@/components/import/VariantSelector';
import { useCreateProductGroup } from '@/hooks/useProductGroups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PriceInput } from '@/components/ui/price-input';
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
import { Loader2, Package, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CreateProductTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export function CreateProductTemplateDialog({ open, onOpenChange }: CreateProductTemplateDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const createProductGroup = useCreateProductGroup();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    productName: '',
    sku: '',
    categoryId: '',
    importPrice: '',
    salePrice: '',
    note: '',
  });

  const [variantConfig, setVariantConfig] = useState<VariantConfig>({
    enabled: false,
    levels: [],
  });
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariants>({});

  // Auto-fill SKU when variant selected
  const handleVariantSelectionChange = useCallback(async (newSelected: SelectedVariants) => {
    setSelectedVariants(newSelected);

    const activeLevels = variantConfig.levels.filter(l => l.values.length > 0);
    const allSelected = activeLevels.every((_, idx) => {
      const key = `variant_${idx + 1}` as keyof SelectedVariants;
      return !!newSelected[key];
    });

    if (allSelected && activeLevels.length > 0) {
      const fullName = buildVariantProductName(form.productName, newSelected);
      try {
        const { data: existing } = await supabase
          .from('products')
          .select('sku')
          .ilike('name', fullName)
          .limit(1);
        if (existing?.[0]?.sku) {
          setForm(prev => ({ ...prev, sku: existing[0].sku }));
        }
      } catch {}
    }
  }, [variantConfig, form.productName]);

  const resetForm = () => {
    setForm({ productName: '', sku: '', categoryId: '', importPrice: '', salePrice: '', note: '' });
    setVariantConfig({ enabled: false, levels: [] });
    setSelectedVariants({});
  };

  const handleSubmit = async () => {
    if (!form.productName.trim()) {
      toast({ title: 'Vui lòng nhập tên sản phẩm', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const importPrice = form.importPrice ? Math.round(Number(form.importPrice)) : 0;
      const salePrice = form.salePrice ? Math.round(Number(form.salePrice)) : null;

      // If variants are enabled, create multiple template products
      if (variantConfig.enabled && variantConfig.levels.some(l => l.values.length > 0)) {
        const activeLevels = variantConfig.levels.filter(l => l.values.length > 0);
        
        // Save product group
        try {
          await createProductGroup.mutateAsync({
            name: form.productName,
            sku_prefix: form.sku || undefined,
            category_id: form.categoryId || null,
            variant_1_label: activeLevels[0]?.label,
            variant_2_label: activeLevels[1]?.label,
            variant_3_label: activeLevels[2]?.label,
            variant_1_values: activeLevels[0]?.values || [],
            variant_2_values: activeLevels[1]?.values || [],
            variant_3_values: activeLevels[2]?.values || [],
          });
        } catch {}

        // Generate all variant combinations
        const combinations = generateVariantCombinations(activeLevels);
        const products = combinations.map((combo) => {
          const variantParts = combo.join(' ');
          const fullName = `${form.productName} ${variantParts}`;
          const skuSuffix = combo.map(v => v.replace(/\s+/g, '')).join('-');
          return {
            name: fullName,
            sku: form.sku ? `${form.sku}-${skuSuffix}` : skuSuffix,
            category_id: form.categoryId || null,
            import_price: importPrice,
            sale_price: salePrice,
            note: form.note || null,
            tenant_id: tenantId,
            status: 'template' as const,
            quantity: 0,
            total_import_cost: 0,
            variant_1: combo[0] || null,
            variant_2: combo[1] || null,
            variant_3: combo[2] || null,
          };
        });

        const { error } = await supabase.from('products').insert(products as any[]);
        if (error) throw error;

        toast({
          title: 'Tạo sản phẩm mẫu thành công',
          description: `Đã tạo ${products.length} sản phẩm mẫu với biến thể`,
        });
      } else {
        // Single template product
        const { error } = await supabase.from('products').insert([{
          name: form.productName.trim(),
          sku: form.sku.trim() || form.productName.trim().replace(/\s+/g, '-'),
          category_id: form.categoryId || null,
          import_price: importPrice,
          sale_price: salePrice,
          note: form.note || null,
          tenant_id: tenantId,
          status: 'template' as const,
          quantity: 0,
          total_import_cost: 0,
        } as any]);
        if (error) throw error;

        toast({ title: 'Tạo sản phẩm mẫu thành công' });
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Lỗi tạo sản phẩm mẫu', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Tạo sản phẩm mẫu
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Tạo sản phẩm trước, sau này nhập hàng sẽ tự động gợi ý. Không cần IMEI, NCC hay chi nhánh.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Product name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tên sản phẩm <span className="text-destructive">*</span></Label>
            <Input
              placeholder="VD: iPhone 16 Pro Max"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
            />
          </div>

          {/* Variant config */}
          <VariantConfigPanel
            config={variantConfig}
            onChange={setVariantConfig}
            baseProductName={form.productName}
          />

          {/* Variant selector (if configured) */}
          {variantConfig.enabled && variantConfig.levels.some(l => l.values.length > 0) && (
            <VariantSelector
              levels={variantConfig.levels}
              selected={selectedVariants}
              onChange={handleVariantSelectionChange}
              baseProductName={form.productName}
            />
          )}

          {/* SKU */}
          <div className="space-y-1.5">
            <Label className="text-sm">SKU {variantConfig.enabled ? '(tiền tố)' : ''}</Label>
            <Input
              placeholder="Mã SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm">Danh mục</Label>
            <Select value={form.categoryId || '_none_'} onValueChange={(v) => setForm({ ...form, categoryId: v === '_none_' ? '' : v })}>
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

          {/* Import price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Giá nhập (tham khảo)</Label>
              <PriceInput
                value={form.importPrice}
                onChange={(v) => setForm({ ...form, importPrice: String(v) })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Giá bán (tham khảo)</Label>
              <PriceInput
                value={form.salePrice}
                onChange={(v) => setForm({ ...form, salePrice: String(v) })}
                placeholder="0"
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-sm">Ghi chú</Label>
            <Textarea
              placeholder="Ghi chú thêm..."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.productName.trim()}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {variantConfig.enabled && variantConfig.levels.some(l => l.values.length > 0)
              ? 'Tạo tất cả biến thể'
              : 'Tạo sản phẩm mẫu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function generateVariantCombinations(levels: VariantLevel[]): string[][] {
  if (levels.length === 0) return [[]];
  const [first, ...rest] = levels;
  const restCombinations = generateVariantCombinations(rest);
  const result: string[][] = [];
  for (const value of first.values) {
    for (const combo of restCombinations) {
      result.push([value, ...combo]);
    }
  }
  return result;
}
