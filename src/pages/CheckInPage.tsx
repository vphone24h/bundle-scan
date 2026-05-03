import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Smartphone, QrCode, CheckCircle2, XCircle, Loader2, AlertTriangle, Navigation, Signal, Wifi, WifiOff, ArrowLeft, ShieldAlert, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DeviceOtpVerification } from '@/components/attendance/DeviceOtpVerification';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformUser } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';

// Haversine distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (n: number) => n * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Detect mock GPS / developer mode
function detectGpsFraud(pos: GeolocationPosition): { isSuspicious: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (pos.coords.accuracy === 20 && pos.coords.altitude === null) reasons.push('Mock location suspected');
  if (pos.coords.altitudeAccuracy === null && pos.coords.speed === null && pos.coords.heading === null) {
    if (pos.coords.accuracy <= 5) reasons.push('Emulator GPS pattern');
  }
  if ((navigator as any).webdriver) reasons.push('WebDriver detected');
  if ((window as any).__SELENIUM_IDE_RECORDER) reasons.push('Selenium detected');
  if ((window as any).callPhantom || (window as any)._phantom) reasons.push('PhantomJS detected');
  return { isSuspicious: reasons.length > 0, reasons };
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
  const navigate = useNavigate();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [nearestLocation, setNearestLocation] = useState<any>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [gpsFraudWarning, setGpsFraudWarning] = useState<string[]>([]);
  const [showRandomVerify, setShowRandomVerify] = useState(false);
  const [showOtpVerify, setShowOtpVerify] = useState(false);
  const [verifyAnswer, setVerifyAnswer] = useState('');
  const [allDistances, setAllDistances] = useState<{ loc: any; dist: number }[]>([]);
  const deviceFP = useRef(getDeviceFingerprint());

  // Remote check-in request state
  const [showRemoteRequest, setShowRemoteRequest] = useState(false);
  const [remoteReason, setRemoteReason] = useState('');
  const [sendingRemote, setSendingRemote] = useState(false);

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
        const fraud = detectGpsFraud(pos);
        setGpsFraudWarning(fraud.reasons);
      },
      err => {
        setGpsError(err.code === 1 ? 'Vui lòng cho phép truy cập vị trí' : err.code === 2 ? 'Không tìm thấy vị trí' : 'GPS timeout');
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

  // Find nearest location + all distances
  useEffect(() => {
    if (!gpsPos || !locations?.length) { setNearestLocation(null); setDistance(null); setAllDistances([]); return; }
    const dists = locations.map(loc => ({
      loc,
      dist: Math.round(haversineDistance(gpsPos.lat, gpsPos.lng, loc.latitude, loc.longitude)),
    })).sort((a, b) => a.dist - b.dist);
    
    setAllDistances(dists);
    setNearestLocation(dists[0].loc);
    setDistance(dists[0].dist);
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

  // Check pending remote request for today
  const { data: pendingRemoteRequest } = useQuery({
    queryKey: ['my-remote-request', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_correction_requests')
        .select('*')
        .eq('user_id', user!.id)
        .eq('request_date', today)
        .in('request_type', ['remote_checkin', 'remote_checkout'])
        .eq('status', 'pending')
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  // Today's shift
  const dayOfWeek = new Date().getDay();
  const { data: todayShift } = useQuery({
    queryKey: ['my-shift-checkin', user?.id, tenantId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('shift_assignments')
        .select('*, work_shifts(name, start_time, end_time, break_minutes, late_threshold_minutes)')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .or(`specific_date.eq.${today},and(assignment_type.eq.fixed,day_of_week.eq.${dayOfWeek})`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!tenantId,
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

  // Lấy waiver đã duyệt (xin trễ / xin về sớm) áp dụng cho hôm nay
  const { data: todayWaivers } = useQuery({
    queryKey: ['my-waivers-today', user?.id, tenantId, today],
    queryFn: async () => {
      if (!user?.id || !tenantId) return { late: 0, early: 0 };
      const { data } = await supabase
        .from('leave_requests')
        .select('request_type, time_minutes')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .in('request_type', ['late_arrival', 'early_leave'])
        .lte('leave_date_from', today)
        .gte('leave_date_to', today);
      let late = 0, early = 0;
      for (const r of data || []) {
        const mins = (r as any).time_minutes || 0;
        if (r.request_type === 'late_arrival') late = Math.max(late, mins);
        else if (r.request_type === 'early_leave') early = Math.max(early, mins);
      }
      return { late, early };
    },
    enabled: !!user?.id && !!tenantId,
  });

  // Ngưỡng bù trừ vào sớm/về trễ (mặc định = 0 nếu admin chưa cấu hình → KHÔNG bù trừ)
  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant-comp-threshold', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select('compensation_threshold_minutes')
        .eq('id', tenantId!)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });
  const rawThreshold = (tenantSettings as any)?.compensation_threshold_minutes;
  const compThreshold = rawThreshold == null ? 0 : Number(rawThreshold) || 0;

  const isInRange = nearestLocation && distance !== null && distance <= nearestLocation.radius_meters;
  const deviceOk = myDevice?.status === 'approved';
  const hasCheckedIn = !!todayRecord?.check_in_time;
  const hasCheckedOut = !!todayRecord?.check_out_time;
  
  // ENFORCED CONDITIONS:
  // 1. Must be logged in (user)
  // 2. Must have approved device (deviceOk)
  // 3. Must be in range (isInRange) — OR can request remote approval
  const canCheckIn = !hasCheckedIn && isInRange && user && deviceOk;
  const canCheckOut = hasCheckedIn && !hasCheckedOut && user && deviceOk;
  const canRequestRemote = user && deviceOk && !isInRange && gpsPos && nearestLocation && !hasCheckedIn && !pendingRemoteRequest;
  const canRequestRemoteCheckout = user && deviceOk && !isInRange && gpsPos && hasCheckedIn && !hasCheckedOut && !pendingRemoteRequest;

  // Working time elapsed
  const [workingMinutes, setWorkingMinutes] = useState(0);
  useEffect(() => {
    if (!hasCheckedIn || hasCheckedOut || !todayRecord?.check_in_time) return;
    const update = () => {
      const mins = Math.round((Date.now() - new Date(todayRecord.check_in_time!).getTime()) / 60000);
      setWorkingMinutes(mins);
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [hasCheckedIn, hasCheckedOut, todayRecord?.check_in_time]);

  const shiftInfo = todayShift?.work_shifts as any;
  const distancePercent = nearestLocation && distance !== null
    ? Math.max(0, Math.min(100, 100 - (distance / nearestLocation.radius_meters * 100)))
    : 0;

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
    if (!user?.id || !tenantId || !gpsPos || !nearestLocation || !deviceOk) return;
    setChecking(true);
    try {
      let status = 'on_time';
      let lateMinutes = 0;
      let earlyArrivalMinutes = 0;
      const now = new Date();
      if (shiftInfo) {
        const [h, m] = shiftInfo.start_time.split(':').map(Number);
        const shiftStart = new Date(); shiftStart.setHours(h, m, 0, 0);
        // Nếu có đơn xin đi trễ đã duyệt N phút → mốc giờ vào ca dời thêm N phút
        const waiverLateMin = todayWaivers?.late || 0;
        const effectiveStart = new Date(shiftStart.getTime() + waiverLateMin * 60000);
        const threshold = (shiftInfo.late_threshold_minutes || 15) * 60 * 1000;
        const diff = now.getTime() - effectiveStart.getTime();
        if (diff > threshold) {
          status = 'late';
          lateMinutes = Math.round(diff / 60000);
        } else if (diff < 0) {
          // Lưu NGUYÊN số phút vào sớm thực tế. Không tạo OT pending tại check-in
          // vì chưa biết NV có về sớm để bù trừ không. Toàn bộ tính bù trừ + OT pending
          // + early_leave sẽ chạy ở handleCheckOut sau khi có cả 2 mốc giờ.
          earlyArrivalMinutes = Math.round(-diff / 60000);
        }
      }

      const { error } = await supabase.from('attendance_records').insert([{
        tenant_id: tenantId,
        user_id: user.id,
        date: today,
        shift_id: todayShift?.shift_id || null,
        location_id: nearestLocation.id,
        branch_id: nearestLocation.branch_id,
        check_in_time: now.toISOString(),
        check_in_lat: gpsPos.lat,
        check_in_lng: gpsPos.lng,
        check_in_accuracy: gpsPos.accuracy,
        check_in_device_id: myDevice?.id || null,
        check_in_method: 'gps',
        check_in_ip: null,
        status,
        late_minutes: lateMinutes,
        early_arrival_minutes: earlyArrivalMinutes,
        pending_overtime_minutes: 0,
        overtime_status: 'none',
        note: gpsFraudWarning.length > 0 ? `⚠️ GPS flags: ${gpsFraudWarning.join(', ')}` : null,
      }]);
      if (error) throw error;

      // Auto-tạo phiếu xin đi trễ nếu vượt ngưỡng và chưa có phiếu nào cho ngày này.
      // Admin có 3 lựa chọn: duyệt miễn phạt / duyệt trừ theo OT / từ chối → áp phạt cấu hình.
      if (status === 'late' && lateMinutes > 0) {
        const { data: existing } = await supabase
          .from('leave_requests')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id)
          .eq('request_type', 'late_arrival')
          .eq('leave_date_from', today)
          .in('status', ['pending', 'approved'])
          .limit(1)
          .maybeSingle();
        if (!existing) {
          await supabase.from('leave_requests').insert({
            tenant_id: tenantId,
            user_id: user.id,
            request_type: 'late_arrival',
            leave_date_from: today,
            leave_date_to: today,
            time_minutes: lateMinutes,
            reason: `[Tự động] Đi trễ ${lateMinutes}p — chờ admin duyệt`,
            status: 'pending',
          });
          qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
          qc.invalidateQueries({ queryKey: ['leave-requests-admin'] });
          qc.invalidateQueries({ queryKey: ['pending-approvals-count'] });
        }
      }

      const waiverLateMin = todayWaivers?.late || 0;
      let msg = 'Check-in thành công!';
      if (status === 'late') {
        msg = `Check-in thành công (trễ ${lateMinutes} phút${waiverLateMin > 0 ? ` — đã trừ ${waiverLateMin}p xin phép` : ''})`;
      } else if (earlyArrivalMinutes > 0) {
        msg = `Check-in sớm ${earlyArrivalMinutes}p — sẽ bù trừ với giờ về cuối ca.`;
      } else if (waiverLateMin > 0) {
        msg = `Check-in thành công (trong khung xin trễ ${waiverLateMin}p)`;
      }
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
      // Random post-checkin verification (20% chance)
      if (Math.random() < 0.2) {
        setTimeout(() => setShowRandomVerify(true), 3000);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  }, [user?.id, tenantId, gpsPos, nearestLocation, myDevice, todayShift, shiftInfo, today, qc, deviceOk, gpsFraudWarning, todayWaivers, compThreshold]);

  const handleCheckOut = useCallback(async () => {
    if (!todayRecord?.id || !gpsPos || !deviceOk) return;
    setChecking(true);
    try {
      const now = new Date();
      const checkInTime = new Date(todayRecord.check_in_time);
      const totalMinutes = Math.round((now.getTime() - checkInTime.getTime()) / 60000);

      // Tính bù trừ NET trong ngày dựa trên cả vào sớm + về trễ/sớm
      let overtimeMinutes = 0;
      let earlyLeaveMinutes = 0;
      let extraPendingOT = 0; // OT pending chờ duyệt (vượt ngưỡng net về phía DƯƠNG)
      const earlyArrivalRecorded = (todayRecord as any)?.early_arrival_minutes || 0;
      if (shiftInfo) {
        const [eh, em] = shiftInfo.end_time.split(':').map(Number);
        const shiftEnd = new Date(); shiftEnd.setHours(eh, em, 0, 0);
        // Nếu có đơn xin về sớm đã duyệt N phút → mốc giờ ra ca dời sớm N phút
        const waiverEarlyMin = todayWaivers?.early || 0;
        const effectiveEnd = new Date(shiftEnd.getTime() - waiverEarlyMin * 60000);
        const diffFromEnd = Math.round((now.getTime() - effectiveEnd.getTime()) / 60000);

        // BÙ TRỪ 2 CHIỀU TRONG NGÀY:
        // net = (vào sớm) + (về trễ HOẶC -về sớm) — đã trừ phần xin phép.
        // VD: vào sớm 30p + về sớm 45p → net = 30 + (-45) = -15p (làm thiếu 15p)
        //     vào sớm 30p + về sớm 15p → net = 30 + (-15) = +15p (làm dư 15p)
        //     vào sớm 60p + về sớm 60p → net = 0 (đủ công)
        // |net| ≤ compThreshold → coi như đủ công, không thưởng/không phạt.
        // net > compThreshold → phần dư → OT pending chờ admin duyệt.
        // net < -compThreshold → phần thiếu → tự tạo phiếu xin về sớm chờ admin xử lý.
        const net = earlyArrivalRecorded + diffFromEnd;

        if (net > compThreshold) {
          extraPendingOT = net - compThreshold;
        } else if (net < -compThreshold) {
          earlyLeaveMinutes = Math.abs(net) - compThreshold;
        }
      }

      const totalPendingOT = extraPendingOT;
      const newOTStatus = totalPendingOT > 0
        ? ((todayRecord as any)?.overtime_status === 'approved' ? 'approved' : 'pending')
        : ((todayRecord as any)?.overtime_status || 'none');

      const { error } = await supabase.from('attendance_records').update({
        check_out_time: now.toISOString(),
        check_out_lat: gpsPos.lat,
        check_out_lng: gpsPos.lng,
        check_out_accuracy: gpsPos.accuracy,
        check_out_device_id: myDevice?.id || null,
        check_out_method: 'gps',
        total_work_minutes: totalMinutes,
        overtime_minutes: overtimeMinutes,
        early_leave_minutes: earlyLeaveMinutes,
        pending_overtime_minutes: totalPendingOT,
        overtime_status: newOTStatus,
      }).eq('id', todayRecord.id);
      if (error) throw error;

      // Auto-tạo phiếu xin về sớm nếu vượt ngưỡng bù trừ và chưa có phiếu nào cho ngày này.
      if (earlyLeaveMinutes > 0) {
        const { data: existing } = await supabase
          .from('leave_requests')
          .select('id')
          .eq('tenant_id', (todayRecord as any).tenant_id)
          .eq('user_id', (todayRecord as any).user_id)
          .eq('request_type', 'early_leave')
          .eq('leave_date_from', (todayRecord as any).date)
          .in('status', ['pending', 'approved'])
          .limit(1)
          .maybeSingle();
        if (!existing) {
          await supabase.from('leave_requests').insert({
            tenant_id: (todayRecord as any).tenant_id,
            user_id: (todayRecord as any).user_id,
            request_type: 'early_leave',
            leave_date_from: (todayRecord as any).date,
            leave_date_to: (todayRecord as any).date,
            time_minutes: earlyLeaveMinutes,
            reason: `[Tự động] Về sớm ${earlyLeaveMinutes}p — chờ admin duyệt`,
            status: 'pending',
          });
          qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
          qc.invalidateQueries({ queryKey: ['leave-requests-admin'] });
          qc.invalidateQueries({ queryKey: ['pending-approvals-count'] });
        }
      }

      let msg = `Check-out thành công! Tổng: ${Math.floor(totalMinutes/60)}h${totalMinutes%60}p`;
      if (totalPendingOT > 0) {
        msg += ` — ${totalPendingOT}p tăng ca chờ admin duyệt.`;
      } else if (earlyLeaveMinutes > 0) {
        msg += ` — Về sớm ${earlyLeaveMinutes}p.`;
      }
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  }, [todayRecord, gpsPos, myDevice, qc, deviceOk, shiftInfo, todayWaivers, compThreshold]);

  // Send remote check-in/out request to admin
  const handleSendRemoteRequest = useCallback(async (type: 'remote_checkin' | 'remote_checkout') => {
    if (!user?.id || !tenantId || !gpsPos || !nearestLocation) return;
    if (!remoteReason.trim()) {
      toast.error('Vui lòng nhập lý do');
      return;
    }
    setSendingRemote(true);
    try {
      const now = new Date();
      const { error } = await supabase.from('attendance_correction_requests').insert([{
        tenant_id: tenantId,
        user_id: user.id,
        request_date: today,
        request_type: type,
        requested_check_in: type === 'remote_checkin' ? now.toISOString() : null,
        requested_check_out: type === 'remote_checkout' ? now.toISOString() : null,
        reason: `[Ngoài phạm vi: ${distance}m / ${nearestLocation.radius_meters}m - ${nearestLocation.name}] ${remoteReason}`,
        status: 'pending',
        attendance_id: type === 'remote_checkout' ? todayRecord?.id : null,
      }]);
      if (error) throw error;
      toast.success('Đã gửi yêu cầu chấm công từ xa. Chờ admin duyệt.');
      setShowRemoteRequest(false);
      setRemoteReason('');
      qc.invalidateQueries({ queryKey: ['my-remote-request'] });
      qc.invalidateQueries({ queryKey: ['correction-requests'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSendingRemote(false);
    }
  }, [user?.id, tenantId, gpsPos, nearestLocation, distance, remoteReason, today, todayRecord, qc]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-4 safe-x safe-bottom">
      {/* Header with back button */}
      <div className="w-full max-w-md flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-muted-foreground">Chấm công</span>
        <div className="w-8" />
      </div>

      {/* Clock */}
      <div className="text-center mb-4">
        <p className="text-5xl sm:text-6xl font-bold tabular-nums text-foreground">
          {format(currentTime, 'HH:mm:ss')}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {format(currentTime, 'EEEE, dd/MM/yyyy', { locale: vi })}
        </p>
        <p className="text-base font-medium text-foreground mt-1">{profile?.display_name || user?.email}</p>
      </div>

      {/* Shift Info */}
      {shiftInfo && (
        <Card className="w-full max-w-md mb-3 border-primary/20">
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Ca: {shiftInfo.name}</p>
              <p className="text-xs text-muted-foreground">
                {shiftInfo.start_time?.slice(0, 5)} - {shiftInfo.end_time?.slice(0, 5)}
                {shiftInfo.break_minutes > 0 && ` · Nghỉ ${shiftInfo.break_minutes}p`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Cards */}
      <div className="w-full max-w-md space-y-2 mb-4">
        {/* GPS Status with signal quality */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {gpsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : gpsPos ? (
                  <Signal className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm">GPS</span>
              </div>
              {gpsPos ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">±{Math.round(gpsPos.accuracy)}m</span>
                  <Badge variant="outline" className={`text-[10px] ${gpsPos.accuracy <= 20 ? 'text-green-600 border-green-200' : gpsPos.accuracy <= 50 ? 'text-yellow-600 border-yellow-200' : 'text-orange-600 border-orange-200'}`}>
                    {gpsPos.accuracy <= 20 ? 'Chính xác' : gpsPos.accuracy <= 50 ? 'Tốt' : 'Trung bình'}
                  </Badge>
                </div>
              ) : (
                <Badge variant="destructive" className="text-[10px]">{gpsError || 'Lỗi'}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Location with distance progress */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className={`h-4 w-4 ${isInRange ? 'text-green-600' : 'text-destructive'}`} />
                <span className="text-sm font-medium">{nearestLocation?.name || 'Đang tìm...'}</span>
              </div>
              {distance !== null && (
                <Badge className={`text-[10px] ${isInRange ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {distance}m
                </Badge>
              )}
            </div>
            {nearestLocation && distance !== null && (
              <div className="space-y-1">
                <Progress value={distancePercent} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{isInRange ? '✓ Trong phạm vi' : '✗ Ngoài phạm vi'}</span>
                  <span>Cho phép: {nearestLocation.radius_meters}m</span>
                </div>
              </div>
            )}
            {/* Show other locations */}
            {allDistances.length > 1 && (
              <div className="pt-1 border-t space-y-0.5">
                <p className="text-[10px] text-muted-foreground">Điểm CC khác:</p>
                {allDistances.slice(1, 3).map(d => (
                  <div key={d.loc.id} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground truncate">{d.loc.name}</span>
                    <span className={d.dist <= d.loc.radius_meters ? 'text-green-600' : 'text-muted-foreground'}>{d.dist}m</span>
                  </div>
                ))}
              </div>
            )}
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
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">Chờ duyệt</Badge>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setShowOtpVerify(true)}>OTP</Button>
              </div>
            ) : myDevice.status === 'approved' ? (
              <Badge variant="outline" className="text-[10px] text-green-600">Đã xác nhận</Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">Bị từ chối</Badge>
            )}
          </CardContent>
        </Card>

        {/* Pending remote request */}
        {pendingRemoteRequest && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Đã gửi yêu cầu {pendingRemoteRequest.request_type === 'remote_checkin' ? 'check-in' : 'check-out'} từ xa
                </span>
              </div>
              <p className="text-xs text-blue-600/70 mt-1">Đang chờ admin duyệt...</p>
            </CardContent>
          </Card>
        )}

        {/* Working time card (when checked in) */}
        {hasCheckedIn && !hasCheckedOut && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Đang làm việc</span>
                </div>
                <span className="text-lg font-bold text-primary tabular-nums">
                  {Math.floor(workingMinutes / 60)}h{String(workingMinutes % 60).padStart(2, '0')}p
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Check-in: {todayRecord?.check_in_time ? format(new Date(todayRecord.check_in_time), 'HH:mm') : '--'}
                {todayRecord?.status === 'late' && todayRecord.late_minutes && (
                  <span className="text-yellow-600 ml-2">· Trễ {todayRecord.late_minutes}p</span>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Today completed */}
        {todayRecord && hasCheckedOut && (
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Hôm nay</span>
                <Badge className={todayRecord.status === 'late' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                  {todayRecord.status === 'late' ? 'Đi trễ' : 'Đúng giờ'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                <span>Vào: {format(new Date(todayRecord.check_in_time), 'HH:mm')}</span>
                <span>Ra: {format(new Date(todayRecord.check_out_time!), 'HH:mm')}</span>
                <span className="font-medium text-foreground">
                  {Math.floor((todayRecord.total_work_minutes || 0) / 60)}h{(todayRecord.total_work_minutes || 0) % 60}p
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-md space-y-3">
        {hasCheckedOut ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-2" />
            <p className="text-lg font-semibold text-green-600">Đã hoàn thành!</p>
          </div>
        ) : (
          <>
            {!hasCheckedIn ? (
              <>
                <Button
                  size="lg"
                  className="w-full h-16 text-lg font-bold rounded-2xl gap-2 shadow-lg"
                  disabled={!canCheckIn || checking}
                  onClick={handleCheckIn}
                >
                  {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
                  CHECK-IN
                </Button>

                {/* Remote check-in request button - shown when out of range but device OK */}
                {canRequestRemote && !pendingRemoteRequest && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full h-12 text-sm font-medium rounded-2xl gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                    onClick={() => setShowRemoteRequest(true)}
                  >
                    <Send className="h-4 w-4" />
                    Gửi yêu cầu check-in từ xa
                  </Button>
                )}
              </>
            ) : (
              <>
                {isInRange ? (
                  <Button
                    size="lg"
                    variant="destructive"
                    className="w-full h-16 text-lg font-bold rounded-2xl gap-2 shadow-lg"
                    disabled={!canCheckOut || checking}
                    onClick={handleCheckOut}
                  >
                    {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-6 w-6" />}
                    CHECK-OUT
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      variant="destructive"
                      className="w-full h-16 text-lg font-bold rounded-2xl gap-2 shadow-lg"
                      disabled
                    >
                      <XCircle className="h-6 w-6" />
                      CHECK-OUT
                    </Button>
                    {canRequestRemoteCheckout && !pendingRemoteRequest && (
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full h-12 text-sm font-medium rounded-2xl gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                        onClick={() => setShowRemoteRequest(true)}
                      >
                        <Send className="h-4 w-4" />
                        Gửi yêu cầu check-out từ xa
                      </Button>
                    )}
                  </>
                )}
              </>
            )}

            {/* Warnings */}
            {!deviceOk && !myDevice && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Bạn chưa đăng ký thiết bị. Vui lòng đăng ký trước khi chấm công.</span>
              </div>
            )}
            {!deviceOk && myDevice?.status === 'pending' && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Thiết bị đang chờ admin duyệt. Chưa thể chấm công.</span>
              </div>
            )}
            {!deviceOk && myDevice?.status === 'rejected' && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Thiết bị bị từ chối. Liên hệ admin để được hỗ trợ.</span>
              </div>
            )}
            {deviceOk && !isInRange && gpsPos && nearestLocation && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Ngoài phạm vi ({distance}m / {nearestLocation.radius_meters}m). Bạn có thể gửi yêu cầu từ xa.</span>
              </div>
            )}
            {gpsFraudWarning.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm text-orange-700 dark:text-orange-400">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Cảnh báo bảo mật: {gpsFraudWarning.join(', ')}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Remote Check-in/out Request Dialog */}
      <Dialog open={showRemoteRequest} onOpenChange={setShowRemoteRequest}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Yêu cầu chấm công từ xa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
              <p><span className="font-medium">Vị trí gần nhất:</span> {nearestLocation?.name}</p>
              <p><span className="font-medium">Khoảng cách:</span> {distance}m (cho phép: {nearestLocation?.radius_meters}m)</p>
              <p className="text-muted-foreground">Bạn đang ngoài phạm vi cho phép. Yêu cầu sẽ được gửi đến admin để duyệt.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Lý do *</label>
              <Textarea
                placeholder="VD: Đi giao hàng ngoài kho, công tác xa..."
                value={remoteReason}
                onChange={e => setRemoteReason(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoteRequest(false)}>Hủy</Button>
            <Button
              onClick={() => handleSendRemoteRequest(hasCheckedIn ? 'remote_checkout' : 'remote_checkin')}
              disabled={sendingRemote || !remoteReason.trim()}
              className="gap-1.5"
            >
              {sendingRemote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Random Verification Dialog */}
      <Dialog open={showRandomVerify} onOpenChange={setShowRandomVerify}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Xác minh tại chỗ
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Hệ thống kiểm tra ngẫu nhiên. Vui lòng nhập mã xác nhận hiển thị trên màn hình quản lý hoặc gõ "OK" để xác nhận bạn đang tại nơi làm việc.
          </p>
          <Input
            placeholder='Gõ "OK" để xác nhận'
            value={verifyAnswer}
            onChange={e => setVerifyAnswer(e.target.value)}
            className="h-10"
          />
          <DialogFooter>
            <Button
              size="sm"
              disabled={verifyAnswer.trim().toLowerCase() !== 'ok'}
              onClick={() => {
                setShowRandomVerify(false);
                setVerifyAnswer('');
                toast.success('Xác minh thành công!');
              }}
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OTP Device Verification */}
      {myDevice?.id && (
        <DeviceOtpVerification
          deviceId={myDevice.id}
          open={showOtpVerify}
          onOpenChange={setShowOtpVerify}
        />
      )}
    </div>
  );
}
