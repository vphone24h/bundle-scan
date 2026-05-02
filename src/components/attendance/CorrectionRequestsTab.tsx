import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Clock, FileEdit, Send, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformUser } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

const statusMap: Record<string, { label: string; class: string }> = {
  pending: { label: 'Chờ duyệt', class: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Đã duyệt', class: 'bg-green-100 text-green-800' },
  rejected: { label: 'Từ chối', class: 'bg-red-100 text-red-800' },
};

const typeLabels: Record<string, { label: string; icon: typeof FileEdit }> = {
  correction: { label: 'Sửa công', icon: FileEdit },
  remote_checkin: { label: 'Check-in từ xa', icon: Send },
  remote_checkout: { label: 'Check-out từ xa', icon: MapPin },
};

export function CorrectionRequestsTab() {
  const { user } = useAuth();
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const isAdmin = pu?.platform_role === 'tenant_admin' || pu?.platform_role === 'company_admin' || pu?.platform_role === 'platform_admin';
  const qc = useQueryClient();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('attendance-correction-review');
  const [showPwd, setShowPwd] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; status: 'approved' | 'rejected'; request: any } | null>(null);

  const guardedReview = (payload: { id: string; status: 'approved' | 'rejected'; request: any }) => {
    if (hasSecurityPassword && !unlocked) {
      setPendingAction(payload);
      setShowPwd(true);
      return;
    }
    reviewMutation.mutate(payload);
  };

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`attendance-corrections-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_correction_requests',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['correction-requests'] });
          qc.invalidateQueries({ queryKey: ['pending-approvals-count'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['attendance-records'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, qc]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['correction-requests', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_correction_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const userIds = [...new Set(requests?.map(r => r.user_id) || [])];
  const { data: profiles } = useQuery({
    queryKey: ['profiles-corrections', userIds],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      return Object.fromEntries((data || []).map(p => [p.user_id, p.display_name]));
    },
    enabled: userIds.length > 0,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, request }: { id: string; status: string; request?: any }) => {
      const buildAttendanceUpdates = async (currentRecord?: any) => {
        const effectiveCheckIn = request?.requested_check_in || currentRecord?.check_in_time || null;
        const effectiveCheckOut = request?.requested_check_out || currentRecord?.check_out_time || null;
        const hasCheckIn = !!effectiveCheckIn;
        const hasCheckOut = !!effectiveCheckOut;
        if (!hasCheckIn && !hasCheckOut) return null;

        const baseTime = new Date(effectiveCheckIn || effectiveCheckOut);
        const dayOfWeek = baseTime.getDay();
        const { data: shift } = await supabase
          .from('shift_assignments')
          .select('*, work_shifts(start_time, end_time, late_threshold_minutes)')
          .eq('user_id', request.user_id)
          .eq('tenant_id', request.tenant_id)
          .eq('is_active', true)
          .or(`specific_date.eq.${request.request_date},and(assignment_type.eq.fixed,day_of_week.eq.${dayOfWeek})`)
          .limit(1)
          .maybeSingle();

        let recordStatus = 'on_time';
        let lateMinutes = 0;
        let earlyLeaveMinutes = 0;
        let overtimeMinutes = 0;
        let totalMinutes = 0;

        if (hasCheckIn && shift?.work_shifts) {
          const ws = shift.work_shifts as any;
          const [h, m] = ws.start_time.split(':').map(Number);
          const shiftStart = new Date(effectiveCheckIn);
          shiftStart.setHours(h, m, 0, 0);
          const threshold = (ws.late_threshold_minutes || 15) * 60 * 1000;
          const diff = new Date(effectiveCheckIn).getTime() - shiftStart.getTime();
          if (diff > threshold) {
            recordStatus = 'late';
            lateMinutes = Math.round(diff / 60000);
          }
        }

        if (hasCheckIn && hasCheckOut) {
          const checkInTime = new Date(effectiveCheckIn);
          const checkOutTime = new Date(effectiveCheckOut);
          totalMinutes = Math.max(0, Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000));

          if (shift?.work_shifts) {
            const ws = shift.work_shifts as any;
            const [eh, em] = ws.end_time.split(':').map(Number);
            const shiftEnd = new Date(checkOutTime);
            shiftEnd.setHours(eh, em, 0, 0);
            const diffFromEnd = Math.round((checkOutTime.getTime() - shiftEnd.getTime()) / 60000);
            if (diffFromEnd > 0) overtimeMinutes = diffFromEnd;
            if (diffFromEnd < 0) {
              earlyLeaveMinutes = Math.abs(diffFromEnd);
              if (recordStatus === 'on_time') recordStatus = 'early_leave';
            }
          }
        }

        return {
          shiftId: shift?.shift_id || null,
          updates: {
            check_in_time: request.requested_check_in ?? undefined,
            check_out_time: request.requested_check_out ?? undefined,
            check_in_method: request?.requested_check_in ? 'manual' : undefined,
            check_out_method: request?.requested_check_out ? 'manual' : undefined,
            status: hasCheckIn ? recordStatus : undefined,
            late_minutes: lateMinutes,
            early_leave_minutes: earlyLeaveMinutes,
            overtime_minutes: overtimeMinutes,
            total_work_minutes: totalMinutes,
            note: `✅ Sửa công được duyệt bởi admin. Lý do: ${request.reason}`,
          },
        };
      };

      // If approving a remote check-in, create the attendance record
      if (status === 'approved' && request?.request_type === 'remote_checkin' && request.requested_check_in) {
        const attendancePayload = await buildAttendanceUpdates();

        const { error: insertError } = await supabase.from('attendance_records').insert([{
          tenant_id: request.tenant_id,
          user_id: request.user_id,
          date: request.request_date,
          shift_id: attendancePayload?.shiftId || null,
          check_in_time: request.requested_check_in,
          check_in_method: 'manual',
          status: attendancePayload?.updates.status || 'on_time',
          late_minutes: attendancePayload?.updates.late_minutes || 0,
          note: `✅ Check-in từ xa được duyệt bởi admin. Lý do: ${request.reason}`,
        }]);
        if (insertError) throw insertError;
      }

      // If approving a remote check-out, update the attendance record
      if (status === 'approved' && request?.request_type === 'remote_checkout' && request.requested_check_out) {
        // Find today's attendance record for this user
        const { data: record } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', request.user_id)
          .eq('date', request.request_date)
          .maybeSingle();

        if (record && !record.check_out_time) {
          const checkOutTime = new Date(request.requested_check_out);
          const checkInTime = new Date(record.check_in_time);
          const totalMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
          
          const { error: updateError } = await supabase.from('attendance_records').update({
            check_out_time: request.requested_check_out,
            check_out_method: 'manual',
            total_work_minutes: totalMinutes,
            note: (record.note ? record.note + ' | ' : '') + `✅ Check-out từ xa được duyệt bởi admin.`,
          }).eq('id', record.id);
          if (updateError) throw updateError;
        }
      }

      if (status === 'approved' && request?.request_type === 'correction') {
        const { data: existingRecord } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('tenant_id', request.tenant_id)
          .eq('user_id', request.user_id)
          .eq('date', request.request_date)
          .maybeSingle();

        const attendancePayload = await buildAttendanceUpdates(existingRecord);
        if (!attendancePayload) return;

        const updates = Object.fromEntries(
          Object.entries(attendancePayload.updates).filter(([, value]) => value !== undefined)
        );

        if (existingRecord) {
          const { error: updateError } = await supabase
            .from('attendance_records')
            .update({
              ...updates,
              note: existingRecord.note
                ? `${existingRecord.note} | ✅ Sửa công được duyệt bởi admin. Lý do: ${request.reason}`
                : `✅ Sửa công được duyệt bởi admin. Lý do: ${request.reason}`,
            })
            .eq('id', existingRecord.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from('attendance_records').insert([{
            tenant_id: request.tenant_id,
            user_id: request.user_id,
            date: request.request_date,
            shift_id: attendancePayload.shiftId,
            ...updates,
          }]);
          if (insertError) throw insertError;
        }
      }

      const { error } = await supabase
        .from('attendance_correction_requests')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['correction-requests'] });
      qc.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
      const isRemote = vars.request?.request_type?.startsWith('remote_');
      toast.success(
        vars.status === 'approved'
          ? isRemote ? 'Đã duyệt yêu cầu chấm công từ xa' : 'Đã duyệt yêu cầu sửa công'
          : 'Đã từ chối yêu cầu'
      );
      setReviewingId(null);
      setReviewNote('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const otherRequests = requests?.filter(r => r.status !== 'pending') || [];

  const getTypeInfo = (type: string) => typeLabels[type] || typeLabels.correction;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Yêu cầu sửa công & chấm công từ xa</h3>
        {pendingRequests.length > 0 && (
          <Badge variant="destructive" className="text-xs">{pendingRequests.length} chờ duyệt</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
      ) : !requests?.length ? (
        <div className="text-center py-8 text-muted-foreground">Chưa có yêu cầu nào</div>
      ) : (
        <div className="space-y-4">
          {/* Pending */}
          {pendingRequests.length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-yellow-700">Chờ duyệt ({pendingRequests.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingRequests.map(r => {
                  const typeInfo = getTypeInfo(r.request_type);
                  const isRemote = r.request_type.startsWith('remote_');
                  return (
                    <div key={r.id} className={`border rounded-lg p-3 space-y-2 ${isRemote ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{profiles?.[r.user_id] || r.user_id.slice(0, 8)}</span>
                          <Badge variant="outline" className={`text-[10px] ${isRemote ? 'border-blue-300 text-blue-700' : ''}`}>
                            {typeInfo.label}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'HH:mm dd/MM')}</span>
                      </div>
                      <p className="text-xs"><span className="text-muted-foreground">Ngày:</span> {format(new Date(r.request_date), 'dd/MM/yyyy')}</p>
                      <div className="flex gap-4 text-xs">
                        {r.requested_check_in && <span>Check-in: {format(new Date(r.requested_check_in), 'HH:mm')}</span>}
                        {r.requested_check_out && <span>Check-out: {format(new Date(r.requested_check_out), 'HH:mm')}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">Lý do: {r.reason}</p>
                      
                      {isAdmin && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm" variant="outline"
                            className="gap-1 text-xs h-7 text-green-700"
                            onClick={() => reviewMutation.mutate({ id: r.id, status: 'approved', request: r })}
                            disabled={reviewMutation.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Duyệt
                          </Button>
                          <Dialog open={reviewingId === r.id} onOpenChange={open => { if (!open) setReviewingId(null); }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-destructive" onClick={() => setReviewingId(r.id)}>
                                <XCircle className="h-3 w-3" /> Từ chối
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm">
                              <DialogHeader><DialogTitle>Từ chối yêu cầu</DialogTitle></DialogHeader>
                              <Textarea placeholder="Lý do từ chối..." value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
                              <DialogFooter>
                                <Button variant="destructive" size="sm" onClick={() => guardedReview({ id: r.id, status: 'rejected', request: r })} disabled={!reviewNote.trim()}>
                                  Xác nhận từ chối
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* History */}
          {otherRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Lịch sử</CardTitle></CardHeader>
              <CardContent>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nhân viên</TableHead>
                        <TableHead>Loại</TableHead>
                        <TableHead>Ngày</TableHead>
                        <TableHead>Lý do</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Ghi chú</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {otherRequests.map(r => {
                        const st = statusMap[r.status] || statusMap.pending;
                        const typeInfo = getTypeInfo(r.request_type);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-sm">{profiles?.[r.user_id] || r.user_id.slice(0, 8)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{typeInfo.label}</Badge></TableCell>
                            <TableCell className="text-sm">{format(new Date(r.request_date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.reason}</TableCell>
                            <TableCell><Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.review_note || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-2">
                  {otherRequests.map(r => {
                    const st = statusMap[r.status] || statusMap.pending;
                    const typeInfo = getTypeInfo(r.request_type);
                    return (
                      <div key={r.id} className="border rounded-lg p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{profiles?.[r.user_id] || r.user_id.slice(0, 8)}</span>
                            <Badge variant="outline" className="text-[10px]">{typeInfo.label}</Badge>
                          </div>
                          <Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{format(new Date(r.request_date), 'dd/MM/yyyy')} - {r.reason}</p>
                        {r.review_note && <p className="text-xs text-muted-foreground italic">"{r.review_note}"</p>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
