import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useSalaryTemplates, useCreateSalaryTemplate, useUpdateSalaryTemplate } from '@/hooks/usePayroll';
import { usePlatformUser } from '@/hooks/useTenant';
import { formatNumber } from '@/lib/formatNumber';

const SALARY_TYPES = [
  { value: 'fixed', label: 'Cố định' },
  { value: 'hourly', label: 'Theo giờ' },
  { value: 'daily', label: 'Theo ngày' },
  { value: 'shift', label: 'Theo ca' },
];

interface TemplateForm {
  name: string;
  salary_type: string;
  base_amount: string;
  bonus_amount: string;
  allowance_amount: string;
  commission_percent: string;
  kpi_bonus_amount: string;
  description: string;
}

const emptyForm: TemplateForm = {
  name: '', salary_type: 'fixed', base_amount: '', bonus_amount: '', allowance_amount: '', commission_percent: '', kpi_bonus_amount: '', description: '',
};

export function SalaryTemplatesTab() {
  const { data: templates, isLoading } = useSalaryTemplates();
  const createTemplate = useCreateSalaryTemplate();
  const updateTemplate = useUpdateSalaryTemplate();
  const { data: pu } = usePlatformUser();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);

  const setField = (key: keyof TemplateForm, value: string) => setForm(f => ({ ...f, [key]: value }));

  const openCreate = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({
      name: t.name,
      salary_type: t.salary_type,
      base_amount: String(t.base_amount || 0),
      bonus_amount: String(t.bonus_amount || 0),
      allowance_amount: String(t.allowance_amount || 0),
      commission_percent: String(t.commission_percent || 0),
      kpi_bonus_amount: String(t.kpi_bonus_amount || 0),
      description: t.description || '',
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !pu?.tenant_id) return;
    const payload = {
      name: form.name,
      salary_type: form.salary_type,
      base_amount: Number(form.base_amount) || 0,
      bonus_amount: Number(form.bonus_amount) || 0,
      allowance_amount: Number(form.allowance_amount) || 0,
      commission_percent: Number(form.commission_percent) || 0,
      kpi_bonus_amount: Number(form.kpi_bonus_amount) || 0,
      description: form.description || undefined,
    };
    if (editId) {
      updateTemplate.mutate({ id: editId, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      createTemplate.mutate({ tenant_id: pu.tenant_id, ...payload }, { onSuccess: () => setOpen(false) });
    }
  };

  const handleDelete = (id: string) => {
    updateTemplate.mutate({ id, is_active: false });
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  const totalOf = (t: any) => (Number(t.base_amount) || 0) + (Number(t.bonus_amount) || 0) + (Number(t.allowance_amount) || 0) + (Number(t.kpi_bonus_amount) || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">Mẫu lương</h3>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Thêm mẫu</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : templates?.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Chưa có mẫu lương. Nhấn "Thêm mẫu" để tạo.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates?.map(t => (
            <Card key={t.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
                    <Badge variant="outline" className="text-xs mt-1">
                      {SALARY_TYPES.find(s => s.value === t.salary_type)?.label || t.salary_type}
                    </Badge>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lương chính:</span>
                    <span className="font-medium">{formatNumber(t.base_amount)}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thưởng:</span>
                    <span className="font-medium">{formatNumber(t.bonus_amount || 0)}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phụ cấp:</span>
                    <span className="font-medium">{formatNumber(t.allowance_amount || 0)}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hoa hồng:</span>
                    <span className="font-medium">{t.commission_percent || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">KPI:</span>
                    <span className="font-medium">{formatNumber(t.kpi_bonus_amount || 0)}đ</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 mt-1 col-span-2">
                    <span className="font-semibold text-muted-foreground">Tổng cố định:</span>
                    <span className="font-bold text-primary">{formatNumber(totalOf(t))}đ</span>
                  </div>
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-2">{t.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Sửa mẫu lương' : 'Tạo mẫu lương'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tên mẫu <span className="text-destructive">*</span></Label>
              <Input placeholder="VD: Lương nhân viên bán hàng" value={form.name} onChange={e => setField('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Loại lương</Label>
              <Select value={form.salary_type} onValueChange={v => setField('salary_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SALARY_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thành phần lương</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Lương chính (VNĐ)</Label>
                  <Input type="number" placeholder="0" value={form.base_amount} onChange={e => setField('base_amount', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Thưởng (VNĐ)</Label>
                  <Input type="number" placeholder="0" value={form.bonus_amount} onChange={e => setField('bonus_amount', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phụ cấp (VNĐ)</Label>
                  <Input type="number" placeholder="0" value={form.allowance_amount} onChange={e => setField('allowance_amount', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hoa hồng (%)</Label>
                  <Input type="number" placeholder="0" value={form.commission_percent} onChange={e => setField('commission_percent', e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Thưởng KPI (VNĐ)</Label>
                  <Input type="number" placeholder="0" value={form.kpi_bonus_amount} onChange={e => setField('kpi_bonus_amount', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Mô tả</Label>
              <Input placeholder="Ghi chú thêm" value={form.description} onChange={e => setField('description', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={isPending || !form.name}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editId ? 'Lưu' : 'Tạo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
