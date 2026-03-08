import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Package, FolderOpen } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductCommission {
  id: string;
  target_type: string;
  target_id: string;
  target_name: string;
  commission_type: string;
  commission_value: number;
  is_active: boolean;
  created_at: string;
}

function useProductCommissions() {
  return useQuery({
    queryKey: ['ctv-product-commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ctv_product_commissions')
        .select('*')
        .order('target_type', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProductCommission[];
    },
  });
}

function useUpsertProductCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<ProductCommission> & { id?: string }) => {
      if (item.id) {
        const { error } = await supabase
          .from('ctv_product_commissions')
          .update({
            target_type: item.target_type,
            target_id: item.target_id,
            target_name: item.target_name,
            commission_type: item.commission_type,
            commission_value: item.commission_value,
            is_active: item.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ctv_product_commissions')
          .insert({
            target_type: item.target_type,
            target_id: item.target_id,
            target_name: item.target_name,
            commission_type: item.commission_type,
            commission_value: item.commission_value,
            is_active: item.is_active ?? true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ctv-product-commissions'] });
      toast.success('Đã lưu cấu hình hoa hồng sản phẩm');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

function useDeleteProductCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ctv_product_commissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ctv-product-commissions'] });
      toast.success('Đã xóa');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function CTVProductCommissions() {
  const { data: commissions, isLoading } = useProductCommissions();
  const upsert = useUpsertProductCommission();
  const remove = useDeleteProductCommission();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCommission | null>(null);
  const [form, setForm] = useState({
    target_type: 'product' as string,
    target_name: '',
    target_id: '',
    commission_type: 'percentage' as string,
    commission_value: 5,
    is_active: true,
  });

  const filtered = commissions?.filter(c =>
    c.target_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditing(null);
    setForm({ target_type: 'product', target_name: '', target_id: '', commission_type: 'percentage', commission_value: 5, is_active: true });
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: ProductCommission) => {
    setEditing(item);
    setForm({
      target_type: item.target_type,
      target_name: item.target_name,
      target_id: item.target_id,
      commission_type: item.commission_type,
      commission_value: item.commission_value,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    await upsert.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      target_type: form.target_type,
      target_id: form.target_id || crypto.randomUUID(),
      target_name: form.target_name,
      commission_type: form.commission_type,
      commission_value: form.commission_value,
      is_active: form.is_active,
    });
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Xác nhận xóa?')) await remove.mutateAsync(id);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Hoa hồng theo Sản phẩm / Danh mục
            </CardTitle>
            <CardDescription>
              Cấu hình mức hoa hồng CTV riêng cho từng sản phẩm hoặc danh mục
            </CardDescription>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <SearchInput placeholder="Tìm kiếm..." value={search} onChange={setSearch} containerClassName="flex-1 sm:w-48" />
            <Button onClick={handleOpenAdd} size="sm">
              <Plus className="mr-1 h-4 w-4" /> Thêm
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Kiểu HH</TableHead>
                <TableHead className="text-right">Giá trị</TableHead>
                <TableHead className="text-center">Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!filtered?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Chưa có cấu hình hoa hồng sản phẩm/danh mục
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={item.target_type === 'category' ? 'secondary' : 'outline'}>
                        {item.target_type === 'category' ? (
                          <><FolderOpen className="h-3 w-3 mr-1" /> Danh mục</>
                        ) : (
                          <><Package className="h-3 w-3 mr-1" /> Sản phẩm</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.target_name}</TableCell>
                    <TableCell>{item.commission_type === 'percentage' ? 'Phần trăm' : 'Cố định'}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {item.commission_type === 'percentage'
                        ? `${item.commission_value}%`
                        : `${Number(item.commission_value).toLocaleString('vi-VN')} ₫`}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={item.is_active ? 'default' : 'secondary'}>
                        {item.is_active ? 'Hoạt động' : 'Tắt'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa hoa hồng' : 'Thêm hoa hồng sản phẩm/danh mục'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Loại áp dụng</Label>
              <Select value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Sản phẩm</SelectItem>
                  <SelectItem value="category">Danh mục</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tên {form.target_type === 'product' ? 'sản phẩm' : 'danh mục'}</Label>
              <Input
                value={form.target_name}
                onChange={(e) => setForm({ ...form, target_name: e.target.value })}
                placeholder={`Nhập tên ${form.target_type === 'product' ? 'sản phẩm' : 'danh mục'}...`}
              />
            </div>
            <div className="space-y-2">
              <Label>Kiểu hoa hồng</Label>
              <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                  <SelectItem value="fixed">Số tiền cố định (₫)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{form.commission_type === 'percentage' ? 'Phần trăm (%)' : 'Số tiền (₫)'}</Label>
              <Input
                type="number"
                min="0"
                step={form.commission_type === 'percentage' ? '0.5' : '1000'}
                value={form.commission_value}
                onChange={(e) => setForm({ ...form, commission_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Kích hoạt</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={!form.target_name || upsert.isPending}>
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
