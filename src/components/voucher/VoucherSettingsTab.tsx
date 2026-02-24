import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Edit2, Trash2, Ticket, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
import {
  useVoucherTemplates,
  useCreateVoucherTemplate,
  useUpdateVoucherTemplate,
  useDeleteVoucherTemplate,
  VoucherTemplate,
} from '@/hooks/useVouchers';
import { usePointSettings, useUpdatePointSettings } from '@/hooks/useCustomerPoints';

export function VoucherSettingsTab() {
  const { data: templates, isLoading } = useVoucherTemplates();
  const { data: pointSettings } = usePointSettings();
  const updatePointSettings = useUpdatePointSettings();
  const createTemplate = useCreateVoucherTemplate();
  const updateTemplate = useUpdateVoucherTemplate();
  const deleteTemplate = useDeleteVoucherTemplate();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VoucherTemplate | null>(null);
  const [form, setForm] = useState({ name: '', discount_type: 'amount' as 'amount' | 'percentage', discount_value: '', description: '', conditions: '', min_order_value: '' });

  const voucherEnabled = (pointSettings as any)?.voucher_system_enabled ?? false;

  const handleToggleSystem = async (enabled: boolean) => {
    try {
      await updatePointSettings.mutateAsync({ voucher_system_enabled: enabled } as any);
      toast.success(enabled ? 'Đã bật hệ thống voucher' : 'Đã tắt hệ thống voucher');
    } catch { toast.error('Lỗi cập nhật'); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', discount_type: 'amount', discount_value: '', description: '', conditions: '', min_order_value: '' });
    setShowForm(true);
  };

  const openEdit = (t: VoucherTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      discount_type: t.discount_type,
      discount_value: formatNumber(t.discount_value),
      description: t.description || '',
      conditions: t.conditions || '',
      min_order_value: (t as any).min_order_value ? formatNumber((t as any).min_order_value) : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nhập tên voucher'); return; }
    const value = parseFormattedNumber(form.discount_value);
    if (value <= 0) { toast.error('Giá trị giảm phải > 0'); return; }

    try {
      const minOrder = parseFormattedNumber(form.min_order_value);
      if (editing) {
        await updateTemplate.mutateAsync({
          id: editing.id,
          name: form.name.trim(),
          discount_type: form.discount_type,
          discount_value: value,
          description: form.description.trim() || null,
          conditions: form.conditions.trim() || null,
          min_order_value: minOrder || 0,
        } as any);
        toast.success('Cập nhật voucher mẫu thành công');
      } else {
        await createTemplate.mutateAsync({
          name: form.name.trim(),
          discount_type: form.discount_type,
          discount_value: value,
          description: form.description.trim() || null,
          conditions: form.conditions.trim() || null,
          is_active: true,
          min_order_value: minOrder || 0,
        } as any);
        toast.success('Tạo voucher mẫu thành công');
      }
      setShowForm(false);
    } catch { toast.error('Lỗi lưu voucher'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa voucher mẫu này?')) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success('Đã xóa');
    } catch { toast.error('Không thể xóa'); }
  };

  const handleToggleActive = async (t: VoucherTemplate) => {
    try {
      await updateTemplate.mutateAsync({ id: t.id, is_active: !t.is_active });
      toast.success(t.is_active ? 'Đã tắt' : 'Đã bật');
    } catch { toast.error('Lỗi'); }
  };

  return (
    <div className="space-y-6">
      {/* Toggle voucher system */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Bật hệ thống voucher</Label>
              <p className="text-sm text-muted-foreground">Cho phép tạo và phát voucher cho khách hàng</p>
            </div>
            <Switch checked={voucherEnabled} onCheckedChange={handleToggleSystem} />
          </div>
        </CardContent>
      </Card>

      {voucherEnabled && (
        <>
          {/* Templates list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Voucher mẫu
              </CardTitle>
              <Button size="sm" onClick={openCreate} className="gap-1">
                <Plus className="h-4 w-4" /> Tạo mới
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : !templates?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">Chưa có voucher mẫu nào</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên</TableHead>
                        <TableHead>Giảm giá</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map(t => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{t.name}</span>
                              {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <Badge variant="secondary">
                                {t.discount_type === 'percentage' ? `${t.discount_value}%` : `${formatNumber(t.discount_value)}đ`}
                              </Badge>
                              {(t as any).min_order_value > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">Đơn tối thiểu: {formatNumber((t as any).min_order_value)}đ</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Switch checked={t.is_active} onCheckedChange={() => handleToggleActive(t)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa voucher mẫu' : 'Tạo voucher mẫu'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tên voucher <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Giảm 50K cho khách mới" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Loại giảm</Label>
                <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">Số tiền (VNĐ)</SelectItem>
                    <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Giá trị giảm <span className="text-destructive">*</span></Label>
                <Input
                  value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: form.discount_type === 'amount' ? formatInputNumber(e.target.value) : e.target.value }))}
                  placeholder={form.discount_type === 'percentage' ? 'VD: 10' : 'VD: 50,000'}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <Label>Mô tả</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn gọn..." rows={2} />
            </div>
            <div>
              <Label>Điều kiện áp dụng</Label>
              <Textarea value={form.conditions} onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))} placeholder="VD: Áp dụng cho đơn từ 500K" rows={2} />
            </div>
            <div>
              <Label>Giá trị đơn hàng tối thiểu</Label>
              <Input
                value={form.min_order_value}
                onChange={e => setForm(f => ({ ...f, min_order_value: formatInputNumber(e.target.value) }))}
                placeholder="VD: 4,000,000 (để trống = không giới hạn)"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground mt-1">Voucher chỉ áp dụng cho đơn hàng có giá trị ≥ số tiền này</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
              <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
                {(createTemplate.isPending || updateTemplate.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editing ? 'Cập nhật' : 'Tạo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
