import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SalaryData } from '../CreateEmployeeStepper';

interface Template { id: string; name: string; salary_type: string; base_amount: number; }

interface Props {
  salaryData: SalaryData;
  onChange: (d: SalaryData) => void;
  templates: Template[];
}

const SALARY_TYPE_LABELS: Record<string, string> = {
  fixed: 'Cố định', hourly: 'Theo giờ', daily: 'Theo ngày', shift: 'Theo ca',
};

export function StepSalary({ salaryData, onChange, templates }: Props) {
  const { data: currentTenant } = useCurrentTenant();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', salary_type: 'fixed', base_amount: 0 });

  const selectedTemplate = templates.find(t => t.id === salaryData.templateId);

  const handleCreateTemplate = async () => {
    if (!form.name || !currentTenant?.id) {
      toast.error('Vui lòng nhập tên bảng lương');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('salary_templates').insert({
        tenant_id: currentTenant.id,
        name: form.name,
        salary_type: form.salary_type,
        base_amount: form.base_amount,
      }).select('id').single();
      if (error) throw error;
      toast.success('Đã tạo bảng lương!');
      qc.invalidateQueries({ queryKey: ['salary-templates'] });
      setShowForm(false);
      setForm({ name: '', salary_type: 'fixed', base_amount: 0 });
      if (data?.id) onChange({ ...salaryData, templateId: data.id });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addItem = (type: 'allowances' | 'deductions') => {
    onChange({ ...salaryData, [type]: [...salaryData[type], { name: '', amount: 0 }] });
  };

  const updateItem = (type: 'allowances' | 'deductions', idx: number, patch: Partial<{ name: string; amount: number }>) => {
    const items = [...salaryData[type]];
    items[idx] = { ...items[idx], ...patch };
    onChange({ ...salaryData, [type]: items });
  };

  const removeItem = (type: 'allowances' | 'deductions', idx: number) => {
    onChange({ ...salaryData, [type]: salaryData[type].filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      {/* Template selection + create */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Mẫu lương</Label>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="h-3 w-3 mr-1" />Hủy</> : <><Plus className="h-3 w-3 mr-1" />Thêm mẫu</>}
          </Button>
        </div>

        {showForm && (
          <Card className="border-primary/50">
            <CardContent className="p-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tên bảng lương</Label>
                <Input placeholder="VD: Lương nhân viên bán hàng" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Loại lương</Label>
                  <Select value={form.salary_type} onValueChange={v => setForm({ ...form, salary_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Cố định</SelectItem>
                      <SelectItem value="hourly">Theo giờ</SelectItem>
                      <SelectItem value="daily">Theo ngày</SelectItem>
                      <SelectItem value="shift">Theo ca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mức cơ bản (đ)</Label>
                  <Input type="number" value={form.base_amount || ''} onChange={e => setForm({ ...form, base_amount: Number(e.target.value) })} />
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={handleCreateTemplate} disabled={saving}>
                {saving ? 'Đang tạo...' : 'Tạo bảng lương'}
              </Button>
            </CardContent>
          </Card>
        )}

        <Select value={salaryData.templateId || '_none'} onValueChange={v => onChange({ ...salaryData, templateId: v === '_none' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Chọn mẫu lương" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Không dùng mẫu</SelectItem>
            {templates.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} ({SALARY_TYPE_LABELS[t.salary_type] || t.salary_type} - {formatNumber(t.base_amount)}đ)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTemplate && (
        <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
          <p><strong>Mẫu:</strong> {selectedTemplate.name}</p>
          <p><strong>Loại:</strong> {SALARY_TYPE_LABELS[selectedTemplate.salary_type]}</p>
          <p><strong>Mức cơ bản:</strong> {formatNumber(selectedTemplate.base_amount)}đ</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Lương tùy chỉnh (ghi đè mẫu)</Label>
        <Input
          type="number"
          placeholder="Để trống nếu dùng mẫu"
          value={salaryData.customBaseAmount || ''}
          onChange={e => onChange({ ...salaryData, customBaseAmount: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>

      {/* Allowances */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Phụ cấp</Label>
          <Button variant="ghost" size="sm" onClick={() => addItem('allowances')} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />Thêm
          </Button>
        </div>
        {salaryData.allowances.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <Input className="flex-1" placeholder="Tên phụ cấp" value={item.name} onChange={e => updateItem('allowances', idx, { name: e.target.value })} />
            <Input className="w-28" type="number" placeholder="Số tiền" value={item.amount || ''} onChange={e => updateItem('allowances', idx, { amount: Number(e.target.value) })} />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem('allowances', idx)}><X className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>

      {/* Deductions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Giảm trừ</Label>
          <Button variant="ghost" size="sm" onClick={() => addItem('deductions')} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />Thêm
          </Button>
        </div>
        {salaryData.deductions.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <Input className="flex-1" placeholder="Tên giảm trừ" value={item.name} onChange={e => updateItem('deductions', idx, { name: e.target.value })} />
            <Input className="w-28" type="number" placeholder="Số tiền" value={item.amount || ''} onChange={e => updateItem('deductions', idx, { amount: Number(e.target.value) })} />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem('deductions', idx)}><X className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
