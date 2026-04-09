import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, CheckCircle2, XCircle, Loader2, Search, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformUser } from '@/hooks/useTenant';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function PosCheckInTab() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [checking, setChecking] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ['pos-employees', tenantId, search],
    queryFn: async () => {
      let q = supabase.from('profiles').select('id, display_name, phone, email').eq('tenant_id', tenantId!);
      if (search) q = q.or(`display_name.ilike.%${search}%,phone.ilike.%${search}%`);
      const { data } = await q.limit(20);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: locations } = useQuery({
    queryKey: ['pos-locations', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('attendance_locations').select('*').eq('tenant_id', tenantId!).eq('is_active', true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: todayRecord, refetch: refetchRecord } = useQuery({
    queryKey: ['pos-today-record', selectedUser?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', selectedUser!.id)
        .eq('date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedUser?.id,
  });

  const handlePosCheckIn = async () => {
    if (!selectedUser || !tenantId || !selectedLocation) return;
    setChecking(true);
    try {
      const loc = locations?.find(l => l.id === selectedLocation);
      const { error } = await supabase.from('attendance_records').insert([{
        tenant_id: tenantId,
        user_id: selectedUser.id,
        date: today,
        location_id: selectedLocation,
        branch_id: loc?.branch_id || null,
        check_in_time: new Date().toISOString(),
        check_in_method: 'pos',
        status: 'on_time',
        note: 'Check-in từ máy POS',
      }]);
      if (error) throw error;
      toast.success(`${selectedUser.display_name} đã check-in!`);
      refetchRecord();
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  };

  const handlePosCheckOut = async () => {
    if (!todayRecord?.id) return;
    setChecking(true);
    try {
      const now = new Date();
      const totalMin = Math.round((now.getTime() - new Date(todayRecord.check_in_time).getTime()) / 60000);
      const { error } = await supabase.from('attendance_records').update({
        check_out_time: now.toISOString(),
        check_out_method: 'pos',
        total_work_minutes: totalMin,
      }).eq('id', todayRecord.id);
      if (error) throw error;
      toast.success(`${selectedUser.display_name} đã check-out! (${Math.floor(totalMin/60)}h${totalMin%60}p)`);
      refetchRecord();
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Chấm công từ máy POS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-2xl font-bold tabular-nums mb-2">
            {format(new Date(), 'HH:mm:ss')} <span className="text-sm font-normal text-muted-foreground">{format(new Date(), 'dd/MM/yyyy', { locale: vi })}</span>
          </div>

          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger><SelectValue placeholder="Chọn điểm chấm công" /></SelectTrigger>
            <SelectContent>
              {locations?.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm nhân viên (tên, SĐT)..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedUser(null); }}
              className="pl-9"
            />
          </div>

          {employees && employees.length > 0 && !selectedUser && (
            <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
              {employees.map((emp: any) => (
                <button
                  key={emp.id}
                  className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between"
                  onClick={() => { setSelectedUser(emp); setSearch(''); }}
                >
                  <div>
                    <p className="text-sm font-medium">{emp.display_name}</p>
                    <p className="text-xs text-muted-foreground">{emp.phone || emp.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedUser && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{selectedUser.display_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.phone || selectedUser.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>Đổi</Button>
                </div>

                {todayRecord ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>Check-in: {format(new Date(todayRecord.check_in_time), 'HH:mm')}</span>
                      {todayRecord.check_out_time && (
                        <span className="text-muted-foreground">· Check-out: {format(new Date(todayRecord.check_out_time), 'HH:mm')}</span>
                      )}
                    </div>
                    {!todayRecord.check_out_time ? (
                      <Button className="w-full" variant="destructive" onClick={handlePosCheckOut} disabled={checking}>
                        {checking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                        Check-out
                      </Button>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">Đã hoàn thành</Badge>
                    )}
                  </div>
                ) : (
                  <Button className="w-full" onClick={handlePosCheckIn} disabled={checking || !selectedLocation}>
                    {checking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Check-in
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
