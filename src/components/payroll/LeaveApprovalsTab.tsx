import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformUser, useCurrentTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, CheckCircle, XCircle, Clock, CalendarOff, AlertTriangle, LogIn, LogOut } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, parseISO, eachDayOfInterval, differenceInCalendarDays } from 'date-fns';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

function useTenantId() {
  const { data: pu } = usePlatformUser();
  const { data: ct } = useCurrentTenant();
  return ct?.id || pu?.tenant_id;
}

export function LeaveApprovalsTab() {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [deductSalary, setDeductSalary] = useState(false);
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('leave-approval-review');
  const [showPwd, setShowPwd] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'approved' | 'unexcused' | 'rejected'; note: string; deduct?: boolean } | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['leave-requests-admin', tenantId, filterStatus],
    queryFn: async () => {
      let q = supabase
        .from('leave_requests')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (filterStatus !== 'all') q = q.eq('status', filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: platformUsers } = useQuery({
    queryKey: ['platform-users-names', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_users')
        .select('user_id, display_name, email')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const userMap = useMemo(() => {
    return new Map((platformUsers || []).map(u => [u.user_id, u.display_name || u.email || u.user_id.slice(0, 8)]));
  }, [platformUsers]);

  // 3 actions: approved (có phép), unexcused (không phép but still off), rejected (không được nghỉ)
  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, note, deduct }: { id: string; action: 'approved' | 'unexcused' | 'rejected'; note: string; deduct?: boolean }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: action,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_note: note || null,
          deduct_salary: deduct === true,
        })
        .eq('id', id);
      if (error) throw error;

      const req = requests?.find(r => r.id === id);
      if (!req) return;

      const reqType = (req as any).request_type || 'full_day';

      // For approved & unexcused FULL-DAY leaves: create absence_reviews for each day
      // late_arrival / early_leave handled separately by payroll engine (waives late/early minutes)
      if ((action === 'approved' || action === 'unexcused') && reqType === 'full_day') {
        const days = eachDayOfInterval({ start: parseISO(req.leave_date_from), end: parseISO(req.leave_date_to) });
        
        for (const day of days) {
          const dateStr = format(day, 'yyyy-MM-dd');
          await supabase.from('absence_reviews').upsert({
            tenant_id: tenantId!,
            user_id: req.user_id,
            absence_date: dateStr,
            is_excused: action === 'approved',
            review_note: `${action === 'approved' ? 'Nghỉ có phép' : 'Nghỉ không phép'}: ${note || req.reason}`,
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
          }, { onConflict: 'tenant_id,user_id,absence_date' });
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['leave-requests-admin'] });
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      qc.invalidateQueries({ queryKey: ['absence-reviews'] });
      const msg = vars.action === 'approved' ? 'Đã duyệt có phép' : vars.action === 'unexcused' ? 'Đã duyệt không phép' : 'Đã từ chối đơn nghỉ';
      toast.success(msg);
      setReviewDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const guardedReview = (payload: { id: string; action: 'approved' | 'unexcused' | 'rejected'; note: string; deduct?: boolean }) => {
    if (hasSecurityPassword && !unlocked) {
      setPendingAction(payload);
      setShowPwd(true);
      return;
    }
    reviewMutation.mutate(payload);
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return requests || [];
    const q = searchQuery.toLowerCase();
    return (requests || []).filter(r => {
      const name = userMap.get(r.user_id) || '';
      return name.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q);
    });
  }, [requests, searchQuery, userMap]);

  const stats = useMemo(() => {
    const all = requests || [];
    return {
      pending: all.filter(r => r.status === 'pending').length,
      approved: all.filter(r => r.status === 'approved').length,
      unexcused: all.filter(r => r.status === 'unexcused').length,
      rejected: all.filter(r => r.status === 'rejected').length,
      total: all.length,
    };
  }, [requests]);

  const openReview = (req: any) => {
    setReviewDialog(req);
    setReviewNote('');
    setDeductSalary(req?.deduct_salary === true);
  };

  const formatDateRange = (from: string, to: string) => {
    const f = format(parseISO(from), 'dd/MM/yyyy');
    const t = format(parseISO(to), 'dd/MM/yyyy');
    if (f === t) return f;
    const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
    return `${f} → ${t} (${days} ngày)`;
  };

  const requestTypeBadge = (req: any) => {
    const t = req.request_type || 'full_day';
    if (t === 'late_arrival') return (
      <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">
        <LogIn className="h-3 w-3 mr-1" />Đi muộn {req.time_minutes || 0}'
      </Badge>
    );
    if (t === 'early_leave') return (
      <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">
        <LogOut className="h-3 w-3 mr-1" />Về sớm {req.time_minutes || 0}'
      </Badge>
    );
    return (
      <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700">
        <CalendarOff className="h-3 w-3 mr-1" />Nghỉ cả ngày
      </Badge>
    );
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Có phép</Badge>;
    if (status === 'unexcused') return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Không phép</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Từ chối</Badge>;
    return <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]"><Clock className="h-3 w-3 mr-1" />Chờ duyệt</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('pending')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Chờ duyệt</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('approved')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-xs text-muted-foreground">Có phép</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('unexcused')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.unexcused}</div>
            <div className="text-xs text-muted-foreground">Không phép</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('rejected')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
            <div className="text-xs text-muted-foreground">Từ chối</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('all')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Tổng cộng</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[150px]">
          <Label className="text-xs">Tìm kiếm</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tên NV, lý do..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
          </div>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Chờ duyệt</SelectItem>
            <SelectItem value="approved">Có phép</SelectItem>
            <SelectItem value="unexcused">Không phép</SelectItem>
            <SelectItem value="rejected">Từ chối</SelectItem>
            <SelectItem value="all">Tất cả</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Không có đơn xin nghỉ nào</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Ngày nghỉ</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày gửi</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium text-sm">{userMap.get(req.user_id) || req.user_id.slice(0, 8)}</TableCell>
                    <TableCell>{requestTypeBadge(req)}</TableCell>
                    <TableCell className="text-sm">{formatDateRange(req.leave_date_from, req.leave_date_to)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{req.reason}</TableCell>
                    <TableCell>{statusBadge(req.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(parseISO(req.created_at), 'dd/MM HH:mm')}</TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' ? (
                        <Button size="sm" variant="outline" onClick={() => openReview(req)}>Duyệt</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => openReview(req)}>Chi tiết</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" /> Duyệt đơn xin phép
            </DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              <div>{requestTypeBadge(reviewDialog)}</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nhân viên</Label>
                  <div className="font-medium">{userMap.get(reviewDialog.user_id) || reviewDialog.user_id.slice(0, 8)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ngày</Label>
                  <div className="font-medium">{formatDateRange(reviewDialog.leave_date_from, reviewDialog.leave_date_to)}</div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Lý do</Label>
                <div className="text-sm bg-muted p-2 rounded">{reviewDialog.reason}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Trạng thái hiện tại</Label>
                <div className="mt-1">{statusBadge(reviewDialog.status)}</div>
              </div>
              {reviewDialog.status === 'pending' && (
                <>
                  <div>
                    <Label>Ghi chú duyệt</Label>
                    <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Ghi chú..." rows={2} />
                  </div>
                  {(reviewDialog.request_type === 'late_arrival' || reviewDialog.request_type === 'early_leave') ? (
                    <div className="bg-muted/50 p-3 rounded text-xs space-y-1.5">
                      <p>✅ <strong>Duyệt</strong>: <strong>Không tính phạt</strong> phút {reviewDialog.request_type === 'late_arrival' ? 'đi muộn' : 'về sớm'} của ngày đó.</p>
                      <p>❌ <strong>Từ chối</strong>: Hệ thống vẫn <strong>tính phạt</strong> theo quy định công ty.</p>
                    </div>
                  ) : (
                    <div className="bg-muted/50 p-3 rounded text-xs space-y-1.5">
                      <p>✅ <strong>Có phép</strong>: Nghỉ có phép — nếu còn hạn mức nghỉ có lương thì không trừ lương, hết hạn mức chỉ trừ ngày công.</p>
                      <p>⚠️ <strong>Không phép</strong>: Cho nghỉ nhưng không phép — trừ lương ngày công + phạt theo quy định.</p>
                      <p>❌ <strong>Từ chối</strong>: Không được nghỉ — nhân viên phải đi làm.</p>
                    </div>
                  )}
                </>
              )}
              {reviewDialog.review_note && reviewDialog.status !== 'pending' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Ghi chú admin</Label>
                  <div className="text-sm bg-muted p-2 rounded">{reviewDialog.review_note}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {reviewDialog?.status === 'pending' && (
              (reviewDialog.request_type === 'late_arrival' || reviewDialog.request_type === 'early_leave') ? (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => guardedReview({ id: reviewDialog.id, action: 'approved', note: reviewNote })}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Duyệt (miễn phạt)
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => guardedReview({ id: reviewDialog.id, action: 'rejected', note: reviewNote })}
                    disabled={reviewMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Từ chối (vẫn tính phạt)
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => guardedReview({ id: reviewDialog.id, action: 'approved', note: reviewNote })}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Duyệt có phép
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-orange-400 text-orange-600 hover:bg-orange-50"
                    onClick={() => guardedReview({ id: reviewDialog.id, action: 'unexcused', note: reviewNote })}
                    disabled={reviewMutation.isPending}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" /> Duyệt không phép
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => guardedReview({ id: reviewDialog.id, action: 'rejected', note: reviewNote })}
                    disabled={reviewMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Từ chối (không được nghỉ)
                  </Button>
                </>
              )
            )}
            <Button variant="outline" onClick={() => setReviewDialog(null)} className="w-full">Đóng</Button>
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
        title="Xác thực duyệt nghỉ phép"
        description="Nhập mật khẩu bảo mật để duyệt yêu cầu nghỉ phép"
      />
    </div>
  );
}
