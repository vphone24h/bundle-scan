import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, QrCode, Pencil, Copy } from 'lucide-react';
import { useAttendanceLocations, useCreateAttendanceLocation, useUpdateAttendanceLocation } from '@/hooks/useAttendance';
import { usePlatformUser } from '@/hooks/useTenant';
import { useAccessibleBranches } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface LocForm {
  name: string;
  latitude: string;
  longitude: string;
  radius_meters: number;
  branch_id: string;
  address: string;
}

const defaultForm: LocForm = { name: '', latitude: '', longitude: '', radius_meters: 200, branch_id: '', address: '' };

export function AttendanceLocationsTab() {
  const { data: locations, isLoading } = useAttendanceLocations();
  const { data: branches } = useAccessibleBranches();
  const { data: pu } = usePlatformUser();
  const createLoc = useCreateAttendanceLocation();
  const updateLoc = useUpdateAttendanceLocation();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LocForm>(defaultForm);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error('Trình duyệt không hỗ trợ GPS'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(p => ({ ...p, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        toast.success('Đã lấy vị trí GPS');
      },
      () => toast.error('Không thể lấy vị trí'),
      { enableHighAccuracy: true }
    );
  };

  const handleOpen = (loc?: any) => {
    if (loc) {
      setEditId(loc.id);
      setForm({
        name: loc.name, latitude: String(loc.latitude), longitude: String(loc.longitude),
        radius_meters: loc.radius_meters, branch_id: loc.branch_id || '', address: loc.address || '',
      });
    } else {
      setEditId(null);
      setForm(defaultForm);
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.latitude || !form.longitude) {
      toast.error('Vui lòng nhập tên và tọa độ'); return;
    }
    const payload = {
      name: form.name, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude),
      radius_meters: form.radius_meters, branch_id: form.branch_id || null, address: form.address || null,
      tenant_id: pu?.tenant_id,
    };
    if (editId) {
      await updateLoc.mutateAsync({ id: editId, ...payload });
    } else {
      await createLoc.mutateAsync(payload);
    }
    setOpen(false);
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Điểm chấm công ({locations?.length || 0})</h2>
        <Button size="sm" onClick={() => handleOpen()} className="gap-1.5">
          <Plus className="h-4 w-4" /> Thêm điểm
        </Button>
      </div>

      {!locations?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Chưa có điểm chấm công. Thêm kho/chi nhánh để nhân viên check-in.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {locations.map((loc: any) => (
            <Card key={loc.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" /> {loc.name}
                    </h3>
                    {loc.address && <p className="text-xs text-muted-foreground mt-0.5">{loc.address}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {loc.latitude}, {loc.longitude} · Bán kính: {loc.radius_meters}m
                    </p>
                    {loc.branches?.name && <Badge variant="outline" className="text-[10px] mt-1">{loc.branches.name}</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      navigator.clipboard.writeText(loc.qr_code);
                      toast.success('Đã copy mã QR');
                    }}>
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpen(loc)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Sửa điểm chấm công' : 'Thêm điểm chấm công'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tên điểm *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="VD: Kho chính" />
            </div>
            <div>
              <Label>Địa chỉ</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="VD: 123 Nguyễn Văn A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude *</Label>
                <Input value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} placeholder="10.762622" />
              </div>
              <div>
                <Label>Longitude *</Label>
                <Input value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} placeholder="106.660172" />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleGetCurrentLocation} className="gap-1.5 w-full">
              <MapPin className="h-3.5 w-3.5" /> Lấy vị trí hiện tại
            </Button>
            <div>
              <Label>Bán kính cho phép (50-500m)</Label>
              <Input type="number" min={50} max={500} value={form.radius_meters}
                onChange={e => setForm(p => ({ ...p, radius_meters: Math.max(50, Math.min(500, +e.target.value)) }))} />
            </div>
            {branches && branches.length > 0 && (
              <div>
                <Label>Chi nhánh</Label>
                <Select value={form.branch_id} onValueChange={v => setForm(p => ({ ...p, branch_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={createLoc.isPending || updateLoc.isPending}>
              {editId ? 'Lưu' : 'Tạo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
