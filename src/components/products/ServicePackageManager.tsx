import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PriceInput } from '@/components/ui/price-input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Shield, GripVertical, Edit2, Check, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useProductServicePackages,
  useCreateServicePackage,
  useUpdateServicePackage,
  useDeleteServicePackage,
  type ProductServicePackage,
} from '@/hooks/useProductServicePackages';
import { formatNumber } from '@/lib/formatNumber';

interface ServicePackageManagerProps {
  productGroupId: string | null;
  /** Label for "gói dịch vụ" section - customizable per industry */
  sectionLabel?: string;
}

export function ServicePackageManager({
  productGroupId,
  sectionLabel = 'Gói dịch vụ / Bảo hành',
}: ServicePackageManagerProps) {
  const { data: packages = [], isLoading } = useProductServicePackages(productGroupId);
  const createPkg = useCreateServicePackage();
  const updatePkg = useUpdateServicePackage();
  const deletePkg = useDeleteServicePackage();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast({ title: 'Vui lòng nhập tên gói', variant: 'destructive' });
      return;
    }
    if (!productGroupId) {
      toast({ title: 'Vui lòng lưu sản phẩm trước khi thêm gói dịch vụ', variant: 'destructive' });
      return;
    }
    try {
      await createPkg.mutateAsync({
        product_group_id: productGroupId,
        name: newName.trim(),
        price: newPrice,
        description: newDesc.trim() || null,
        display_order: packages.length,
      });
      setNewName('');
      setNewPrice(0);
      setNewDesc('');
      setShowAdd(false);
      toast({ title: 'Đã thêm gói dịch vụ' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePkg.mutateAsync(id);
      toast({ title: 'Đã xóa gói dịch vụ' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const startEdit = (pkg: ProductServicePackage) => {
    setEditingId(pkg.id);
    setEditName(pkg.name);
    setEditPrice(pkg.price);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updatePkg.mutateAsync({ id: editingId, name: editName.trim(), price: editPrice });
      setEditingId(null);
      toast({ title: 'Đã cập nhật' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  if (!productGroupId) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          {sectionLabel}
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {packages.length} gói
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Tạo các gói dịch vụ mà khách có thể chọn thêm khi mua hàng
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Existing packages */}
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="flex items-center gap-2 p-2 rounded-md border bg-background"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {editingId === pkg.id ? (
              <>
                <Input
                  className="h-8 text-sm flex-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <div className="w-28">
                  <PriceInput
                    className="h-8 text-sm"
                    value={editPrice}
                    onChange={setEditPrice}
                  />
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm flex-1 truncate">{pkg.name}</span>
                <span className="text-sm font-medium text-primary whitespace-nowrap">
                  +{formatNumber(pkg.price)}đ
                </span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(pkg)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => handleDelete(pkg.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}

        {/* Add form */}
        {showAdd ? (
          <div className="space-y-2 p-2 rounded-md border border-dashed bg-muted/30">
            <div className="space-y-1">
              <Label className="text-xs">Tên gói</Label>
              <Input
                className="h-8 text-sm"
                placeholder="VD: Gói VIP 12 tháng, Thêm 15P massage..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Giá</Label>
                <PriceInput
                  className="h-8 text-sm"
                  value={newPrice}
                  onChange={setNewPrice}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mô tả (tuỳ chọn)</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Chi tiết gói..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                Huỷ
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={createPkg.isPending}>
                <Plus className="h-3 w-3 mr-1" />
                Thêm
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="h-3 w-3" />
            Thêm gói dịch vụ
          </Button>
        )}
      </CardContent>
    </Card>
  );
}