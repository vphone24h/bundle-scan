import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlatformUser, useCurrentTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

// Format ISO time → "HH:mm" theo giờ VN (UTC+7).
// Browser hiển thị theo local nhưng để chắc chắn cho admin nước ngoài, tự offset.
function fmtTimeVN(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const hh = String(vn.getUTCHours()).padStart(2, '0');
  const mm = String(vn.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
function fmtMinutes(mins: number) {
  const sign = mins < 0 ? '-' : '';
  const m = Math.abs(mins);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${sign}${h}h${r}p`;
  if (h) return `${sign}${h}h`;
  return `${sign}${r}p`;
}
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

function useTenantId() {
  const { data: pu } = usePlatformUser();
  const { data: ct } = useCurrentTenant();
  return ct?.id || pu?.tenant_id;
}

export function OvertimeReviewsTab() {
  const tenantId = useTenantId();
  const { data: pu } = usePlatformUser();
  const qc = useQueryClient();

  const now = new Date();
  const [monthStr, setMonthStr] = useState(format(now, 'yyyy-MM'));
  const monthStart = format(startOfMonth(parseISO(monthStr + '-01')), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(parseISO(monthStr + '-01')), 'yyyy-MM-dd');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');

  // Fetch overtime requests
  const { data: overtimeRequests, isLoading } = useQuery({
    queryKey: ['overtime-requests', tenantId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('overtime_requests')
        .select('*')
        .eq('tenant_id', tenantId!)
        .gte('request_date', monthStart)
        .lte('request_date', monthEnd)
        .order('request_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch attendance to auto-detect overtime candidates
  const { data: attendanceRecords } = useQuery({
    queryKey: ['attendance-overtime', tenantId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, work_shifts(name, start_time, end_time)')
        .eq('tenant_id', tenantId!)
        .gte('date', monthStart)
        .lte('date', monthEnd);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch shift assignments to detect day-off work
  const { data: shiftAssignments } = useQuery({
    queryKey: ['shift-assignments-ot', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch profiles for display names
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    overtimeRequests?.forEach(r => ids.add(r.user_id));
    attendanceRecords?.forEach(r => ids.add(r.user_id));
    return [...ids];
  }, [overtimeRequests, attendanceRecords]);

  const { data: profiles } = useQuery({
    queryKey: ['profiles-ot', userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);
      if (error) throw error;
      return data;
    },
    enabled: userIds.length > 0,
  });

  const profileMap = useMemo(() => new Map((profiles || []).map(p => [p.user_id, p.display_name])), [profiles]);

  // Map attendance theo key user|date để dialog/row tra cứu nhanh giờ check-in/out + ca.
  const attendanceMap = useMemo(() => {
    const m = new Map<string, any>();
    (attendanceRecords || []).forEach(a => m.set(`${a.user_id}_${a.date}`, a));
    return m;
  }, [attendanceRecords]);

  // Build auto-detected overtime items
  const detectedItems = useMemo(() => {
    if (!attendanceRecords || !shiftAssignments) return [];
    const existingKeys = new Set((overtimeRequests || []).map(r => `${r.user_id}_${r.request_date}_${r.request_type}`));
    const items: any[] = [];

    for (const att of attendanceRecords) {
      if (!att.check_in_time) continue;

      // Check if this is a day-off (not in schedule)
      const dateStr = att.date;
      const dow = new Date(dateStr).getDay();
      const userAssignments = shiftAssignments.filter(sa => sa.user_id === att.user_id);
      const isScheduled = userAssignments.some(sa =>
        (sa.assignment_type === 'fixed' && sa.day_of_week === dow) || sa.specific_date === dateStr
      );

      if (!isScheduled && !existingKeys.has(`${att.user_id}_${dateStr}_day_off`)) {
        items.push({
          user_id: att.user_id,
          request_date: dateStr,
          request_type: 'day_off',
          overtime_minutes: att.total_work_minutes || 0,
          attendance_id: att.id,
          auto_detected: true,
        });
      }

      // Check extra hours after shift end (overtime_minutes > 0)
      if (isScheduled && (att.overtime_minutes || 0) > 0 && !existingKeys.has(`${att.user_id}_${dateStr}_extra_hours`)) {
        items.push({
          user_id: att.user_id,
          request_date: dateStr,
          request_type: 'extra_hours',
          overtime_minutes: att.overtime_minutes || 0,
          attendance_id: att.id,
          auto_detected: true,
        });
      }

      // Check early check-in before shift start
      if (isScheduled && att.check_in_time && (att as any).work_shifts?.start_time) {
        const shift = (att as any).work_shifts;
        const [sh, sm] = shift.start_time.split(':').map(Number);
        const checkInDate = new Date(att.check_in_time);
        const shiftStartDate = new Date(checkInDate);
        shiftStartDate.setHours(sh, sm, 0, 0);
        const earlyMinutes = Math.round((shiftStartDate.getTime() - checkInDate.getTime()) / 60000);
        if (earlyMinutes > 5 && !existingKeys.has(`${att.user_id}_${dateStr}_early_checkin`)) {
          items.push({
            user_id: att.user_id,
            request_date: dateStr,
            request_type: 'early_checkin',
            overtime_minutes: earlyMinutes,
            attendance_id: att.id,
            auto_detected: true,
          });
        }
      }
    }
    return items;
  }, [attendanceRecords, shiftAssignments, overtimeRequests]);

  // Combine existing requests + auto-detected
  const allItems = useMemo(() => {
    const existing = (overtimeRequests || []).map(r => ({ ...r, auto_detected: false }));
    return [...existing, ...detectedItems];
  }, [overtimeRequests, detectedItems]);

  // Filter
  const filtered = useMemo(() => {
    let items = allItems;
    if (filterType !== 'all') items = items.filter(i => i.request_type === filterType);
    if (filterStatus === 'pending') items = items.filter(i => !i.status || i.status === 'pending' || i.auto_detected);
    else if (filterStatus === 'approved') items = items.filter(i => i.status === 'approved');
    else if (filterStatus === 'rejected') items = items.filter(i => i.status === 'rejected');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => (profileMap.get(i.user_id) || '').toLowerCase().includes(q));
    }
    return items.sort((a, b) => b.request_date.localeCompare(a.request_date));
  }, [allItems, filterType, filterStatus, searchQuery, profileMap]);

  // Approve/reject mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ item, approved, note }: { item: any; approved: boolean; note: string }) => {
      if (item.auto_detected) {
        // Create new record
        const { error } = await supabase.from('overtime_requests').insert({
          tenant_id: tenantId!,
          user_id: item.user_id,
          request_type: item.request_type,
          request_date: item.request_date,
          overtime_minutes: item.overtime_minutes,
          attendance_id: item.attendance_id,
          status: approved ? 'approved' : 'rejected',
          review_note: note || null,
          reviewed_by: pu?.user_id,
          reviewed_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else {
        // Update existing
        const { error } = await supabase.from('overtime_requests')
          .update({
            status: approved ? 'approved' : 'rejected',
            review_note: note || null,
            reviewed_by: pu?.user_id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overtime-requests'] });
      toast.success('Đã cập nhật');
      setReviewDialog(null);
      setReviewNote('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('overtime-review');
  const [showPwd, setShowPwd] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ item: any; approved: boolean; note: string } | null>(null);
  const guardedReview = (payload: { item: any; approved: boolean; note: string }) => {
    if (hasSecurityPassword && !unlocked) {
      setPendingAction(payload);
      setShowPwd(true);
      return;
    }
    reviewMutation.mutate(payload);
  };

  const pendingCount = allItems.filter(i => !i.status || i.status === 'pending' || i.auto_detected).length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input type="month" value={monthStr} onChange={e => setMonthStr(e.target.value)} className="w-40 h-9 text-xs" />
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Tìm NV..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9 text-xs" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            <SelectItem value="day_off">Ngày nghỉ</SelectItem>
            <SelectItem value="extra_hours">Ngoài giờ (sau ca)</SelectItem>
            <SelectItem value="early_checkin">Sớm ca</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="pending">Chờ duyệt</SelectItem>
            <SelectItem value="approved">Đã duyệt</SelectItem>
            <SelectItem value="rejected">Từ chối</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-amber-800 dark:text-amber-200 font-medium">{pendingCount} yêu cầu tăng ca chờ duyệt</span>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Không có yêu cầu tăng ca trong tháng này</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nhân viên</TableHead>
                  <TableHead className="text-xs">Ngày</TableHead>
                  <TableHead className="text-xs">Loại</TableHead>
                  <TableHead className="text-xs">Đối chiếu ca</TableHead>
                  <TableHead className="text-xs">Dư/OT</TableHead>
                  <TableHead className="text-xs">Trạng thái</TableHead>
                  <TableHead className="text-xs w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item, idx) => {
                  const isPending = !item.status || item.status === 'pending' || item.auto_detected;
                  const att = attendanceMap.get(`${item.user_id}_${item.request_date}`);
                  const ws = att?.work_shifts;
                  return (
                    <TableRow key={item.id || `auto-${idx}`}>
                      <TableCell className="text-xs font-medium">{profileMap.get(item.user_id) || item.user_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{item.request_date}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={item.request_type === 'day_off' ? 'default' : 'secondary'} className="text-[10px]">
                          {item.request_type === 'day_off' ? 'Ngày nghỉ' : item.request_type === 'early_checkin' ? 'Sớm ca' : 'Ngoài giờ'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] leading-tight">
                        {att ? (
                          <div className="space-y-0.5">
                            <div className="text-muted-foreground">
                              Ca: <span className="font-mono">{ws?.start_time?.slice(0,5) || '—'}–{ws?.end_time?.slice(0,5) || '—'}</span>
                            </div>
                            <div>
                              Vào: <span className="font-mono font-medium">{fmtTimeVN(att.check_in_time)}</span>
                              {' · '}Ra: <span className="font-mono font-medium">{fmtTimeVN(att.check_out_time)}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Chưa có chấm công</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        +{fmtMinutes(item.overtime_minutes || 0)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {isPending ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">Chờ duyệt</Badge>
                        ) : item.status === 'approved' ? (
                          <Badge className="bg-green-100 text-green-700 text-[10px]">Đã duyệt</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Từ chối</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isPending ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => {
                              setReviewDialog({ ...item, action: 'approve' });
                              setReviewNote('');
                            }}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                              setReviewDialog({ ...item, action: 'reject' });
                              setReviewNote('');
                            }}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{item.review_note || '-'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={o => !o && setReviewDialog(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {reviewDialog?.action === 'approve' ? 'Duyệt tăng ca' : 'Từ chối tăng ca'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>NV:</strong> {profileMap.get(reviewDialog?.user_id) || ''}</p>
            <p><strong>Ngày:</strong> {reviewDialog?.request_date}</p>
            <p><strong>Loại:</strong> {reviewDialog?.request_type === 'day_off' ? 'Làm ngày nghỉ' : reviewDialog?.request_type === 'early_checkin' ? 'Check-in sớm trước ca' : 'Làm thêm ngoài giờ'}</p>

            {(() => {
              if (!reviewDialog) return null;
              const att = attendanceMap.get(`${reviewDialog.user_id}_${reviewDialog.request_date}`);
              const ws = att?.work_shifts;
              return (
                <div className="rounded border bg-muted/40 p-3 space-y-1.5 text-xs">
                  <div className="font-semibold text-foreground">📋 Đối chiếu chấm công</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="text-muted-foreground">Ca làm:</div>
                    <div className="font-mono">{ws ? `${ws.start_time?.slice(0,5)} – ${ws.end_time?.slice(0,5)} (${ws.name || ''})` : 'Không xếp ca'}</div>
                    <div className="text-muted-foreground">Check-in thực tế:</div>
                    <div className="font-mono font-medium">{fmtTimeVN(att?.check_in_time)}</div>
                    <div className="text-muted-foreground">Check-out thực tế:</div>
                    <div className="font-mono font-medium">{fmtTimeVN(att?.check_out_time)}</div>
                    <div className="text-muted-foreground">Tổng giờ làm:</div>
                    <div className="font-medium">{att?.total_work_minutes ? fmtMinutes(att.total_work_minutes) : '—'}</div>
                  </div>
                  <div className="border-t pt-1.5 mt-1.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Phần dư xin tăng ca:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                      +{fmtMinutes(reviewDialog?.overtime_minutes || 0)}
                    </span>
                  </div>
                  {reviewDialog?.request_type === 'early_checkin' && (
                    <p className="text-[11px] text-muted-foreground italic">
                      NV vào sớm hơn ca {fmtMinutes(reviewDialog?.overtime_minutes || 0)} (vượt ngưỡng bù trừ tự động).
                    </p>
                  )}
                  {reviewDialog?.request_type === 'extra_hours' && (
                    <p className="text-[11px] text-muted-foreground italic">
                      NV ra ca trễ hơn giờ kết thúc {fmtMinutes(reviewDialog?.overtime_minutes || 0)} (vượt ngưỡng bù trừ tự động).
                    </p>
                  )}
                  {reviewDialog?.request_type === 'day_off' && (
                    <p className="text-[11px] text-muted-foreground italic">
                      NV đi làm ngày không có lịch ca → toàn bộ thời gian tính tăng ca.
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <Label className="text-xs">Ghi chú</Label>
              <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Ghi chú..." rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setReviewDialog(null)}>Hủy</Button>
            <Button
              size="sm"
              variant={reviewDialog?.action === 'approve' ? 'default' : 'destructive'}
              disabled={reviewMutation.isPending}
              onClick={() => guardedReview({
                item: reviewDialog,
                approved: reviewDialog?.action === 'approve',
                note: reviewNote,
              })}
            >
              {reviewMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {reviewDialog?.action === 'approve' ? 'Duyệt' : 'Từ chối'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        title="Xác thực duyệt tăng ca"
        description="Nhập mật khẩu bảo mật để duyệt yêu cầu tăng ca"
      />
    </div>
  );
}
