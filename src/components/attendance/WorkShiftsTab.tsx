import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Clock, MapPin } from 'lucide-react';
import { useWorkShifts, useCreateWorkShift, useUpdateWorkShift, useDeleteWorkShift } from '@/hooks/useAttendance';
import { useCurrentTenant, usePlatformUser } from '@/hooks/useTenant';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ShiftForm {
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  late_threshold_minutes: number;
  early_leave_threshold_minutes: number;
  allow_early_checkin_minutes: number;
  overtime_enabled: boolean;
  max_overtime_minutes: number;
  gps_required: boolean;
  gps_radius_meters: number;
  device_required: boolean;
  color: string;
}

const defaultForm: ShiftForm = {
  name: '',
  start_time: '08:00',
  end_time: '17:00',
  break_minutes: 60,
  late_threshold_minutes: 15,
  early_leave_threshold_minutes: 15,
  allow_early_checkin_minutes: 30,
  overtime_enabled: false,
  max_overtime_minutes: 120,
  gps_required: true,
  gps_radius_meters: 200,
  device_required: true,
  color: '#3B82F6',
};

export function WorkShiftsTab() {
  const { data: shifts, isLoading } = useWorkShifts();
  const { data: currentTenant } = useCurrentTenant();
  const { data: pu } = usePlatformUser();
  const createShift = useCreateWorkShift();
  const updateShift = useUpdateWorkShift();
  const deleteShift = useDeleteWorkShift();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ShiftForm>(defaultForm);
  const tenantId = currentTenant?.id || pu?.tenant_id;

  const handleOpen = (shift?: any) => {
    if (shift) {
      setEditId(shift.id);
      setForm({
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        break_minutes: shift.break_minutes,
        late_threshold_minutes: shift.late_threshold_minutes,
        early_leave_threshold_minutes: shift.early_leave_threshold_minutes,
        allow_early_checkin_minutes: shift.allow_early_checkin_minutes,
        overtime_enabled: shift.overtime_enabled,
        max_overtime_minutes: shift.max_overtime_minutes || 120,
        gps_required: shift.gps_required,
        gps_radius_meters: shift.gps_radius_meters,
        device_required: shift.device_required,
        color: shift.color || '#3B82F6',
      });
    } else {
      setEditId(null);
      setForm(defaultForm);
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (!tenantId) {
      toast.error('Không xác định được cửa hàng để lưu ca làm');
      return;
    }

    const payload = { ...form, tenant_id: tenantId };
    if (editId) {
      await updateShift.mutateAsync({ id: editId, ...form });
    } else {
      await createShift.mutateAsync(payload);
    }
    setOpen(false);
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Ca làm việc ({shifts?.length || 0})</h2>
        <Button size="sm" onClick={() => handleOpen()} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Thêm ca
        </Button>
      </div>

      {!shifts?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Chưa có ca làm việc nào</p>
            <Button variant="outline" className="mt-3" onClick={() => handleOpen()}>Tạo ca đầu tiên</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shifts.map(shift => (
            <Card key={shift.id} className="relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: shift.color || '#3B82F6' }} />
              <CardContent className="p-4 pl-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{shift.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3.5 w-3.5" />
                      {shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)}
                      {shift.break_minutes > 0 && <span className="ml-1">(nghỉ {shift.break_minutes}p)</span>}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpen(shift)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Xóa ca "{shift.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>Ca sẽ bị vô hiệu hóa, không ảnh hưởng dữ liệu chấm công cũ.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteShift.mutate(shift.id)}>Xóa</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[10px]">Trễ: {shift.late_threshold_minutes}p</Badge>
                  <Badge variant="outline" className="text-[10px]">Sớm: {shift.early_leave_threshold_minutes}p</Badge>
                  {shift.gps_required && (
                    <Badge variant="secondary" className="text-[10px] gap-0.5">
                      <MapPin className="h-2.5 w-2.5" /> {shift.gps_radius_meters}m
                    </Badge>
                  )}
                  {shift.overtime_enabled && <Badge className="text-[10px]">Tăng ca</Badge>}
                  {shift.device_required && <Badge variant="outline" className="text-[10px]">Xác nhận TB</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Sửa ca làm việc' : 'Tạo ca làm việc'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Tên ca *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="VD: Ca sáng" />
              </div>
              <div>
                <Label>Bắt đầu</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div>
                <Label>Kết thúc</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
              <div>
                <Label>Nghỉ giữa ca (phút)</Label>
                <Input type="number" value={form.break_minutes} onChange={e => setForm(p => ({ ...p, break_minutes: +e.target.value }))} />
              </div>
              <div>
                <Label>Màu sắc</Label>
                <Input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="h-10" />
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <h4 className="text-sm font-medium">Quy tắc chấm công</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Trễ sau (phút)</Label>
                  <Input type="number" value={form.late_threshold_minutes} onChange={e => setForm(p => ({ ...p, late_threshold_minutes: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Về sớm trước (phút)</Label>
                  <Input type="number" value={form.early_leave_threshold_minutes} onChange={e => setForm(p => ({ ...p, early_leave_threshold_minutes: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Check-in sớm (phút)</Label>
                  <Input type="number" value={form.allow_early_checkin_minutes} onChange={e => setForm(p => ({ ...p, allow_early_checkin_minutes: +e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Cho phép tăng ca</Label>
                <Switch checked={form.overtime_enabled} onCheckedChange={v => setForm(p => ({ ...p, overtime_enabled: v }))} />
              </div>
              {form.overtime_enabled && (
                <div>
                  <Label className="text-xs">Tăng ca tối đa (phút)</Label>
                  <Input type="number" value={form.max_overtime_minutes} onChange={e => setForm(p => ({ ...p, max_overtime_minutes: +e.target.value }))} />
                </div>
              )}
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <h4 className="text-sm font-medium">Yêu cầu bảo mật</h4>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Yêu cầu GPS</Label>
                <Switch checked={form.gps_required} onCheckedChange={v => setForm(p => ({ ...p, gps_required: v }))} />
              </div>
              {form.gps_required && (
                <div>
                  <Label className="text-xs">Bán kính cho phép (50-500m)</Label>
                  <Input
                    type="number"
                    min={50} max={500}
                    value={form.gps_radius_meters}
                    onChange={e => setForm(p => ({ ...p, gps_radius_meters: Math.max(50, Math.min(500, +e.target.value)) }))}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-sm">Xác nhận thiết bị</Label>
                <Switch checked={form.device_required} onCheckedChange={v => setForm(p => ({ ...p, device_required: v }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={createShift.isPending || updateShift.isPending}>
              {editId ? 'Lưu' : 'Tạo ca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
