import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Package, Upload, Bot, Phone, MessageCircle, FileText, ImageIcon, CheckCircle2 } from 'lucide-react';
import { useInventory, InventoryItem } from '@/hooks/useInventory';
import { useCategories } from '@/hooks/useCategories';
import { useCreateLandingProduct, useUpdateLandingProduct, LandingProduct } from '@/hooks/useLandingProducts';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useTenantLandingSettings } from '@/hooks/useTenantLanding';
import { toast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/formatNumber';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProducts: LandingProduct[];
}

type AIStep = 'select' | 'step1_desc' | 'step2_images' | 'done';

interface ProductAIResult {
  productId: string;
  productName: string;
  description: string | null;
  images: string[];
  landingProductId?: string;
  verifiedName?: string;
  designFeatures?: string;
  productType?: string;
  brand?: string;
}

export function ImportFromWarehouseDialog({ open, onOpenChange, existingProducts }: Props) {
  const { data: inventory, isLoading } = useInventory();
  const { data: categories } = useCategories();
  const { data: tenant } = useCurrentTenant();
  const { data: landingSettings } = useTenantLandingSettings();
  const createProduct = useCreateLandingProduct();
  const updateProduct = useUpdateLandingProduct();

  const { data: platformSettings } = useQuery({
    queryKey: ['platform-admin-contact'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('admin_phone, admin_zalo')
        .limit(1)
        .single();
      return data as { admin_phone: string; admin_zalo: string } | null;
    },
  });

  const aiEnabled = landingSettings?.ai_description_enabled ?? false;
  const autoImageEnabled = landingSettings?.auto_image_enabled ?? false;
  const adminPhone = platformSettings?.admin_phone || '';
  const adminZalo = platformSettings?.admin_zalo || '';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('_all_');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const [aiStep, setAiStep] = useState<AIStep>('select');
  const [aiResults, setAiResults] = useState<ProductAIResult[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  // Build a set of existing product names for filtering
  const existingNames = useMemo(() => {
    return new Set((existingProducts || []).map(p => p.name.toLowerCase().trim()));
  }, [existingProducts]);

  const filteredItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => {
      if (item.stock <= 0) return false;
      // Hide products already added to landing page
      if (existingNames.has(item.productName.toLowerCase().trim())) return false;
      const matchSearch = !search ||
        item.productName.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === '_all_' || item.categoryId === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [inventory, search, categoryFilter, existingNames]);

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

  const generateAIDescription = async (item: InventoryItem): Promise<{ description: string; seo_title: string; seo_description: string; verified_name?: string; design_features?: string; product_type?: string; brand?: string } | null> => {
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

  const generateAIImages = async (productName: string, opts?: { verifiedName?: string; designFeatures?: string; productType?: string; brand?: string }): Promise<string[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-images', {
        body: {
          productName,
          categoryName: '',
          businessType: tenant?.business_type || 'phone_store',
          tenantId: tenant?.id,
          imageCount: 1,
          verifiedName: opts?.verifiedName,
          designFeatures: opts?.designFeatures,
          productType: opts?.productType,
          brand: opts?.brand,
        },
      });
      if (error) throw error;
      return data?.images || [];
    } catch (e) {
      console.error('AI image error:', e);
      return [];
    }
  };

  const resolveLandingCategoryId = async (categoryId: string | null, categoryName: string | null): Promise<string | null> => {
    if (!categoryId || !categoryName) return null;
    try {
      const { data: existing } = await supabase
        .from('landing_product_categories' as any)
        .select('id')
        .eq('name', categoryName)
        .limit(1)
        .maybeSingle();
      if (existing) return (existing as any).id;

      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) return null;
      const { data: created } = await supabase
        .from('landing_product_categories' as any)
        .insert([{ name: categoryName, tenant_id: tenantId }])
        .select('id')
        .single();
      return created ? (created as any).id : null;
    } catch {
      return null;
    }
  };

  // Step 1: Generate descriptions & create products
  const handleAIStep1 = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setAiStep('step1_desc');

    const selectedItems = (inventory || []).filter(i => selected.has(i.productId));
    setTotalSteps(selectedItems.length);
    const results: ProductAIResult[] = [];

    // Pre-resolve categories
    const categoryMap = new Map<string, string | null>();
    for (const item of selectedItems) {
      if (item.categoryId && !categoryMap.has(item.categoryId)) {
        const landingCatId = await resolveLandingCategoryId(item.categoryId, item.categoryName || null);
        categoryMap.set(item.categoryId, landingCatId);
      }
    }

    for (let idx = 0; idx < selectedItems.length; idx++) {
      const item = selectedItems[idx];
      setCurrentStepIdx(idx + 1);
      setAiProgress(`Bước 1: AI đang xác minh & viết mô tả ${idx + 1}/${selectedItems.length}: ${item.productName}`);

      try {
        const firstProduct = item.products[0];
        let salePrice = firstProduct ? (await getSalePrice(firstProduct.id)) : item.avgImportPrice;
        const aiContent = await generateAIDescription(item);
        const landingCategoryId = item.categoryId ? (categoryMap.get(item.categoryId) ?? null) : null;

        // Use verified name from AI if available
        const displayName = aiContent?.verified_name || item.productName;

        const created = await createProduct.mutateAsync({
          name: displayName,
          description: aiContent?.description || null,
          price: salePrice || item.avgImportPrice,
          sale_price: null,
          category_id: landingCategoryId,
          image_url: null,
          images: [],
          is_featured: false,
          is_active: true,
          variants: [],
        });

        results.push({
          productId: item.productId,
          productName: displayName,
          description: aiContent?.description || null,
          images: [],
          landingProductId: (created as any)?.id || undefined,
          verifiedName: aiContent?.verified_name,
          designFeatures: aiContent?.design_features,
          productType: aiContent?.product_type,
          brand: aiContent?.brand,
        });
      } catch (e: any) {
        console.error(`Error step1 ${item.productName}:`, e);
        results.push({
          productId: item.productId,
          productName: item.productName,
          description: null,
          images: [],
        });
      }
    }

    setAiResults(results);
    setAiStep('step2_images');
    setAiProgress('');

    // Automatically start step 2
    await handleAIStep2(results);
  };

  // Step 2: Generate images for each product
  const handleAIStep2 = async (results: ProductAIResult[]) => {
    const productsToProcess = results.filter(r => r.landingProductId);
    setTotalSteps(productsToProcess.length);

    for (let idx = 0; idx < productsToProcess.length; idx++) {
      const result = productsToProcess[idx];
      setCurrentStepIdx(idx + 1);
      setAiProgress(`Bước 2: AI đang tạo ảnh bìa ${idx + 1}/${productsToProcess.length}: ${result.productName}`);

      try {
        const images = await generateAIImages(result.productName, {
          verifiedName: result.verifiedName,
          designFeatures: result.designFeatures,
          productType: result.productType,
          brand: result.brand,
        });
        result.images = images;

        // Update the landing product with generated images
        if (result.landingProductId && images.length > 0) {
          await updateProduct.mutateAsync({
            id: result.landingProductId,
            image_url: images[0], // Cover image
            images: images,
          });
        }
      } catch (e) {
        console.error(`Error generating images for ${result.productName}:`, e);
      }
    }

    setAiResults([...results]);
    setAiStep('done');
    setImporting(false);
    setAiProgress('');

    const successDesc = results.filter(r => r.description).length;
    const successImg = results.filter(r => r.images.length > 0).length;

    toast({
      title: `Hoàn thành! Đã thêm ${results.length} sản phẩm`,
      description: `✍️ ${successDesc} mô tả AI | 📸 ${successImg} bộ ảnh AI`,
    });
  };

  const handleImportManual = async () => {
    if (selected.size === 0) return;
    setImporting(true);

    const selectedItems = (inventory || []).filter(i => selected.has(i.productId));
    let successCount = 0;

    const categoryMap = new Map<string, string | null>();
    for (const item of selectedItems) {
      if (item.categoryId && !categoryMap.has(item.categoryId)) {
        const landingCatId = await resolveLandingCategoryId(item.categoryId, item.categoryName || null);
        categoryMap.set(item.categoryId, landingCatId);
      }
    }

    for (let idx = 0; idx < selectedItems.length; idx++) {
      const item = selectedItems[idx];
      setAiProgress(`Đang thêm ${idx + 1}/${selectedItems.length}: ${item.productName}`);

      try {
        const firstProduct = item.products[0];
        let salePrice = firstProduct ? (await getSalePrice(firstProduct.id)) : item.avgImportPrice;
        const landingCategoryId = item.categoryId ? (categoryMap.get(item.categoryId) ?? null) : null;

        await createProduct.mutateAsync({
          name: item.productName,
          description: null,
          price: salePrice || item.avgImportPrice,
          sale_price: null,
          category_id: landingCategoryId,
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
        : undefined,
    });
  };

  const handleClose = () => {
    if (importing) return;
    setAiStep('select');
    setAiResults([]);
    setSelected(new Set());
    setAiProgress('');
    onOpenChange(false);
  };

  const handleFinish = () => {
    setAiStep('select');
    setAiResults([]);
    setSelected(new Set());
    setAiProgress('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={importing ? undefined : handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Thêm sản phẩm từ kho
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator for AI flow */}
        {(aiStep === 'step1_desc' || aiStep === 'step2_images' || aiStep === 'done') && (
          <div className="flex items-center gap-2 px-1">
            <div className={`flex items-center gap-1.5 text-xs font-medium ${aiStep === 'step1_desc' ? 'text-primary' : 'text-muted-foreground'}`}>
              {aiStep !== 'step1_desc' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              )}
              <FileText className="h-3.5 w-3.5" />
              B1: Mô tả
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className={`flex items-center gap-1.5 text-xs font-medium ${aiStep === 'step2_images' ? 'text-primary' : aiStep === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
              {aiStep === 'done' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : aiStep === 'step2_images' ? (
                <div className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted" />
              )}
              <ImageIcon className="h-3.5 w-3.5" />
              B2: Ảnh AI
            </div>
          </div>
        )}

        {/* Done state */}
        {aiStep === 'done' && (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 border rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Hoàn thành!</p>
                <p className="text-xs text-green-600/80">
                  Đã tạo {aiResults.filter(r => r.description).length} mô tả và {aiResults.filter(r => r.images.length > 0).length} bộ ảnh AI
                </p>
              </div>
            </div>
            {aiResults.map((r, idx) => (
              <div key={idx} className="p-3 rounded-lg border bg-card space-y-2">
                <p className="font-medium text-sm">{r.productName}</p>
                <div className="flex items-center gap-3">
                  <Badge variant={r.description ? "default" : "destructive"} className="text-[10px]">
                    {r.description ? '✍️ Mô tả OK' : '❌ Mô tả lỗi'}
                  </Badge>
                  <Badge variant={r.images.length > 0 ? "default" : "secondary"} className="text-[10px]">
                    📸 {r.images.length} ảnh
                  </Badge>
                </div>
                {r.images.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto">
                    {r.images.map((img, i) => (
                      <div key={i} className="relative shrink-0">
                        <img src={img} alt="" className={`h-16 w-16 rounded-lg object-cover border-2 ${i === 0 ? 'border-primary' : 'border-muted'}`} />
                        {i === 0 && (
                          <span className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[8px] text-center py-0.5 rounded-b-lg">Bìa</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Select state - product list */}
        {aiStep === 'select' && (
          <>
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
          </>
        )}

        {/* Processing state */}
        {(aiStep === 'step1_desc' || aiStep === 'step2_images') && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              {aiStep === 'step1_desc' && <FileText className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
              {aiStep === 'step2_images' && <ImageIcon className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium text-sm">
                {aiStep === 'step1_desc' ? 'Bước 1: Tạo mô tả sản phẩm' : 'Bước 2: Tạo ảnh sản phẩm'}
              </p>
              <p className="text-xs text-muted-foreground">
                {aiStep === 'step2_images' ? 'AI đang tạo ảnh bìa cho sản phẩm' : 'AI đang xác minh sản phẩm & viết mô tả chuẩn SEO'}
              </p>
            </div>
            {aiProgress && (
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 rounded-lg px-4 py-2 max-w-full">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span className="truncate">{aiProgress}</span>
              </div>
            )}
            <div className="w-48 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: totalSteps > 0 ? `${(currentStepIdx / totalSteps) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{currentStepIdx}/{totalSteps}</p>
          </div>
        )}

        <DialogFooter className="shrink-0">
          {aiStep === 'done' ? (
            <Button onClick={handleFinish} className="w-full gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Hoàn tất
            </Button>
          ) : aiStep === 'select' ? (
            <div className="flex flex-col w-full gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Đã chọn: {selected.size} sản phẩm
                </span>
                <Button variant="outline" onClick={handleClose} disabled={importing} size="sm">
                  Huỷ
                </Button>
              </div>
              <div className="flex gap-2 w-full">
                <Button
                  onClick={handleImportManual}
                  disabled={selected.size === 0 || importing}
                  variant="outline"
                  className="flex-1 gap-1.5"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Thêm thủ công
                </Button>

                {aiEnabled ? (
                  <div className="flex-1">
                    <Button
                      onClick={handleAIStep1}
                      disabled={selected.size === 0 || importing}
                      className="w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                      Thêm tự động (AI)
                    </Button>
                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                      B1: Mô tả AI → B2: Ảnh bìa AI
                    </p>
                  </div>
                ) : (
                  <div className="flex-1">
                    <Button disabled className="w-full gap-1.5 opacity-60" variant="secondary">
                      <Bot className="h-4 w-4" />
                      Thêm tự động (AI)
                    </Button>
                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                      B1: Mô tả AI → B2: Ảnh bìa AI
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      {adminPhone && (
                        <a href={`tel:${adminPhone}`} className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                          <Phone className="h-3 w-3" />
                          {adminPhone}
                        </a>
                      )}
                      {adminZalo && (
                        <a href={`https://zalo.me/${adminZalo}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 flex items-center gap-0.5 hover:underline">
                          <MessageCircle className="h-3 w-3" />
                          Zalo
                        </a>
                      )}
                      {!adminPhone && !adminZalo && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />
                          Liên hệ Admin để kích hoạt
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function getSalePrice(productId: string): Promise<number | null> {
  const { data } = await supabase
    .from('products')
    .select('sale_price, import_price')
    .eq('id', productId)
    .single();
  return data?.sale_price || data?.import_price || null;
}
