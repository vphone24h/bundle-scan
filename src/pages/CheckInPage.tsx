import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Smartphone, QrCode, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformUser } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

// Haversine distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (n: number) => n * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Simple device fingerprint
function getDeviceFingerprint(): string {
  const nav = navigator;
  const screen = window.screen;
  const raw = [
    nav.userAgent, nav.language, screen.width, screen.height,
    screen.colorDepth, new Date().getTimezoneOffset(),
    nav.hardwareConcurrency, (nav as any).deviceMemory,
  ].join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export default function CheckInPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const qc = useQueryClient();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [nearestLocation, setNearestLocation] = useState<any>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const deviceFP = useRef(getDeviceFingerprint());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt không hỗ trợ GPS');
      setGpsLoading(false);
      return;
    }
    const wId = navigator.geolocation.watchPosition(
      pos => {
        setGpsPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsError('');
        setGpsLoading(false);
      },
      err => {
        setGpsError(err.code === 1 ? 'Vui lòng cho phép truy cập vị trí' : 'Không thể lấy vị trí GPS');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(wId);
  }, []);

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['attendance-locations', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_locations')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Find nearest location
  useEffect(() => {
    if (!gpsPos || !locations?.length) { setNearestLocation(null); setDistance(null); return; }
    let minDist = Infinity;
    let nearest: any = null;
    for (const loc of locations) {
      const d = haversineDistance(gpsPos.lat, gpsPos.lng, loc.latitude, loc.longitude);
      if (d < minDist) { minDist = d; nearest = loc; }
    }
    setNearestLocation(nearest);
    setDistance(Math.round(minDist));
  }, [gpsPos, locations]);

  // Today's record
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayRecord } = useQuery({
    queryKey: ['my-attendance-today', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user!.id)
        .eq('date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  // Device check
  const { data: myDevice } = useQuery({
    queryKey: ['my-device', user?.id, deviceFP.current],
    queryFn: async () => {
      const { data } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', user!.id)
        .eq('device_fingerprint', deviceFP.current)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const isInRange = nearestLocation && distance !== null && distance <= nearestLocation.radius_meters;
  const deviceOk = myDevice?.status === 'approved';
  const hasCheckedIn = !!todayRecord?.check_in_time;
  const hasCheckedOut = !!todayRecord?.check_out_time;

  const canCheckIn = !hasCheckedIn && isInRange && user;
  const canCheckOut = hasCheckedIn && !hasCheckedOut && user;

  const registerDevice = useCallback(async () => {
    if (!user?.id || !tenantId) return;
    try {
      await supabase.from('trusted_devices').upsert({
        user_id: user.id,
        tenant_id: tenantId,
        device_fingerprint: deviceFP.current,
        device_name: navigator.userAgent.includes('Mobile') ? 'Điện thoại' : 'Máy tính',
        device_type: /iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'Web',
        user_agent: navigator.userAgent.slice(0, 200),
        status: 'pending',
      }, { onConflict: 'user_id,device_fingerprint' });
      toast.info('Thiết bị đã được đăng ký, chờ admin duyệt');
      qc.invalidateQueries({ queryKey: ['my-device'] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [user?.id, tenantId, qc]);

  const handleCheckIn = useCallback(async () => {
    if (!user?.id || !tenantId || !gpsPos || !nearestLocation) return;
    setChecking(true);
    try {
      // Get assigned shift for today
      const dayOfWeek = new Date().getDay();
      const { data: assignment } = await supabase
        .from('shift_assignments')
        .select('shift_id, work_shifts(start_time, late_threshold_minutes)')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(`specific_date.eq.${today},and(assignment_type.eq.fixed,day_of_week.eq.${dayOfWeek})`)
        .limit(1)
        .maybeSingle();

      // Calculate status
      let status = 'on_time';
      let lateMinutes = 0;
      const now = new Date();
      if (assignment?.work_shifts) {
        const ws = assignment.work_shifts as any;
        const [h, m] = ws.start_time.split(':').map(Number);
        const shiftStart = new Date(); shiftStart.setHours(h, m, 0, 0);
        const threshold = (ws.late_threshold_minutes || 15) * 60 * 1000;
        const diff = now.getTime() - shiftStart.getTime();
        if (diff > threshold) { status = 'late'; lateMinutes = Math.round(diff / 60000); }
      }

      const { error } = await supabase.from('attendance_records').insert([{
        tenant_id: tenantId,
        user_id: user.id,
        date: today,
        shift_id: assignment?.shift_id || null,
        location_id: nearestLocation.id,
        branch_id: nearestLocation.branch_id,
        check_in_time: now.toISOString(),
        check_in_lat: gpsPos.lat,
        check_in_lng: gpsPos.lng,
        check_in_accuracy: gpsPos.accuracy,
        check_in_device_id: myDevice?.id || null,
        check_in_method: 'gps',
        status,
        late_minutes: lateMinutes,
      }]);
      if (error) throw error;
      toast.success(status === 'late' ? `Check-in thành công (trễ ${lateMinutes} phút)` : 'Check-in thành công!');
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  }, [user?.id, tenantId, gpsPos, nearestLocation, myDevice, today, qc]);

  const handleCheckOut = useCallback(async () => {
    if (!todayRecord?.id || !gpsPos) return;
    setChecking(true);
    try {
      const now = new Date();
      const checkInTime = new Date(todayRecord.check_in_time);
      const totalMinutes = Math.round((now.getTime() - checkInTime.getTime()) / 60000);

      const { error } = await supabase.from('attendance_records').update({
        check_out_time: now.toISOString(),
        check_out_lat: gpsPos.lat,
        check_out_lng: gpsPos.lng,
        check_out_accuracy: gpsPos.accuracy,
        check_out_device_id: myDevice?.id || null,
        check_out_method: 'gps',
        total_work_minutes: totalMinutes,
      }).eq('id', todayRecord.id);
      if (error) throw error;
      toast.success(`Check-out thành công! Tổng: ${Math.floor(totalMinutes/60)}h${totalMinutes%60}p`);
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  }, [todayRecord, gpsPos, myDevice, qc]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-6 safe-x safe-bottom">
      {/* Clock */}
      <div className="text-center mb-6">
        <p className="text-5xl sm:text-6xl font-bold tabular-nums text-foreground">
          {format(currentTime, 'HH:mm:ss')}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{format(currentTime, 'EEEE, dd/MM/yyyy')}</p>
        <p className="text-base font-medium text-foreground mt-2">{profile?.full_name || user?.email}</p>
      </div>

      {/* Status Cards */}
      <div className="w-full max-w-md space-y-3 mb-6">
        {/* GPS Status */}
        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className={`h-4 w-4 ${gpsPos ? 'text-green-600' : 'text-destructive'}`} />
              <span className="text-sm">Vị trí GPS</span>
            </div>
            {gpsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : gpsPos ? (
              <Badge variant="outline" className="text-[10px] text-green-600">OK</Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">{gpsError || 'Lỗi'}</Badge>
            )}
          </CardContent>
        </Card>

        {/* Nearest Location */}
        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div>
                <span className="text-sm">{nearestLocation?.name || 'Đang tìm kho...'}</span>
                {distance !== null && (
                  <p className={`text-xs ${isInRange ? 'text-green-600' : 'text-destructive'}`}>
                    Cách {distance}m {isInRange ? '✓ Trong phạm vi' : `✗ Ngoài phạm vi (${nearestLocation?.radius_meters}m)`}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Status */}
        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className={`h-4 w-4 ${deviceOk ? 'text-green-600' : 'text-yellow-600'}`} />
              <span className="text-sm">Thiết bị</span>
            </div>
            {!myDevice ? (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={registerDevice}>Đăng ký</Button>
            ) : myDevice.status === 'pending' ? (
              <Badge variant="secondary" className="text-[10px]">Chờ duyệt</Badge>
            ) : myDevice.status === 'approved' ? (
              <Badge variant="outline" className="text-[10px] text-green-600">Đã xác nhận</Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">Bị từ chối</Badge>
            )}
          </CardContent>
        </Card>

        {/* Today Status */}
        {todayRecord && (
          <Card className="border-primary/30">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Hôm nay</span>
                <Badge className={todayRecord.status === 'late' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                  {todayRecord.status === 'late' ? 'Đi trễ' : todayRecord.status === 'on_time' ? 'Đúng giờ' : todayRecord.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Check-in: {todayRecord.check_in_time ? format(new Date(todayRecord.check_in_time), 'HH:mm') : '--:--'}
                {todayRecord.check_out_time && ` → Check-out: ${format(new Date(todayRecord.check_out_time), 'HH:mm')}`}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-md space-y-3">
        {hasCheckedOut ? (
          <div className="text-center p-6">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-3" />
            <p className="text-lg font-semibold text-green-600">Đã hoàn thành chấm công hôm nay!</p>
            {todayRecord?.total_work_minutes && (
              <p className="text-sm text-muted-foreground mt-1">
                Tổng thời gian: {Math.floor(todayRecord.total_work_minutes/60)}h{todayRecord.total_work_minutes%60}p
              </p>
            )}
          </div>
        ) : (
          <>
            {!hasCheckedIn ? (
              <Button
                size="lg"
                className="w-full h-16 text-lg font-bold rounded-2xl gap-2"
                disabled={!canCheckIn || checking}
                onClick={handleCheckIn}
              >
                {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
                CHECK-IN
              </Button>
            ) : (
              <Button
                size="lg"
                variant="destructive"
                className="w-full h-16 text-lg font-bold rounded-2xl gap-2"
                disabled={!canCheckOut || checking}
                onClick={handleCheckOut}
              >
                {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-6 w-6" />}
                CHECK-OUT
              </Button>
            )}

            {/* Warnings */}
            {!isInRange && gpsPos && nearestLocation && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Bạn đang ở ngoài phạm vi cho phép ({distance}m / {nearestLocation.radius_meters}m)</span>
              </div>
            )}
            {!deviceOk && myDevice?.status === 'pending' && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Thiết bị đang chờ admin duyệt</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
