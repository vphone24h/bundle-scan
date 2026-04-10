import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { useCurrentTenant } from '@/hooks/useTenant';
import { SalaryTemplateEditor } from '@/components/payroll/SalaryTemplateEditor';
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
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  const selectedTemplate = templates.find(t => t.id === salaryData.templateId);

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

  if (showTemplateEditor) {
    return (
      <SalaryTemplateEditor
        templateId={null}
        tenantId={currentTenant?.id}
        onClose={() => setShowTemplateEditor(false)}
        onSaved={(templateId) => {
          onChange({ ...salaryData, templateId });
          setShowTemplateEditor(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Mẫu lương</Label>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowTemplateEditor(true)}>
            <Plus className="h-3 w-3 mr-1" />Tạo mẫu mới
          </Button>
        </div>

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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Phụ cấp riêng cho nhân viên</Label>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Giảm trừ riêng cho nhân viên</Label>
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
