import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Package, Upload } from 'lucide-react';
import { useInventory, InventoryItem } from '@/hooks/useInventory';
import { useCategories } from '@/hooks/useCategories';
import { useCreateLandingProduct, LandingProduct } from '@/hooks/useLandingProducts';
import { useCurrentTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/formatNumber';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProducts: LandingProduct[];
}

export function ImportFromWarehouseDialog({ open, onOpenChange, existingProducts }: Props) {
  const { data: inventory, isLoading } = useInventory();
  const { data: categories } = useCategories();
  const { data: tenant } = useCurrentTenant();
  const createProduct = useCreateLandingProduct();

  // Read global AI settings from platform_settings
  const { data: platformSettings } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('ai_description_enabled, auto_image_enabled')
        .limit(1)
        .single();
      if (error) return { ai_description_enabled: true, auto_image_enabled: true };
      return data;
    },
  });
  const aiDescriptionEnabled = platformSettings?.ai_description_enabled ?? true;
  const autoImageEnabled = platformSettings?.auto_image_enabled ?? true;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('_all_');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [aiProgress, setAiProgress] = useState('');

  // Filter inventory items that are in stock
  const filteredItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => {
      if (item.stock <= 0) return false;
      const matchSearch = !search ||
        item.productName.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === '_all_' || item.categoryId === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [inventory, search, categoryFilter]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredItems.map(i => i.productId)));
    }
  };

  const generateAIDescription = async (item: InventoryItem): Promise<{ description: string; seo_title: string; seo_description: string } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-description', {
        body: {
          productName: item.productName,
          sku: item.sku,
          categoryName: item.categoryName,
          salePrice: item.avgImportPrice,
          storeName: tenant?.name || '',
          businessType: tenant?.business_type || 'phone_store',
        },
      });
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('AI description error:', e);
      return null;
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);

    const selectedItems = (inventory || []).filter(i => selected.has(i.productId));
    let successCount = 0;

    for (let idx = 0; idx < selectedItems.length; idx++) {
      const item = selectedItems[idx];
      setAiProgress(`Đang xử lý ${idx + 1}/${selectedItems.length}: ${item.productName}${aiDescriptionEnabled ? ' (AI đang viết mô tả...)' : ''}`);

      try {
        // Get sale_price from the first product detail
        const firstProduct = item.products[0];
        let salePrice = firstProduct ? (await getSalePrice(firstProduct.id)) : item.avgImportPrice;

        // Generate AI description only if enabled
        const aiContent = aiDescriptionEnabled ? await generateAIDescription(item) : null;

        await createProduct.mutateAsync({
          name: item.productName,
          description: aiContent?.description || null,
          price: salePrice || item.avgImportPrice,
          sale_price: null,
          category_id: item.categoryId || null,
          image_url: null,
          images: [],
          is_featured: false,
          is_active: true,
          variants: [],
        });
        successCount++;
      } catch (e: any) {
        console.error(`Error importing ${item.productName}:`, e);
      }
    }

    setImporting(false);
    setAiProgress('');
    setSelected(new Set());
    onOpenChange(false);
    toast({
      title: `Đã đưa ${successCount} sản phẩm lên website`,
      description: successCount < selectedItems.length
        ? `${selectedItems.length - successCount} sản phẩm lỗi`
        : 'AI đã tự động viết mô tả cho từng sản phẩm',
    });
  };

  return (
    <Dialog open={open} onOpenChange={importing ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Thêm sản phẩm từ kho
          </DialogTitle>
        </DialogHeader>

        {/* Search & filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm tên, mã sản phẩm..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Danh mục" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="_all_">Tất cả</SelectItem>
              {categories?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 border rounded-lg p-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {search ? 'Không tìm thấy sản phẩm phù hợp' : 'Kho hàng trống'}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
                <Checkbox
                  checked={selected.size === filteredItems.length && filteredItems.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">
                  Chọn tất cả ({filteredItems.length} sản phẩm)
                </span>
              </div>
              {filteredItems.map(item => (
                <label
                  key={item.productId}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                    selected.has(item.productId) ? 'bg-primary/5 border border-primary/20' : 'border border-transparent'
                  }`}
                >
                  <Checkbox
                    checked={selected.has(item.productId)}
                    onCheckedChange={() => toggleSelect(item.productId)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.productName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.sku}</span>
                      {item.categoryName && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          {item.categoryName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">
                      {item.products[0] ? formatNumber(item.products[0].importPrice) : formatNumber(item.avgImportPrice)}đ
                    </p>
                    <p className="text-xs text-muted-foreground">Tồn: {item.stock}</p>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        {/* AI progress */}
        {importing && aiProgress && (
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 rounded-lg px-3 py-2">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span className="truncate">{aiProgress}</span>
          </div>
        )}

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">
              Đã chọn: {selected.size} sản phẩm
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
                Huỷ
              </Button>
              <Button
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className="gap-1.5"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Đưa lên Website
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to get sale_price from products table
async function getSalePrice(productId: string): Promise<number | null> {
  const { data } = await supabase
    .from('products')
    .select('sale_price, import_price')
    .eq('id', productId)
    .single();
  return data?.sale_price || data?.import_price || null;
}
