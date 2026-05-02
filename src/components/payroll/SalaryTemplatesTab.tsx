import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Pencil, Trash2, Eye, Copy } from 'lucide-react';
import { useSalaryTemplates, useCreateSalaryTemplate, useUpdateSalaryTemplate, useDuplicateSalaryTemplate } from '@/hooks/usePayroll';
import { usePlatformUser } from '@/hooks/useTenant';
import { formatNumber } from '@/lib/formatNumber';
import { SalaryTemplateEditor } from './SalaryTemplateEditor';

const SALARY_TYPES: Record<string, string> = {
  fixed: 'Cố định', hourly: 'Theo giờ', daily: 'Theo ngày', shift: 'Theo ca',
};

export function SalaryTemplatesTab() {
  const { data: templates, isLoading } = useSalaryTemplates();
  const updateTemplate = useUpdateSalaryTemplate();
  const duplicateTemplate = useDuplicateSalaryTemplate();
  const { data: pu } = usePlatformUser();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (creating || editingId) {
    return (
      <SalaryTemplateEditor
        templateId={editingId}
        tenantId={pu?.tenant_id}
        onClose={() => { setEditingId(null); setCreating(false); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">Mẫu lương</h3>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" />Thêm mẫu
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : templates?.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Chưa có mẫu lương. Nhấn "Thêm mẫu" để tạo.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {templates?.map(t => (
            <Card key={t.id} className="relative group">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{t.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {SALARY_TYPES[t.salary_type] || t.salary_type}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Lương: <strong className="text-foreground">{formatNumber(t.base_amount)}đ</strong></span>
                      {(t as any).bonus_enabled && <Badge variant="secondary" className="text-[10px] h-5">Thưởng</Badge>}
                      {(t as any).commission_enabled && <Badge variant="secondary" className="text-[10px] h-5">Hoa hồng</Badge>}
                      {(t as any).allowance_enabled && <Badge variant="secondary" className="text-[10px] h-5">Phụ cấp</Badge>}
                      {(t as any).holiday_enabled && <Badge variant="secondary" className="text-[10px] h-5">Ngày lễ</Badge>}
                      {(t as any).overtime_enabled && <Badge variant="secondary" className="text-[10px] h-5">Tăng ca</Badge>}
                      {(t as any).penalty_enabled && <Badge variant="secondary" className="text-[10px] h-5">Phạt</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(t.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Nhân bản mẫu lương"
                      disabled={duplicateTemplate.isPending}
                      onClick={() => duplicateTemplate.mutate(t.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => updateTemplate.mutate({ id: t.id, is_active: false })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
