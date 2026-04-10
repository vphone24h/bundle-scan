import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Check, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant, usePlatformUser } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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

const emptyForm = { name: '', start_time: '08:00', end_time: '17:00', break_minutes: 60 };

export function StepCreateShift({ shifts, selectedShiftId, onSelect }: Props) {
  const { data: currentTenant } = useCurrentTenant();
  const { data: platformUser } = usePlatformUser();
  const tenantId = currentTenant?.id || platformUser?.tenant_id;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (shift: Shift, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditId(shift.id);
    setForm({
      name: shift.name,
      start_time: shift.start_time?.slice(0, 5) || '08:00',
      end_time: shift.end_time?.slice(0, 5) || '17:00',
      break_minutes: shift.break_minutes ?? 60,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('work_shifts').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      toast.success('Đã xóa ca làm!');
      qc.invalidateQueries({ queryKey: ['work-shifts'] });
      if (selectedShiftId === id) onSelect('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSave = async () => {
    if (!form.name || !tenantId) {
      toast.error('Vui lòng nhập tên ca');
      return;
    }

    const normalizedBreakMinutes = Number.isFinite(form.break_minutes) ? Math.max(0, Number(form.break_minutes)) : 0;
    const payload = {
      name: form.name.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      break_minutes: normalizedBreakMinutes,
    };

    if (!payload.name) {
      toast.error('Vui lòng nhập tên ca');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from('work_shifts').update(payload).eq('id', editId);
        if (error) throw error;
        toast.success('Đã cập nhật ca làm!');
      } else {
        const { data, error } = await supabase.from('work_shifts').insert({
          tenant_id: tenantId,
          ...payload,
        }).select('id').single();
        if (error) throw error;
        toast.success('Đã tạo ca làm!');
        if (data?.id) onSelect(data.id);
      }
      qc.invalidateQueries({ queryKey: ['work-shifts'] });
      qc.invalidateQueries({ queryKey: ['work-shifts', tenantId] });
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
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
        <Button variant="outline" size="sm" onClick={() => showForm ? (setShowForm(false), setEditId(null)) : openCreate()}>
          {showForm ? <><X className="h-3 w-3 mr-1" />Hủy</> : <><Plus className="h-3 w-3 mr-1" />Tạo ca</>}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/50">
          <CardContent className="p-3 space-y-3">
            <p className="text-sm font-medium">{editId ? 'Sửa ca làm' : 'Tạo ca mới'}</p>
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
            <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu...' : editId ? 'Cập nhật' : 'Tạo ca làm'}
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
                        {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                        {shift.break_minutes ? ` • Nghỉ ${shift.break_minutes} phút` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isSelected && (
                      <Badge variant="default" className="gap-1 mr-1">
                        <Check className="h-3 w-3" />Chọn
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(shift, e)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => e.stopPropagation()}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={e => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Xóa ca "{shift.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>Ca sẽ bị vô hiệu hóa cho toàn bộ nhân viên.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(shift.id)}>Xóa</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
