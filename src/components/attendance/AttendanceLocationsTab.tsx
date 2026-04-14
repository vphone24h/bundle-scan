import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, QrCode, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
import { useAttendanceLocations, useCreateAttendanceLocation, useUpdateAttendanceLocation, useDeleteAttendanceLocation } from '@/hooks/useAttendance';
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
  const deleteLoc = useDeleteAttendanceLocation();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LocForm>(defaultForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  

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

  const handleGeocodeAddress = async () => {
    if (!form.address.trim()) { toast.error('Vui lòng nhập địa chỉ trước'); return; }
    setGeocoding(true);
    setSuggestions([]);
    setShowSuggestions(false);
    try {
      const raw = form.address.trim();
      // Try full query first, then progressively simpler versions
      const queries = [raw];
      // Remove "số", "đường số" prefixes and simplify
      const simplified = raw
        .replace(/số\s*/gi, '')
        .replace(/đường\s*/gi, '')
        .replace(/khu phố\s*/gi, 'KP ')
        .replace(/phường\s*/gi, 'P.')
        .replace(/quận\s*/gi, 'Q.')
        .trim();
      if (simplified !== raw) queries.push(simplified);
      // Try just district/ward parts
      const parts = raw.split(',').map(p => p.trim());
      if (parts.length > 2) {
        queries.push(parts.slice(-3).join(', '));
        queries.push(parts.slice(-2).join(', '));
      }

      let allResults: any[] = [];
      for (const q of queries) {
        if (allResults.length >= 8) break;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=vn&addressdetails=1`);
        const data = await res.json();
        if (data?.length) {
          // Deduplicate by lat/lon
          for (const item of data) {
            const exists = allResults.some(r => r.lat === item.lat && r.lon === item.lon);
            if (!exists && allResults.length < 10) allResults.push(item);
          }
        }
      }

      if (allResults.length > 0) {
        setSuggestions(allResults);
        setShowSuggestions(true);
      } else {
        toast.error('Không tìm thấy. Thử rút gọn: "phường X, quận Y, TP HCM"');
      }
    } catch {
      toast.error('Lỗi kết nối dịch vụ bản đồ');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSelectSuggestion = (item: any) => {
    setForm(p => ({
      ...p,
      latitude: parseFloat(item.lat).toFixed(6),
      longitude: parseFloat(item.lon).toFixed(6),
      address: item.display_name,
    }));
    setShowSuggestions(false);
    setSuggestions([]);
    toast.success('Đã chọn vị trí');
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

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteLoc.mutateAsync(deleteId);
    setDeleteId(null);
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(loc.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
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
              <Label>Địa chỉ hoặc link Google Maps</Label>
              <div className="flex gap-2">
                <Input value={form.address} onChange={e => {
                  const val = e.target.value;
                  setForm(p => ({ ...p, address: val }));
                  setShowSuggestions(false);
                  handlePastedLink(val);
                }} placeholder="Địa chỉ hoặc dán link Google Maps" className="flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleGeocodeAddress(); } }}
                />
                <Button variant="outline" size="icon" onClick={handleGeocodeAddress} disabled={geocoding} title="Tìm tọa độ từ địa chỉ">
                  {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Dán link Google Maps để lấy tọa độ chính xác, hoặc nhập địa chỉ rồi bấm 🔍</p>
              {showSuggestions && suggestions.length > 0 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto divide-y bg-background shadow-md mt-1">
                  {suggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full px-3 py-2.5 text-left hover:bg-muted/50 flex items-start gap-2"
                      onClick={() => handleSelectSuggestion(item)}
                    >
                      <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-xs leading-relaxed">{item.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
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
              <MapPin className="h-3.5 w-3.5" /> Lấy vị trí hiện tại (GPS)
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

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa điểm chấm công?</AlertDialogTitle>
            <AlertDialogDescription>Điểm này sẽ bị vô hiệu hóa. Các bản ghi chấm công cũ vẫn được giữ nguyên.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
