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
import { Loader2, Search, CheckCircle, XCircle, Clock, CalendarOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

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

  // Fetch leave requests
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

  // Platform users for names
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

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, approved, note }: { id: string; approved: boolean; note: string }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_note: note || null,
        })
        .eq('id', id);
      if (error) throw error;

      // If approved, also create/update absence_review as excused
      if (approved) {
        const req = requests?.find(r => r.id === id);
        if (req) {
          await supabase.from('absence_reviews').upsert({
            tenant_id: tenantId!,
            user_id: req.user_id,
            absence_date: req.leave_date,
            is_excused: true,
            review_note: `Đã duyệt đơn xin nghỉ: ${note || req.reason}`,
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
      toast.success(vars.approved ? 'Đã duyệt đơn xin nghỉ' : 'Đã từ chối đơn xin nghỉ');
      setReviewDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      rejected: all.filter(r => r.status === 'rejected').length,
      total: all.length,
    };
  }, [requests]);

  const openReview = (req: any) => {
    setReviewDialog(req);
    setReviewNote('');
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Đã duyệt</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Từ chối</Badge>;
    return <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]"><Clock className="h-3 w-3 mr-1" />Chờ duyệt</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('pending')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Chờ duyệt</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('approved')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-xs text-muted-foreground">Đã duyệt</div>
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
            <SelectItem value="approved">Đã duyệt</SelectItem>
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
                    <TableCell className="text-sm">{format(parseISO(req.leave_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{req.reason}</TableCell>
                    <TableCell>{statusBadge(req.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(parseISO(req.created_at), 'dd/MM HH:mm')}</TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                            onClick={() => approveMutation.mutate({ id: req.id, approved: true, note: '' })}
                            disabled={approveMutation.isPending}>
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openReview(req)}>
                            Xem
                          </Button>
                        </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" /> Duyệt đơn xin nghỉ
            </DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nhân viên</Label>
                  <div className="font-medium">{userMap.get(reviewDialog.user_id) || reviewDialog.user_id.slice(0, 8)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ngày nghỉ</Label>
                  <div className="font-medium">{format(parseISO(reviewDialog.leave_date), 'dd/MM/yyyy')}</div>
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
                  <div className="bg-muted/50 p-3 rounded text-xs space-y-1">
                    <p>✅ <strong>Duyệt</strong>: Nghỉ có phép — nếu còn hạn mức nghỉ có lương thì không trừ lương, hết hạn mức chỉ trừ ngày công (không phạt thêm).</p>
                    <p>❌ <strong>Từ chối</strong>: Nghỉ không phép — trừ lương ngày công + phạt theo quy định.</p>
                  </div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Đóng</Button>
            {reviewDialog?.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => approveMutation.mutate({ id: reviewDialog.id, approved: false, note: reviewNote })}
                  disabled={approveMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Từ chối
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => approveMutation.mutate({ id: reviewDialog.id, approved: true, note: reviewNote })}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Duyệt nghỉ
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
