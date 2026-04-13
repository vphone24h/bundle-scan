import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarOff, Plus, Clock, CheckCircle, XCircle, Loader2, Send } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  userId?: string;
  tenantId?: string | null;
}

export function EmployeeLeaveRequests({ userId, tenantId }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [leaveDate, setLeaveDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const qc = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['my-leave-requests', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Salary config to show paid leave info
  const { data: salaryConfig } = useQuery({
    queryKey: ['my-salary-config-leave', userId, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_salary_configs')
        .select('*, salary_templates(name, paid_leave_days_per_month)')
        .eq('user_id', userId!)
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error('Vui lòng nhập lý do xin nghỉ');
      if (!leaveDate) throw new Error('Vui lòng chọn ngày nghỉ');
      const { error } = await supabase.from('leave_requests').insert({
        tenant_id: tenantId!,
        user_id: userId!,
        leave_date: leaveDate,
        reason: reason.trim(),
      });
      if (error) {
        if (error.code === '23505') throw new Error('Bạn đã gửi đơn xin nghỉ cho ngày này rồi');
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      toast.success('Đã gửi đơn xin nghỉ');
      setShowForm(false);
      setReason('');
      setLeaveDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidLeaveDays = (salaryConfig?.salary_templates as any)?.paid_leave_days_per_month || 0;

  // Count approved leaves this month
  const now = new Date();
  const thisMonthApproved = (requests || []).filter(r => {
    const d = parseISO(r.leave_date);
    return r.status === 'approved' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const remainingPaidLeave = Math.max(0, paidLeaveDays - thisMonthApproved);

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Đã duyệt</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Từ chối</Badge>;
    return <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]"><Clock className="h-3 w-3 mr-1" />Chờ duyệt</Badge>;
  };

  return (
    <div className="space-y-3">
      {/* Leave quota info */}
      {paidLeaveDays > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Nghỉ có lương tháng này</p>
              <p className="text-sm font-semibold">
                Đã dùng: <span className="text-primary">{thisMonthApproved}/{paidLeaveDays}</span> ngày
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Còn lại</p>
              <p className={`text-lg font-bold ${remainingPaidLeave > 0 ? 'text-green-600' : 'text-destructive'}`}>
                {remainingPaidLeave}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <CalendarOff className="h-4 w-4" /> Đơn xin nghỉ
        </h3>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Xin nghỉ
        </Button>
      </div>

      {/* Request Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" /> Xin nghỉ phép
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ngày xin nghỉ <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={leaveDate}
                onChange={e => setLeaveDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div>
              <Label>Lý do <span className="text-destructive">*</span></Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Nhập lý do xin nghỉ..."
                rows={3}
              />
            </div>
            {paidLeaveDays > 0 && (
              <p className="text-xs text-muted-foreground">
                💡 Bạn còn <strong>{remainingPaidLeave}</strong> ngày nghỉ có lương tháng này.
                {remainingPaidLeave <= 0 && ' Nghỉ thêm sẽ bị trừ lương ngày công.'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !reason.trim() || !leaveDate}
              className="gap-1"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Đang tải...</div>
      ) : !requests?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Chưa có đơn xin nghỉ nào
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <Card key={req.id} className="shadow-none">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {format(parseISO(req.leave_date), 'dd/MM/yyyy')}
                      </span>
                      {statusBadge(req.status)}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.reason}</p>
                    {req.review_note && (
                      <p className="text-xs mt-1 text-muted-foreground italic">
                        📝 Admin: {req.review_note}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Gửi lúc {format(parseISO(req.created_at), 'HH:mm dd/MM/yyyy')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
