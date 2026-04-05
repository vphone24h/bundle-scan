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

      await updateProduct.mutateAsync({
        productId: product.id,
        updates,
        oldData,
      });

      // Nếu có cấu hình biến thể, tạo thêm sản phẩm mẫu
      if (variantConfig.enabled && variantConfig.levels.some(l => l.values.length > 0)) {
        const activeLevels = variantConfig.levels.filter(l => l.values.length > 0);
        const combinations = generateVariantCombinations(activeLevels);
        const tenantRes = await supabase.rpc('get_user_tenant_id_secure');
        const tenantId = tenantRes.data;
        
        if (tenantId && combinations.length > 0) {
          const baseName = formData.name.trim();
          const baseImportPrice = product.import_price || 0;
          const baseSalePrice = product.sale_price || null;
          
          // Check existing templates to avoid duplicates
          const { data: existingTemplates } = await supabase
            .from('products')
            .select('name')
            .eq('status', 'template')
            .ilike('name', `${baseName}%`);
          
          const existingNames = new Set((existingTemplates || []).map(t => t.name));
          
          const newTemplates = combinations
            .map(combo => {
              const variantParts = combo.join(' ');
              const fullName = `${baseName} ${variantParts}`;
              if (existingNames.has(fullName)) return null;
              const skuSuffix = combo.map(v => v.replace(/\s+/g, '')).join('-');
              return {
                name: fullName,
                sku: formData.sku ? `${formData.sku}-${skuSuffix}` : skuSuffix,
                category_id: formData.category_id === '_none_' ? null : formData.category_id,
                import_price: Math.round(Number(baseImportPrice)),
                sale_price: baseSalePrice ? Math.round(Number(baseSalePrice)) : null,
                note: formData.note || null,
                tenant_id: tenantId,
                status: 'template' as const,
                quantity: 0,
                total_import_cost: 0,
                variant_1: combo[0] || null,
                variant_2: combo[1] || null,
                variant_3: combo[2] || null,
              };
            })
            .filter(Boolean);
          
          if (newTemplates.length > 0) {
            const { error: templateError } = await supabase.from('products').insert(newTemplates as any[]);
            if (templateError) throw templateError;
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

          toast({
            title: 'Cập nhật thành công',
            description: `Đã cập nhật sản phẩm và tạo ${newTemplates.length} biến thể mẫu`,
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
                onChange={setVariantConfig}
                baseProductName={formData.name}
              />

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
