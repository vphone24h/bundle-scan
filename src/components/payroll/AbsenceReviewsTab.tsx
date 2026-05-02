import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, CheckCircle, XCircle, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlatformUser, useCurrentTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

function useTenantId() {
  const { data: pu } = usePlatformUser();
  const { data: ct } = useCurrentTenant();
  return ct?.id || pu?.tenant_id;
}

interface AbsentDay {
  user_id: string;
  user_name: string;
  date: string;
  review?: any;
}

export function AbsenceReviewsTab() {
  const tenantId = useTenantId();
  const { data: pu } = usePlatformUser();
  const qc = useQueryClient();

  const now = new Date();
  const [monthStr, setMonthStr] = useState(format(now, 'yyyy-MM'));
  const monthStart = format(startOfMonth(parseISO(monthStr + '-01')), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(parseISO(monthStr + '-01')), 'yyyy-MM-dd');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [reviewDialog, setReviewDialog] = useState<AbsentDay | null>(null);
  const [isExcused, setIsExcused] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('absence-review');
  const [showPwd, setShowPwd] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ userId: string; date: string; excused: boolean; note: string } | null>(null);

  // Fetch attendance records with absent status in the month
  const { data: absentRecords, isLoading: loadingAbsent } = useQuery({
    queryKey: ['absent-records', tenantId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, date, status')
        .eq('tenant_id', tenantId!)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .eq('status', 'absent');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch scheduled days to find days where employee should work but has no record
  const { data: shiftAssignments } = useQuery({
    queryKey: ['shift-assignments-month', tenantId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('user_id, assignment_type, day_of_week, specific_date')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch all attendance records in the month (to find missing days)
  const { data: allAttendance } = useQuery({
    queryKey: ['all-attendance-month', tenantId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, date')
        .eq('tenant_id', tenantId!)
        .gte('date', monthStart)
        .lte('date', monthEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch platform users for names
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

  // Fetch existing reviews
  const { data: reviews } = useQuery({
    queryKey: ['absence-reviews', tenantId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('absence_reviews')
        .select('*')
        .eq('tenant_id', tenantId!)
        .gte('absence_date', monthStart)
        .lte('absence_date', monthEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Save review mutation
  const saveReview = useMutation({
    mutationFn: async ({ userId, date, excused, note }: { userId: string; date: string; excused: boolean; note: string }) => {
      const { error } = await supabase
        .from('absence_reviews')
        .upsert({
          tenant_id: tenantId!,
          user_id: userId,
          absence_date: date,
          is_excused: excused,
          review_note: note || null,
          reviewed_by: pu?.user_id,
          reviewed_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,user_id,absence_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absence-reviews'] });
      toast.success('Đã cập nhật trạng thái nghỉ');
      setReviewDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const guardedSave = (payload: { userId: string; date: string; excused: boolean; note: string }) => {
    if (hasSecurityPassword && !unlocked) {
      setPendingAction(payload);
      setShowPwd(true);
      return;
    }
    saveReview.mutate(payload);
  };

  // Build absent days list
  const absentDays = useMemo(() => {
    if (!platformUsers || !shiftAssignments || !allAttendance) return [];
    
    const userMap = new Map(platformUsers.map(u => [u.user_id, u.display_name || u.email || u.user_id.slice(0, 8)]));
    const reviewMap = new Map((reviews || []).map((r: any) => [`${r.user_id}_${r.absence_date}`, r]));
    const attendanceSet = new Set((allAttendance || []).map(a => `${a.user_id}_${a.date}`));
    
    const result: AbsentDay[] = [];
    
    // 1. Days marked as absent in attendance
    for (const rec of (absentRecords || [])) {
      const key = `${rec.user_id}_${rec.date}`;
      result.push({
        user_id: rec.user_id,
        user_name: userMap.get(rec.user_id) || rec.user_id.slice(0, 8),
        date: rec.date,
        review: reviewMap.get(key),
      });
    }

    // 2. Scheduled days with no attendance record at all
    const start = new Date(monthStart);
    const end = new Date(monthEnd);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (const user of platformUsers) {
      const userAssignments = shiftAssignments.filter(sa => sa.user_id === user.user_id);
      if (!userAssignments.length) continue;

      for (let d = new Date(start); d <= end && d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dow = d.getDay();
        
        const isScheduled = userAssignments.some(sa => 
          (sa.assignment_type === 'fixed' && sa.day_of_week === dow) ||
          sa.specific_date === dateStr
        );

        if (!isScheduled) continue;
        
        const attendKey = `${user.user_id}_${dateStr}`;
        if (attendanceSet.has(attendKey)) continue;

        // No attendance record for a scheduled day → absent
        const key = `${user.user_id}_${dateStr}`;
        if (!result.some(r => r.user_id === user.user_id && r.date === dateStr)) {
          result.push({
            user_id: user.user_id,
            user_name: userMap.get(user.user_id) || user.user_id.slice(0, 8),
            date: dateStr,
            review: reviewMap.get(key),
          });
        }
      }
    }

    return result.sort((a, b) => b.date.localeCompare(a.date) || a.user_name.localeCompare(b.user_name));
  }, [absentRecords, shiftAssignments, allAttendance, platformUsers, reviews, monthStart, monthEnd]);

  // Filter
  const filteredDays = useMemo(() => {
    let items = absentDays;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(d => d.user_name.toLowerCase().includes(q));
    }
    if (filterType === 'unreviewed') items = items.filter(d => !d.review);
    if (filterType === 'excused') items = items.filter(d => d.review?.is_excused === true);
    if (filterType === 'unexcused') items = items.filter(d => d.review?.is_excused === false);
    return items;
  }, [absentDays, searchQuery, filterType]);

  const stats = useMemo(() => {
    const total = absentDays.length;
    const reviewed = absentDays.filter(d => d.review).length;
    const excused = absentDays.filter(d => d.review?.is_excused === true).length;
    const unexcused = absentDays.filter(d => d.review?.is_excused === false).length;
    const unreviewed = total - reviewed;
    return { total, reviewed, excused, unexcused, unreviewed };
  }, [absentDays]);

  const openReview = (day: AbsentDay) => {
    setReviewDialog(day);
    setIsExcused(day.review?.is_excused ?? true);
    setReviewNote(day.review?.review_note || '');
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterType('all')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Tổng ngày nghỉ</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterType('unreviewed')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.unreviewed}</div>
            <div className="text-xs text-muted-foreground">Chưa duyệt</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterType('excused')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.excused}</div>
            <div className="text-xs text-muted-foreground">Có phép</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterType('unexcused')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{stats.unexcused}</div>
            <div className="text-xs text-muted-foreground">Không phép</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <Label className="text-xs">Tháng</Label>
          <Input type="month" value={monthStr} onChange={e => setMonthStr(e.target.value)} className="w-40" />
        </div>
        <div className="flex-1 min-w-[150px]">
          <Label className="text-xs">Tìm NV</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tên nhân viên..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
          </div>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="unreviewed">Chưa duyệt</SelectItem>
            <SelectItem value="excused">Có phép</SelectItem>
            <SelectItem value="unexcused">Không phép</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loadingAbsent ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filteredDays.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Không có ngày nghỉ nào trong tháng này</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Ngày nghỉ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDays.map((day, i) => (
                  <TableRow key={`${day.user_id}_${day.date}_${i}`}>
                    <TableCell className="font-medium text-sm">{day.user_name}</TableCell>
                    <TableCell className="text-sm">{format(parseISO(day.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {!day.review ? (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Chưa duyệt
                        </Badge>
                      ) : day.review.is_excused ? (
                        <Badge variant="secondary" className="text-green-700 bg-green-100">
                          <CheckCircle className="h-3 w-3 mr-1" /> Có phép
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" /> Không phép
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {day.review?.review_note || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openReview(day)}>
                        Duyệt
                      </Button>
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
            <DialogTitle>Duyệt ngày nghỉ</DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nhân viên</Label>
                  <div className="font-medium">{reviewDialog.user_name}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ngày nghỉ</Label>
                  <div className="font-medium flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(parseISO(reviewDialog.date), 'dd/MM/yyyy')}
                  </div>
                </div>
              </div>

              <div>
                <Label>Phân loại</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button
                    variant={isExcused ? 'default' : 'outline'}
                    className={isExcused ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => setIsExcused(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Có phép
                  </Button>
                  <Button
                    variant={!isExcused ? 'destructive' : 'outline'}
                    onClick={() => setIsExcused(false)}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Không phép
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {isExcused
                    ? '💡 Có phép: Không trừ lương ngày này'
                    : '⚠️ Không phép: Sẽ trừ 1 ngày lương (lương cơ bản / ngày công chuẩn)'}
                </p>
              </div>

              <div>
                <Label>Ghi chú</Label>
                <Textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Lý do nghỉ, ghi chú..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Hủy</Button>
            <Button
              onClick={() => reviewDialog && guardedSave({
                userId: reviewDialog.user_id,
                date: reviewDialog.date,
                excused: isExcused,
                note: reviewNote,
              })}
              disabled={saveReview.isPending}
            >
              {saveReview.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Lưu
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
            saveReview.mutate(pendingAction);
            setPendingAction(null);
          }
        }}
        title="Xác thực duyệt nghỉ"
        description="Nhập mật khẩu bảo mật để duyệt trạng thái nghỉ"
      />
    </div>
  );
}
