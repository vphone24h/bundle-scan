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

const attendanceStatusMap: Record<string, { label: string; class: string }> = {
  on_time: { label: 'Đúng giờ', class: 'bg-green-100 text-green-800' },
  late: { label: 'Trễ', class: 'bg-orange-100 text-orange-800' },
  early_leave: { label: 'Về sớm', class: 'bg-amber-100 text-amber-800' },
  absent: { label: 'Vắng', class: 'bg-red-100 text-red-800' },
};

function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h${m}p`;
  if (h > 0) return `${h}h`;
  return `${m}p`;
}

// Format ISO time → "HH:mm" theo giờ VN (UTC+7)
function fmtTimeVN(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${String(vn.getUTCHours()).padStart(2, '0')}:${String(vn.getUTCMinutes()).padStart(2, '0')}`;
}

export function CorrectionRequestsTab() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const isAdmin = pu?.platform_role === 'tenant_admin' || pu?.platform_role === 'company_admin' || pu?.platform_role === 'platform_admin';
  const qc = useQueryClient();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('attendance-correction-review');
  const [showPwd, setShowPwd] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; status: 'approved' | 'rejected'; request: any; penaltyAction?: 'waive' | 'deduct_ot' | 'penalize' } | null>(null);
  // Dialog đối chiếu giờ ca khi duyệt yêu cầu sửa công
  const [approveDialog, setApproveDialog] = useState<any | null>(null);

  const guardedReview = (payload: { id: string; status: 'approved' | 'rejected'; request: any; penaltyAction?: 'waive' | 'deduct_ot' | 'penalize' }) => {
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

  // Lấy bản ghi chấm công tương ứng cho các request đã duyệt
  // để hiển thị trạng thái thực tế (đúng giờ / trễ / về sớm) sau khi duyệt
  const approvedKeys = (requests || [])
    .filter(r => r.status === 'approved')
    .map(r => ({ user_id: r.user_id, date: r.request_date }));
  const approvedKeysSig = JSON.stringify(approvedKeys);

  const { data: attendanceMap } = useQuery({
    queryKey: ['correction-attendance-map', tenantId, approvedKeysSig],
    queryFn: async () => {
      if (!approvedKeys.length || !tenantId) return {};
      const uniqueUserIds = [...new Set(approvedKeys.map(k => k.user_id))];
      const uniqueDates = [...new Set(approvedKeys.map(k => k.date))];
      const { data } = await supabase
        .from('attendance_records')
        .select('user_id, date, status, late_minutes, early_leave_minutes, check_in_time, check_out_time')
        .eq('tenant_id', tenantId)
        .in('user_id', uniqueUserIds)
        .in('date', uniqueDates);
      const map: Record<string, any> = {};
      (data || []).forEach((rec: any) => {
        map[`${rec.user_id}_${rec.date}`] = rec;
      });
      return map;
    },
    enabled: !!tenantId && approvedKeys.length > 0,
    staleTime: 5000,
  });

  const getAttendanceStatus = (r: any) => {
    if (r.status !== 'approved') return null;
    const rec = attendanceMap?.[`${r.user_id}_${r.request_date}`];
    if (!rec) return null;
    const st = attendanceStatusMap[rec.status] || attendanceStatusMap.on_time;
    let detail = '';
    if (rec.status === 'late' && rec.late_minutes) detail = `${formatMinutes(rec.late_minutes)}`;
    else if (rec.status === 'early_leave' && rec.early_leave_minutes) detail = `${formatMinutes(rec.early_leave_minutes)}`;
    return {
      ...st,
      detail,
      checkIn: rec.check_in_time ? format(new Date(rec.check_in_time), 'HH:mm') : null,
      checkOut: rec.check_out_time ? format(new Date(rec.check_out_time), 'HH:mm') : null,
      lateMin: rec.late_minutes || 0,
      earlyMin: rec.early_leave_minutes || 0,
    };
  };

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, request, penaltyAction }: { id: string; status: string; request?: any; penaltyAction?: 'waive' | 'deduct_ot' | 'penalize' }) => {
      const { data, error } = await supabase.functions.invoke('review-attendance-correction', {
        body: {
          requestId: id,
          action: status,
          reviewNote: reviewNote || null,
          penaltyAction: penaltyAction || null,
        },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Không thể duyệt yêu cầu sửa công');
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['correction-requests'] });
      qc.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['leave-requests-admin'] });
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      const isRemote = vars.request?.request_type?.startsWith('remote_');
      toast.success(
        vars.status === 'approved'
          ? isRemote ? 'Đã duyệt yêu cầu chấm công từ xa' : 'Đã duyệt yêu cầu sửa công'
          : 'Đã từ chối yêu cầu'
      );
      setReviewingId(null);
      setReviewNote('');
      setApproveDialog(null);
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
                            onClick={() => guardedReview({ id: r.id, status: 'approved', request: r })}
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
                        const attSt = getAttendanceStatus(r);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-sm">{profiles?.[r.user_id] || r.user_id.slice(0, 8)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{typeInfo.label}</Badge></TableCell>
                            <TableCell className="text-sm">{format(new Date(r.request_date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.reason}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge className={`text-[10px] w-fit ${st.class}`}>{st.label}</Badge>
                                {attSt && (
                                  <>
                                    <Badge className={`text-[10px] w-fit ${attSt.class}`}>
                                      {attSt.label}
                                      {attSt.lateMin > 0 ? ` • Trễ ${formatMinutes(attSt.lateMin)}` : ''}
                                      {attSt.earlyMin > 0 ? ` • Về sớm ${formatMinutes(attSt.earlyMin)}` : ''}
                                      {' '}• Có phép
                                    </Badge>
                                    <span className="text-[11px] text-muted-foreground">
                                      Vào: <strong className="text-foreground">{attSt.checkIn || '--:--'}</strong>
                                      {' '}· Ra: <strong className="text-foreground">{attSt.checkOut || '--:--'}</strong>
                                    </span>
                                  </>
                                )}
                              </div>
                            </TableCell>
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
                    const attSt = getAttendanceStatus(r);
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
                        {attSt && (
                          <div className="space-y-1">
                            <Badge className={`text-[10px] ${attSt.class}`}>
                              {attSt.label}
                              {attSt.lateMin > 0 ? ` • Trễ ${formatMinutes(attSt.lateMin)}` : ''}
                              {attSt.earlyMin > 0 ? ` • Về sớm ${formatMinutes(attSt.earlyMin)}` : ''}
                              {' '}• Có phép
                            </Badge>
                            <p className="text-[11px] text-muted-foreground">
                              Vào: <strong className="text-foreground">{attSt.checkIn || '--:--'}</strong>
                              {' '}· Ra: <strong className="text-foreground">{attSt.checkOut || '--:--'}</strong>
                            </p>
                          </div>
                        )}
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
      <SecurityPasswordDialog
        open={showPwd}
        onOpenChange={setShowPwd}
        onSuccess={() => {
          unlock();
          if (pendingAction) {
            reviewMutation.mutate(pendingAction);
            setPendingAction(null);
          }
        }}
        title="Xác thực duyệt sửa công"
        description="Nhập mật khẩu bảo mật để duyệt/từ chối yêu cầu sửa công"
      />
    </div>
  );
}
