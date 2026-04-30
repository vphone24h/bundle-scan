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
import { CalendarOff, Plus, Clock, CheckCircle, XCircle, Loader2, Send, AlertTriangle, LogIn, LogOut } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, addDays, differenceInCalendarDays, eachDayOfInterval } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  userId?: string;
  tenantId?: string | null;
}

type RequestType = 'full_day' | 'late_arrival' | 'early_leave';

export function EmployeeLeaveRequests({ userId, tenantId }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>('full_day');
  const [dateFrom, setDateFrom] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [timeMinutes, setTimeMinutes] = useState<number>(15);
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

  const leaveDays = dateTo >= dateFrom
    ? differenceInCalendarDays(parseISO(dateTo), parseISO(dateFrom)) + 1
    : 0;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error('Vui lòng nhập lý do xin nghỉ');
      if (!dateFrom) throw new Error('Vui lòng chọn ngày');
      // For late/early: only single day
      const effectiveTo = requestType === 'full_day' ? dateTo : dateFrom;
      if (requestType === 'full_day' && effectiveTo < dateFrom) throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
      if (requestType !== 'full_day' && (!timeMinutes || timeMinutes <= 0)) throw new Error('Vui lòng nhập số phút hợp lệ');
      const { error } = await supabase.from('leave_requests').insert({
        tenant_id: tenantId!,
        user_id: userId!,
        leave_date_from: dateFrom,
        leave_date_to: effectiveTo,
        reason: reason.trim(),
        request_type: requestType,
        time_minutes: requestType === 'full_day' ? null : timeMinutes,
      } as any);
      if (error) {
        if (error.code === '23505') throw new Error('Bạn đã gửi đơn xin nghỉ trùng ngày rồi');
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      const label = requestType === 'late_arrival' ? `Đã gửi đơn xin đi muộn ${timeMinutes} phút` :
                    requestType === 'early_leave' ? `Đã gửi đơn xin về sớm ${timeMinutes} phút` :
                    `Đã gửi đơn xin nghỉ ${leaveDays} ngày`;
      toast.success(label);
      setShowForm(false);
      setReason('');
      setRequestType('full_day');
      setTimeMinutes(15);
      setDateFrom(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
      setDateTo(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidLeaveDays = (salaryConfig?.salary_templates as any)?.paid_leave_days_per_month || 0;

  const now = new Date();
  const thisMonthApprovedDays = (requests || []).reduce((sum, r) => {
    if (r.status !== 'approved') return sum;
    const days = eachDayOfInterval({ start: parseISO(r.leave_date_from), end: parseISO(r.leave_date_to) });
    return sum + days.filter(d => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()).length;
  }, 0);

  const remainingPaidLeave = Math.max(0, paidLeaveDays - thisMonthApprovedDays);

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Có phép</Badge>;
    if (status === 'unexcused') return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Không phép</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Từ chối</Badge>;
    return <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]"><Clock className="h-3 w-3 mr-1" />Chờ duyệt</Badge>;
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

  return (
    <div className="space-y-3">
      {paidLeaveDays > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Nghỉ có lương tháng này</p>
              <p className="text-sm font-semibold">
                Đã dùng: <span className="text-primary">{thisMonthApprovedDays}/{paidLeaveDays}</span> ngày
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
          <CalendarOff className="h-4 w-4" /> Đơn xin nghỉ / muộn / về sớm
        </h3>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Tạo đơn
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" /> Tạo đơn xin phép
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Loại đơn <span className="text-destructive">*</span></Label>
              <Select value={requestType} onValueChange={(v: RequestType) => setRequestType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_day">📅 Xin nghỉ cả ngày</SelectItem>
                  <SelectItem value="late_arrival">🕘 Xin đi muộn</SelectItem>
                  <SelectItem value="early_leave">🚪 Xin về sớm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{requestType === 'full_day' ? 'Từ ngày' : 'Ngày'} <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => {
                    setDateFrom(e.target.value);
                    if (e.target.value > dateTo) setDateTo(e.target.value);
                  }}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              {requestType === 'full_day' ? (
                <div>
                  <Label>Đến ngày <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    min={dateFrom}
                  />
                </div>
              ) : (
                <div>
                  <Label>Số phút <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    min={1}
                    max={480}
                    value={timeMinutes}
                    onChange={e => setTimeMinutes(parseInt(e.target.value) || 0)}
                    placeholder="vd: 15"
                  />
                </div>
              )}
            </div>
            {requestType === 'full_day' && leaveDays > 1 && (
              <p className="text-xs text-muted-foreground text-center">
                📅 Tổng: <strong>{leaveDays}</strong> ngày nghỉ
              </p>
            )}
            {requestType !== 'full_day' && timeMinutes > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {requestType === 'late_arrival'
                  ? `🕘 Sẽ đến muộn ${timeMinutes} phút so với giờ vào ca.`
                  : `🚪 Sẽ về sớm ${timeMinutes} phút so với giờ kết thúc ca.`}
              </p>
            )}
            <div>
              <Label>Lý do <span className="text-destructive">*</span></Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Nhập lý do..."
                rows={3}
              />
            </div>
            {requestType === 'full_day' && paidLeaveDays > 0 && (
              <p className="text-xs text-muted-foreground">
                💡 Bạn còn <strong>{remainingPaidLeave}</strong> ngày nghỉ có lương tháng này.
                {remainingPaidLeave <= 0 && ' Nghỉ thêm sẽ bị trừ lương ngày công.'}
              </p>
            )}
            <div className="bg-muted/50 p-2 rounded text-[11px] text-muted-foreground">
              ℹ️ Đơn được admin <strong>duyệt</strong> sẽ <strong>không bị tính phạt</strong>.
              Nếu không duyệt (hoặc không gửi đơn), hệ thống sẽ tính phạt theo quy định công ty.
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !reason.trim() || !dateFrom || (requestType === 'full_day' ? leaveDays < 1 : timeMinutes <= 0)}
              className="w-full gap-1"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi đơn {requestType === 'full_day' && leaveDays > 1 ? `(${leaveDays} ngày)` : requestType !== 'full_day' && timeMinutes > 0 ? `(${timeMinutes} phút)` : ''}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="w-full">Hủy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {requestTypeBadge(req)}
                      <span className="text-sm font-medium">
                        {formatDateRange(req.leave_date_from, req.leave_date_to)}
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
