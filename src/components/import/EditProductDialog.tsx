import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { VariantConfigPanel, VariantConfig, VariantLevel } from '@/components/import/VariantConfig';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBranches } from '@/hooks/useBranches';
import { usePermissions } from '@/hooks/usePermissions';
import type { Product } from '@/hooks/useProducts';
import { formatCurrency } from '@/lib/mockData';
import { PriceInput } from '@/components/ui/price-input';
import { PRODUCT_UNITS } from '@/types/warehouse';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface EditProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: branches } = useBranches();
  const { data: permissions } = usePermissions();
  const isSuperAdmin = permissions?.canViewAllBranches === true;
  const canEditSalePrice = permissions?.canEditSalePrice === true;
  const isBranchAdmin = permissions?.role === 'branch_admin';

  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked: securityUnlocked, unlock: securityUnlock } = useSecurityUnlock('edit-import-date');
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState<string | null>(null);

  // Branch Admin chỉ được sửa sản phẩm thuộc chi nhánh mình
  const isOwnBranch = isSuperAdmin || (product?.branch_id === permissions?.branchId);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    imei: '',
    note: '',
    sale_price: '',
    category_id: '',
    supplier_id: '',
    branch_id: '',
    unit: 'cái',
    import_date: '',
  });

  const [variantConfig, setVariantConfig] = useState<VariantConfig>({ enabled: false, levels: [] });
  const [variantImeis, setVariantImeis] = useState<Record<string, string>>({});
  const [variantPrices, setVariantPrices] = useState<Record<string, string>>({});
  const [originalImportDate, setOriginalImportDate] = useState('');

  useEffect(() => {
    if (product) {
      const importDateStr = product.import_date ? format(parseISO(product.import_date), 'yyyy-MM-dd\'T\'HH:mm') : '';
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        imei: product.imei || '',
        note: product.note || '',
        sale_price: product.sale_price != null ? String(product.sale_price) : '',
        category_id: product.category_id || '_none_',
        supplier_id: product.supplier_id || '_none_',
        branch_id: product.branch_id || '_none_',
        unit: product.unit || 'cái',
        import_date: importDateStr,
      });
      setOriginalImportDate(importDateStr);
      setVariantConfig({ enabled: false, levels: [] });
      setVariantImeis({});
    }
  }, [product]);

  const handleImportDateChange = (newDate: string) => {
    if (newDate !== originalImportDate && hasSecurityPassword && !securityUnlocked) {
      setPendingDateChange(newDate);
      setShowSecurityDialog(true);
      return;
    }
    setFormData(prev => ({ ...prev, import_date: newDate }));
  };

  const handleSecuritySuccess = () => {
    securityUnlock();
    setShowSecurityDialog(false);
    if (pendingDateChange) {
      setFormData(prev => ({ ...prev, import_date: pendingDateChange }));
      setPendingDateChange(null);
    }
  };

  const updateProduct = useMutation({
    mutationFn: async ({ 
      productId, 
      updates,
      oldData
    }: { 
      productId: string; 
      updates: Record<string, any>;
      oldData: Record<string, any>;
    }) => {
      // Kiểm tra IMEI trùng nếu có giá trị mới
      if (updates.imei) {
        const { data: existing } = await supabase
          .from('products')
          .select('id, name, sku')
          .eq('imei', updates.imei)
          .neq('id', productId)
          .in('status', ['in_stock', 'warranty'])
          .limit(1);

        if (existing && existing.length > 0) {
          throw new Error(`IMEI "${updates.imei}" đã tồn tại trong kho (${existing[0].name} - ${existing[0].sku})`);
        }
      }

      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;

      // Ghi nhận lịch sử thao tác
      const tenantId = await supabase.rpc('get_user_tenant_id_secure');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (tenantId.data) {
        const isDateChanged = updates.import_date && oldData.import_date !== updates.import_date;
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId.data,
          user_id: user?.id,
          action_type: isDateChanged ? 'UPDATE_IMPORT_DATE' : 'UPDATE',
          table_name: 'products',
          record_id: productId,
          description: isDateChanged 
            ? `Chỉnh sửa ngày nhập: ${oldData.name} (${oldData.import_date} → ${updates.import_date})`
            : `Chỉnh sửa sản phẩm: ${oldData.name}`,
          old_data: oldData,
          new_data: updates,
          branch_id: updates.branch_id || oldData.branch_id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
    },
  });

  const handleSubmit = async () => {
    if (!product) return;
    if (!isOwnBranch && isBranchAdmin) return;
    if (!formData.name.trim()) {
      toast({ title: 'Lỗi', description: 'Tên sản phẩm không được để trống', variant: 'destructive' });
      return;
    }

    if (!formData.sku.trim()) {
      toast({ title: 'Lỗi', description: 'SKU không được để trống', variant: 'destructive' });
      return;
    }

    try {
      const oldData: Record<string, any> = {
        name: product.name,
        sku: product.sku,
        imei: product.imei,
        note: product.note,
        sale_price: product.sale_price ?? null,
        category_id: product.category_id,
        supplier_id: product.supplier_id,
        branch_id: product.branch_id,
        import_date: product.import_date,
      };

      const hasVariants = variantConfig.enabled && variantConfig.levels.some(l => l.values.length > 0);
      const productHasImei = !!(product.imei || formData.imei.trim());

      const updates: Record<string, any> = {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        imei: formData.imei.trim() || null,
        note: formData.note.trim() || null,
        category_id: formData.category_id === '_none_' ? null : formData.category_id,
        supplier_id: formData.supplier_id === '_none_' ? null : formData.supplier_id,
        unit: product.imei ? 'cái' : formData.unit,
      };

      // Chỉ Super Admin / Branch Admin mới được sửa giá bán
      if (canEditSalePrice) {
        updates.sale_price = formData.sale_price ? Number(formData.sale_price) : null;
      }
      if (isSuperAdmin) {
        updates.branch_id = formData.branch_id === '_none_' ? null : formData.branch_id;
      }

      // Chỉnh sửa ngày nhập
      const dateChanged = formData.import_date && formData.import_date !== originalImportDate;
      if (dateChanged) {
        updates.import_date = new Date(formData.import_date).toISOString();
        updates.import_date_modified = true;
      }

      // === Logic IMEI + biến thể ===
      // Khi bật biến thể: dùng variantImeis map từ UI
      if (hasVariants) {
        const activeLevels = variantConfig.levels.filter(l => l.values.length > 0);
        const combinations = generateVariantCombinations(activeLevels);
        const baseName = formData.name.trim();

        if (combinations.length > 0) {
          // Tìm biến thể mà user gán IMEI hiện tại của SP gốc (hoặc combo đầu tiên có IMEI)
          let matchedCombo: string[] | null = null;
          for (const combo of combinations) {
            const key = combo.join('|');
            const imeiVal = variantImeis[key]?.trim();
            if (imeiVal) {
              matchedCombo = combo;
              break;
            }
          }
          // Nếu không có IMEI nào được nhập, lấy combo đầu tiên
          if (!matchedCombo) matchedCombo = combinations[0];

          const variantName = `${baseName} ${matchedCombo.join(' ')}`.trim();
          updates.name = variantName;
          updates.variant_1 = matchedCombo[0] || null;
          updates.variant_2 = matchedCombo[1] || null;
          updates.variant_3 = matchedCombo[2] || null;
          updates.imei = variantImeis[matchedCombo.join('|')]?.trim() || null;

          const skuSuffix = matchedCombo.map(v => v.replace(/\s+/g, '')).join('-');
          updates.sku = formData.sku ? `${formData.sku}-${skuSuffix}` : skuSuffix;
        }
      }

      // Nếu SP mẫu (template) được thêm IMEI → tạo phiếu nhập tự động
      const isTemplateGettingImei = product.status === 'template' && !product.imei && (updates.imei || formData.imei.trim());
      let autoReceiptId: string | null = null;

      if (isTemplateGettingImei) {
        const tenantRes = await supabase.rpc('get_user_tenant_id_secure');
        const tenantId = tenantRes.data;
        const { data: { user } } = await supabase.auth.getUser();
        
        if (tenantId && user) {
          const now = new Date();
          const code = `PN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
          const importPrice = product.import_price || 0;

          const { data: receipt, error: receiptErr } = await supabase
            .from('import_receipts')
            .insert([{
              code,
              total_amount: importPrice,
              paid_amount: importPrice,
              debt_amount: 0,
              original_debt_amount: 0,
              supplier_id: product.supplier_id || null,
              branch_id: product.branch_id || null,
              created_by: user.id,
              tenant_id: tenantId,
              note: `Nhập từ sản phẩm mẫu: ${updates.name || formData.name}`,
            }])
            .select()
            .single();

          if (!receiptErr && receipt) {
            autoReceiptId = receipt.id;
            // Cập nhật thêm trạng thái và liên kết phiếu nhập
            updates.status = 'in_stock';
            updates.quantity = 1;
            updates.total_import_cost = importPrice;
            updates.import_receipt_id = receipt.id;
            updates.import_date = now.toISOString();
          }
        }
      }

      await updateProduct.mutateAsync({
        productId: product.id,
        updates,
        oldData,
      });

      // Tạo product_imports record nếu có phiếu nhập tự động
      if (autoReceiptId) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('product_imports').insert([{
          product_id: product.id,
          import_receipt_id: autoReceiptId,
          quantity: 1,
          import_price: product.import_price || 0,
          supplier_id: product.supplier_id || null,
          note: `Nhập từ sản phẩm mẫu`,
          created_by: user?.id,
        }]);
      }

      // Nếu có cấu hình biến thể, tạo thêm sản phẩm mẫu cho các biến thể còn lại
      if (hasVariants) {
        const activeLevels = variantConfig.levels.filter(l => l.values.length > 0);
        const combinations = generateVariantCombinations(activeLevels);
        const tenantRes = await supabase.rpc('get_user_tenant_id_secure');
        const tenantId = tenantRes.data;
        
        if (tenantId && combinations.length > 0) {
          const baseName = formData.name.trim();
          const baseImportPrice = product.import_price || 0;
          const baseSalePrice = product.sale_price || null;
          
          // Lấy tất cả sản phẩm cùng tên gốc (kể cả SP vừa update) để tránh trùng
          const { data: existingProducts } = await supabase
            .from('products')
            .select('name')
            .or(`status.eq.template,status.eq.in_stock,status.eq.sold`)
            .ilike('name', `${baseName}%`);
          
          const existingNames = new Set((existingProducts || []).map(t => t.name));
          // Thêm tên SP vừa update vào set
          existingNames.add(updates.name);
          
          const newTemplates = combinations
            .map(combo => {
              const variantParts = combo.join(' ');
              const fullName = `${baseName} ${variantParts}`;
              if (existingNames.has(fullName)) return null;
              const skuSuffix = combo.map(v => v.replace(/\s+/g, '')).join('-');
              const comboKey = combo.join('|');
              const comboImei = variantImeis[comboKey]?.trim() || null;
              return {
                name: fullName,
                sku: formData.sku ? `${formData.sku}-${skuSuffix}` : skuSuffix,
                category_id: formData.category_id === '_none_' ? null : formData.category_id,
                import_price: Math.round(Number(baseImportPrice)),
                sale_price: baseSalePrice ? Math.round(Number(baseSalePrice)) : null,
                imei: comboImei,
                note: formData.note || null,
                tenant_id: tenantId,
                status: comboImei ? 'in_stock' as const : 'template' as const,
                quantity: comboImei ? 1 : 0,
                total_import_cost: comboImei ? Math.round(Number(baseImportPrice)) : 0,
                variant_1: combo[0] || null,
                variant_2: combo[1] || null,
                variant_3: combo[2] || null,
              };
            })
            .filter(Boolean);
          
          if (newTemplates.length > 0) {
            const { data: insertedTemplates, error: templateError } = await supabase
              .from('products')
              .insert(newTemplates as any[])
              .select('id, name, imei, import_price, supplier_id, branch_id');
            if (templateError) throw templateError;

            // Tạo phiếu nhập cho các biến thể có IMEI
            const templatesWithImei = (insertedTemplates || []).filter((t: any) => t.imei);
            if (templatesWithImei.length > 0) {
              const { data: { user } } = await supabase.auth.getUser();
              for (const t of templatesWithImei) {
                const now = new Date();
                const rCode = `PN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
                const { data: newReceipt } = await supabase
                  .from('import_receipts')
                  .insert([{
                    code: rCode,
                    total_amount: t.import_price || 0,
                    paid_amount: t.import_price || 0,
                    debt_amount: 0,
                    original_debt_amount: 0,
                    supplier_id: t.supplier_id || null,
                    branch_id: t.branch_id || null,
                    created_by: user?.id,
                    tenant_id: tenantId,
                    note: `Nhập từ sản phẩm mẫu: ${t.name}`,
                  }])
                  .select()
                  .single();

                if (newReceipt) {
                  await supabase.from('products').update({
                    import_receipt_id: newReceipt.id,
                    import_date: new Date().toISOString(),
                  }).eq('id', t.id);

                  await supabase.from('product_imports').insert([{
                    product_id: t.id,
                    import_receipt_id: newReceipt.id,
                    quantity: 1,
                    import_price: t.import_price || 0,
                    supplier_id: t.supplier_id || null,
                    note: 'Nhập từ sản phẩm mẫu',
                    created_by: user?.id,
                  }]);
                }
              }
            }
          }

          // Save/update product_group
          const { data: existingGroup } = await supabase
            .from('product_groups')
            .select('id')
            .ilike('name', baseName)
            .limit(1);
          
          const groupPayload = {
            name: baseName,
            sku_prefix: formData.sku || null,
            category_id: formData.category_id === '_none_' ? null : formData.category_id,
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
            await supabase.from('product_groups').insert([{ ...groupPayload, tenant_id: tenantId } as any]);
          }

          const createdCount = newTemplates.length;
          toast({
            title: 'Cập nhật thành công',
            description: productHasImei 
              ? `IMEI đã gắn vào biến thể "${updates.name}"${createdCount > 0 ? ` • Tạo ${createdCount} biến thể mẫu` : ''}`
              : `Đã cập nhật sản phẩm${createdCount > 0 ? ` và tạo ${createdCount} biến thể mẫu` : ''}`,
          });
          queryClient.invalidateQueries({ queryKey: ['product-groups'] });
        }
      } else {
        toast({
          title: 'Cập nhật thành công',
          description: 'Thông tin sản phẩm đã được cập nhật',
        });
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error('Edit product error:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật sản phẩm',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa sản phẩm</DialogTitle>
        </DialogHeader>

        {product && !isOwnBranch && isBranchAdmin && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-center">
            <p className="text-sm text-destructive font-medium">
              Sản phẩm thuộc chi nhánh khác. Bạn không có quyền chỉnh sửa.
            </p>
          </div>
        )}

        {product && (isOwnBranch || !isBranchAdmin) && (
          <div className="space-y-4">
            {/* Giá nhập - chỉ hiển thị cho ai có quyền xem giá nhập (Admin, Kế toán) */}
            {permissions?.canViewImportPrice && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Giá nhập:</span>
                  <span className="font-medium">
                    {formatCurrency(Number(product.import_price))} (không thể sửa)
                  </span>
                </div>
              </div>
            )}

            {/* Giá bán - editable cho Admin, read-only cho Kế toán/Nhân viên */}
            {canEditSalePrice ? (
              <div className="space-y-2">
                <Label htmlFor="sale_price">Giá bán</Label>
                <PriceInput
                  id="sale_price"
                  value={formData.sale_price}
                  onChange={(value) => setFormData(prev => ({ ...prev, sale_price: String(value) }))}
                  placeholder="Nhập giá bán"
                />
              </div>
            ) : (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Giá bán:</span>
                  <span className="font-medium">
                    {product.sale_price ? formatCurrency(Number(product.sale_price)) : 'Chưa đặt giá'} (không thể sửa)
                  </span>
                </div>
              </div>
            )}

            {/* Editable fields */}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên sản phẩm <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nhập tên sản phẩm"
                />
              </div>

              {/* Variant config - cho phép thêm biến thể */}
              <VariantConfigPanel
                config={variantConfig}
                onChange={(newConfig) => {
                  setVariantConfig(newConfig);
                  // Auto-populate current IMEI to first variant when enabling
                  if (newConfig.enabled && !variantConfig.enabled && formData.imei.trim()) {
                    const activeLevels = newConfig.levels.filter(l => l.values.length > 0);
                    const combos = generateVariantCombinations(activeLevels);
                    if (combos.length > 0 && combos[0].length > 0) {
                      setVariantImeis({ [combos[0].join('|')]: formData.imei.trim() });
                    }
                  }
                }}
                baseProductName={formData.name}
              />

              {/* IMEI per variant */}
              {variantConfig.enabled && (() => {
                const activeLevels = variantConfig.levels.filter(l => l.values.length > 0);
                const combos = generateVariantCombinations(activeLevels);
                if (combos.length === 0 || (combos.length === 1 && combos[0].length === 0)) return null;
                return (
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Gắn IMEI cho từng biến thể:</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {combos.map((combo, idx) => {
                        const key = combo.join('|');
                        const variantLabel = `${formData.name.trim()} ${combo.join(' ')}`;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs min-w-0 flex-1 truncate" title={variantLabel}>{variantLabel}</span>
                            <Input
                              value={variantImeis[key] || ''}
                              onChange={(e) => setVariantImeis(prev => ({ ...prev, [key]: e.target.value }))}
                              placeholder="IMEI"
                              className="font-mono text-xs w-40 h-7"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU <span className="text-destructive">*</span></Label>
                  <div className="flex gap-1.5">
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                      placeholder="Mã viết tắt"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      title="Copy tên sản phẩm làm SKU"
                      onClick={() => {
                        if (formData.name.trim()) {
                          setFormData(prev => ({ ...prev, sku: prev.name.trim() }));
                        }
                      }}
                      disabled={!formData.name.trim()}
                    >
                      <span className="text-xs font-medium">A→</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Mã viết tắt tên SP, dễ nhớ</p>
                </div>
                {!variantConfig.enabled && (
                <div className="space-y-2">
                  <Label htmlFor="imei">IMEI</Label>
                  <Input
                    id="imei"
                    value={formData.imei}
                    onChange={(e) => setFormData(prev => ({ ...prev, imei: e.target.value }))}
                    placeholder="Nhập IMEI"
                    className="font-mono"
                  />
                </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Textarea
                  id="note"
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Nhập ghi chú (pin, tình trạng máy...)"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Thư mục</Label>
                <Select 
                  value={formData.category_id} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn thư mục" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="_none_">Không có</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nhà cung cấp</Label>
                <Select 
                  value={formData.supplier_id} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, supplier_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhà cung cấp" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="_none_">Không có</SelectItem>
                    {suppliers?.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Đơn vị tính - chỉ hiện cho sản phẩm không IMEI */}
              {!product.imei && (
                <div className="space-y-2">
                  <Label>Đơn vị tính</Label>
                  <Select 
                    value={formData.unit} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, unit: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn đơn vị" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {PRODUCT_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Đơn vị kg, lít, mét cho phép nhập số thập phân
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Chi nhánh</Label>
                {isSuperAdmin ? (
                  <Select 
                    value={formData.branch_id} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, branch_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chi nhánh" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="_none_">Không có</SelectItem>
                      {branches?.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Input
                      value={product?.branches?.name || 'Không có'}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Để đổi chi nhánh: vào <strong>Lịch sử nhập hàng</strong> → tab <strong>Theo sản phẩm</strong> → tích chọn sản phẩm → bấm nút <strong>Chuyển hàng</strong>
                    </p>
                  </>
                )}
              </div>

              {/* Ngày nhập */}
              <div className="space-y-2">
                <Label htmlFor="import_date" className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Ngày giờ nhập
                </Label>
                <Input
                  id="import_date"
                  type="datetime-local"
                  value={formData.import_date}
                  onChange={(e) => handleImportDateChange(e.target.value)}
                  className={cn(
                    formData.import_date !== originalImportDate && 'border-green-500 ring-1 ring-green-500/30'
                  )}
                />
                {formData.import_date !== originalImportDate && (
                  <p className="text-xs text-green-600 font-medium">
                    ⚠ Ngày nhập đã thay đổi — sản phẩm sẽ hiển thị ở ngày mới trong lịch sử nhập
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={updateProduct.isPending || (!isOwnBranch && isBranchAdmin)}>
            {updateProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <SecurityPasswordDialog
      open={showSecurityDialog}
      onOpenChange={setShowSecurityDialog}
      onSuccess={handleSecuritySuccess}
      title="Xác nhận chỉnh sửa ngày nhập"
      description="Thay đổi ngày nhập là thao tác nhạy cảm. Vui lòng nhập mật khẩu bảo mật."
    />
    </>
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
