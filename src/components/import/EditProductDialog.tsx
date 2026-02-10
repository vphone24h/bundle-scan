import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBranches } from '@/hooks/useBranches';
import { usePermissions } from '@/hooks/usePermissions';
import type { Product } from '@/hooks/useProducts';
import { formatCurrency } from '@/lib/mockData';
import { PriceInput } from '@/components/ui/price-input';

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
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        imei: product.imei || '',
        note: product.note || '',
        sale_price: product.sale_price != null ? String(product.sale_price) : '',
        category_id: product.category_id || '_none_',
        supplier_id: product.supplier_id || '_none_',
        branch_id: product.branch_id || '_none_',
      });
    }
  }, [product]);

  const updateProduct = useMutation({
    mutationFn: async ({ 
      productId, 
      updates,
      oldData
    }: { 
      productId: string; 
      updates: {
        name?: string;
        sku?: string;
        imei?: string | null;
        note?: string | null;
        sale_price?: number | null;
        category_id?: string | null;
        supplier_id?: string | null;
        branch_id?: string | null;
      };
      oldData: {
        name: string;
        sku: string;
        imei: string | null;
        note: string | null;
        sale_price: number | null;
        category_id: string | null;
        supplier_id: string | null;
        branch_id: string | null;
      };
    }) => {
      // Kiểm tra IMEI trùng nếu có giá trị mới
      if (updates.imei) {
        const { data: existing } = await supabase
          .from('products')
          .select('id, name, sku')
          .eq('imei', updates.imei)
          .neq('id', productId)
          .in('status', ['in_stock', 'sold', 'returned'])
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
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId.data,
          user_id: user?.id,
          action_type: 'UPDATE',
          table_name: 'products',
          record_id: productId,
          description: `Chỉnh sửa sản phẩm: ${oldData.name}`,
          old_data: oldData,
          new_data: updates,
          branch_id: updates.branch_id || oldData.branch_id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
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
      const oldData = {
        name: product.name,
        sku: product.sku,
        imei: product.imei,
        note: product.note,
        sale_price: product.sale_price ?? null,
        category_id: product.category_id,
        supplier_id: product.supplier_id,
        branch_id: product.branch_id,
      };

      const updates: Record<string, any> = {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        imei: formData.imei.trim() || null,
        note: formData.note.trim() || null,
        category_id: formData.category_id === '_none_' ? null : formData.category_id,
        supplier_id: formData.supplier_id === '_none_' ? null : formData.supplier_id,
      };

      // Chỉ Super Admin / Branch Admin mới được sửa giá bán
      if (canEditSalePrice) {
        updates.sale_price = formData.sale_price ? Number(formData.sale_price) : null;
      }
      if (isSuperAdmin) {
        updates.branch_id = formData.branch_id === '_none_' ? null : formData.branch_id;
      }

      await updateProduct.mutateAsync({
        productId: product.id,
        updates,
        oldData,
      });

      toast({
        title: 'Cập nhật thành công',
        description: 'Thông tin sản phẩm đã được cập nhật',
      });

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
            {/* Price - read only */}
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

            {/* Sale price - editable for Super Admin & Branch Admin */}
            {canEditSalePrice && (
              <div className="space-y-2">
                <Label htmlFor="sale_price">Giá bán</Label>
                <PriceInput
                  id="sale_price"
                  value={formData.sale_price}
                  onChange={(value) => setFormData(prev => ({ ...prev, sale_price: String(value) }))}
                  placeholder="Nhập giá bán"
                />
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
  );
}
