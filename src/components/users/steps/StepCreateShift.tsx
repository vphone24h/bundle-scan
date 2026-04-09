import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes?: number | null;
}

interface Props {
  shifts: Shift[];
  selectedShiftId: string;
  onSelect: (id: string) => void;
}

export function StepCreateShift({ shifts, selectedShiftId, onSelect }: Props) {
  const { data: currentTenant } = useCurrentTenant();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', start_time: '08:00', end_time: '17:00', break_minutes: 60 });

  const handleCreate = async () => {
    if (!form.name || !currentTenant?.id) {
      toast.error('Vui lòng nhập tên ca');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('work_shifts').insert({
        tenant_id: currentTenant.id,
        name: form.name,
        start_time: form.start_time,
        end_time: form.end_time,
        break_minutes: form.break_minutes,
      }).select('id').single();
      if (error) throw error;
      toast.success('Đã tạo ca làm!');
      qc.invalidateQueries({ queryKey: ['work-shifts'] });
      setShowForm(false);
      setForm({ name: '', start_time: '08:00', end_time: '17:00', break_minutes: 60 });
      if (data?.id) onSelect(data.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Chọn ca có sẵn hoặc tạo mới.</p>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="h-3 w-3 mr-1" />Hủy</> : <><Plus className="h-3 w-3 mr-1" />Tạo ca</>}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/50">
          <CardContent className="p-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tên ca</Label>
              <Input placeholder="VD: Ca sáng" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Giờ vào</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Giờ ra</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nghỉ giữa ca (phút)</Label>
              <Input type="number" value={form.break_minutes} onChange={e => setForm({ ...form, break_minutes: Number(e.target.value) })} />
            </div>
            <Button size="sm" className="w-full" onClick={handleCreate} disabled={saving}>
              {saving ? 'Đang tạo...' : 'Tạo ca làm'}
            </Button>
          </CardContent>
        </Card>
      )}

      {shifts.length === 0 && !showForm ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Chưa có ca. Bấm "Tạo ca" để thêm mới.
        </div>
      ) : (
        <div className="grid gap-2">
          {shifts.map(shift => {
            const isSelected = selectedShiftId === shift.id;
            return (
              <Card
                key={shift.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-sm',
                  isSelected && 'ring-2 ring-primary border-primary',
                )}
                onClick={() => onSelect(isSelected ? '' : shift.id)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{shift.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {shift.start_time} - {shift.end_time}
                        {shift.break_minutes ? ` • Nghỉ ${shift.break_minutes} phút` : ''}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />Đã chọn
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
