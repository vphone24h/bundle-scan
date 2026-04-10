import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Loader2, Calculator, Lock, FileSpreadsheet, Eye, ChevronRight, Clock, AlertTriangle, UserX, Timer } from 'lucide-react';
import { usePayrollPeriods, useCreatePayrollPeriod, useCalculatePayroll, usePayrollRecords, useLockPayrollPeriod } from '@/hooks/usePayroll';
import { usePlatformUser } from '@/hooks/useTenant';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Nháp', variant: 'outline' },
  calculated: { label: 'Đã tính', variant: 'secondary' },
  finalized: { label: 'Đã chốt', variant: 'default' },
};

export function PayrollPeriodsTab() {
  const { data: periods, isLoading } = usePayrollPeriods();
  const createPeriod = useCreatePayrollPeriod();
  const calculatePayroll = useCalculatePayroll();
  const lockPeriod = useLockPayrollPeriod();
  const { data: pu } = usePlatformUser();

  const [createOpen, setCreateOpen] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const { data: records } = usePayrollRecords(selectedPeriodId || undefined);
  const [detailRecord, setDetailRecord] = useState<any>(null);

  const handleCreate = () => {
    if (!periodName || !startDate || !endDate || !pu?.tenant_id) return;
    createPeriod.mutate({
      tenant_id: pu.tenant_id, name: periodName, period_type: 'monthly',
      start_date: startDate, end_date: endDate,
    }, {
      onSuccess: () => { setCreateOpen(false); setPeriodName(''); setStartDate(''); setEndDate(''); },
    });
  };

  const handleCalculate = (periodId: string) => {
    if (!pu?.tenant_id) return;
    calculatePayroll.mutate({ period_id: periodId, tenant_id: pu.tenant_id });
  };

  const handleLock = (periodId: string) => {
    if (!confirm('Chốt bảng lương? Sau khi chốt sẽ không thể chỉnh sửa.')) return;
    lockPeriod.mutate({ periodId, status: 'finalized' });
  };

  const handleExportExcel = () => {
    if (!records?.length) return;
    const period = periods?.find(p => p.id === selectedPeriodId);

    // Sheet 1: Summary
    const summaryData = records.map(r => ({
      'Nhân viên': r.user_name || r.user_id,
      'Công chuẩn': (r as any).expected_work_days || 0,
      'Ngày công': r.total_work_days,
      'Giờ công': r.total_work_hours,
      'Đi trễ': (r as any).late_count || 0,
      'Về sớm': (r as any).early_leave_count || 0,
      'Vắng': (r as any).absent_count || 0,
      'Tăng ca (h)': (r as any).overtime_hours || 0,
      'Lương chính': r.base_salary,
      'Thưởng': r.total_bonus,
      'Hoa hồng': r.total_commission,
      'Phụ cấp': r.total_allowance,
      'Lễ': (r as any).holiday_bonus || 0,
      'Tăng ca': (r as any).overtime_pay || 0,
      'Phạt': (r as any).total_penalty || 0,
      'Tạm ứng': (r as any).advance_deduction || 0,
      'Thực nhận': r.net_salary,
    }));
    const ws1 = XLSX.utils.json_to_sheet(summaryData);

    // Sheet 2: Attendance details
    const attendanceRows: any[] = [];
    for (const r of records) {
      const details = (r as any).attendance_details || [];
      for (const d of details) {
        attendanceRows.push({
          'Nhân viên': r.user_name || r.user_id,
          'Ngày': d.date,
          'Ca': d.shift_name || '-',
          'Giờ vào': d.check_in ? format(new Date(d.check_in), 'HH:mm') : '-',
          'Giờ ra': d.check_out ? format(new Date(d.check_out), 'HH:mm') : '-',
          'Trạng thái': d.status,
          'Trễ (phút)': d.late_minutes,
          'Sớm (phút)': d.early_leave_minutes,
          'Tăng ca (phút)': d.overtime_minutes,
          'Tổng (phút)': d.total_work_minutes,
          'Ghi chú': d.note || '',
        });
      }
    }
    const ws2 = XLSX.utils.json_to_sheet(attendanceRows);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Bảng lương');
    XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết công');
    XLSX.writeFile(wb, `BangLuong_${period?.name || 'export'}.xlsx`);
    toast.success('Đã xuất Excel (2 sheets)');
  };

  // ===== Period List =====
  if (!selectedPeriodId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Danh sách kỳ lương</h3>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Tạo kỳ lương
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : periods?.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Chưa có kỳ lương.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {periods?.map(p => (
              <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedPeriodId(p.id)}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{p.name}</span>
                        <Badge variant={STATUS_MAP[p.status]?.variant || 'outline'}>
                          {STATUS_MAP[p.status]?.label || p.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.start_date), 'dd/MM/yyyy')} → {format(new Date(p.end_date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); handleCalculate(p.id); }} disabled={calculatePayroll.isPending}>
                          {calculatePayroll.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
                          <span className="ml-1 text-xs hidden sm:inline">Tính lương</span>
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Tạo kỳ lương</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tên kỳ lương</Label>
                <Input placeholder="VD: Tháng 03/2026" value={periodName} onChange={e => setPeriodName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Từ ngày</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Đến ngày</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
              <Button onClick={handleCreate} disabled={createPeriod.isPending || !periodName || !startDate || !endDate}>
                {createPeriod.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Tạo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ===== Period Detail =====
  const period = periods?.find(p => p.id === selectedPeriodId);
  const totalNetSalary = records?.reduce((s, r) => s + (r.net_salary || 0), 0) || 0;
  const totalLate = records?.reduce((s, r) => s + ((r as any).late_count || 0), 0) || 0;
  const totalAbsent = records?.reduce((s, r) => s + ((r as any).absent_count || 0), 0) || 0;
  const totalOT = records?.reduce((s, r) => s + ((r as any).overtime_hours || 0), 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPeriodId(null)}>← Quay lại</Button>
          <h3 className="font-semibold text-sm">{period?.name}</h3>
          <Badge variant={STATUS_MAP[period?.status || 'draft']?.variant || 'outline'}>
            {STATUS_MAP[period?.status || 'draft']?.label}
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(period?.status === 'draft' || period?.status === 'calculated') && (
            <Button size="sm" variant="outline" onClick={() => handleCalculate(selectedPeriodId)} disabled={calculatePayroll.isPending}>
              <Calculator className="h-3.5 w-3.5 mr-1" />
              {period?.status === 'calculated' ? 'Tính lại' : 'Tính lương'}
            </Button>
          )}
          {period?.status === 'calculated' && (
            <Button size="sm" variant="destructive" onClick={() => handleLock(selectedPeriodId)} disabled={lockPeriod.isPending}>
              <Lock className="h-3.5 w-3.5 mr-1" />Chốt bảng lương
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={!records?.length}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Excel
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground">Tổng chi phí</p>
            <p className="font-bold text-primary text-lg">{formatNumber(totalNetSalary)}đ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />Đi trễ
            </div>
            <p className="font-bold text-orange-600 text-lg">{totalLate}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <UserX className="h-3 w-3" />Vắng
            </div>
            <p className="font-bold text-destructive text-lg">{totalAbsent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />Tăng ca
            </div>
            <p className="font-bold text-blue-600 text-lg">{totalOT}h</p>
          </CardContent>
        </Card>
      </div>

      {/* Records table */}
      {!records?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
          {period?.status === 'draft' ? 'Nhấn "Tính lương" để hệ thống tự động lấy dữ liệu chấm công và tính lương.' : 'Không có dữ liệu.'}
        </CardContent></Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nhân viên</TableHead>
                <TableHead className="text-xs text-center">Công</TableHead>
                <TableHead className="text-xs text-center">Trễ</TableHead>
                <TableHead className="text-xs text-center">Vắng</TableHead>
                <TableHead className="text-xs text-right">Lương</TableHead>
                <TableHead className="text-xs text-right">Thưởng</TableHead>
                <TableHead className="text-xs text-right">HH</TableHead>
                <TableHead className="text-xs text-right">PC</TableHead>
                <TableHead className="text-xs text-right text-destructive">Phạt</TableHead>
                <TableHead className="text-xs text-right font-bold">Nhận</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(r => {
                const rec = r as any;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium max-w-[100px] truncate">{r.user_name || r.user_id?.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs text-center">
                      <span className="font-medium">{r.total_work_days}</span>
                      <span className="text-muted-foreground">/{rec.expected_work_days || '-'}</span>
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {rec.late_count > 0 ? (
                        <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px] px-1.5">
                          {rec.late_count}
                        </Badge>
                      ) : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {rec.absent_count > 0 ? (
                        <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] px-1.5">
                          {rec.absent_count}
                        </Badge>
                      ) : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(r.base_salary)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(r.total_bonus || 0)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(r.total_commission || 0)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(r.total_allowance || 0)}</TableCell>
                    <TableCell className="text-xs text-right text-destructive">{formatNumber(rec.total_penalty || 0)}</TableCell>
                    <TableCell className="text-xs text-right font-bold text-primary">{formatNumber(r.net_salary)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDetailRecord(r)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Chi tiết lương - {detailRecord?.user_name}</DialogTitle>
          </DialogHeader>
          {detailRecord && <PayrollDetailContent record={detailRecord} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayrollDetailContent({ record }: { record: any }) {
  const rec = record as any;
  const attendanceDetails = rec.attendance_details || [];
  const bonusDetails = rec.bonus_details || [];
  const allowanceDetails = rec.allowance_details_v2 || [];
  const penaltyDetails = rec.penalty_details || [];
  const holidayDetails = rec.holiday_details || [];
  const configSnapshot = rec.config_snapshot || {};

  return (
    <Tabs defaultValue="salary" className="flex-1 overflow-hidden flex flex-col">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="salary" className="text-xs">Bảng lương</TabsTrigger>
        <TabsTrigger value="attendance" className="text-xs">Chấm công</TabsTrigger>
        <TabsTrigger value="breakdown" className="text-xs">Chi tiết</TabsTrigger>
      </TabsList>

      <ScrollArea className="flex-1 mt-3">
        <TabsContent value="salary" className="mt-0 space-y-3">
          {/* Attendance summary */}
          <div className="grid grid-cols-4 gap-2 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Ngày công</p>
              <p className="font-bold text-sm">{rec.total_work_days}<span className="text-muted-foreground font-normal">/{rec.expected_work_days || '-'}</span></p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Đi trễ</p>
              <p className="font-bold text-sm text-orange-600">{rec.late_count || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Vắng</p>
              <p className="font-bold text-sm text-destructive">{rec.absent_count || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Tăng ca</p>
              <p className="font-bold text-sm text-blue-600">{rec.overtime_hours || 0}h</p>
            </div>
          </div>

          {/* Config info */}
          {configSnapshot.template_name && (
            <div className="text-xs text-muted-foreground px-1">
              Mẫu lương: <span className="font-medium text-foreground">{configSnapshot.template_name}</span>
              {configSnapshot.salary_type && ` (${configSnapshot.salary_type === 'fixed' ? 'Cố định' : configSnapshot.salary_type === 'hourly' ? 'Theo giờ' : configSnapshot.salary_type === 'daily' ? 'Theo ngày' : 'Theo ca'})`}
            </div>
          )}

          {/* Salary breakdown */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">+ Lương chính</span><span>{formatNumber(rec.base_salary)}đ</span></div>
            {(rec.total_bonus || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ Thưởng</span><span>{formatNumber(rec.total_bonus)}đ</span></div>}
            {(rec.total_commission || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ Hoa hồng</span><span>{formatNumber(rec.total_commission)}đ</span></div>}
            {(rec.total_allowance || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ Phụ cấp</span><span>{formatNumber(rec.total_allowance)}đ</span></div>}
            {(rec.holiday_bonus || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ Ngày lễ</span><span>{formatNumber(rec.holiday_bonus)}đ</span></div>}
            {(rec.overtime_pay || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ Tăng ca</span><span className="text-blue-600">{formatNumber(rec.overtime_pay)}đ</span></div>}
            {(rec.total_penalty || 0) > 0 && <div className="flex justify-between text-destructive"><span>- Phạt</span><span>{formatNumber(rec.total_penalty)}đ</span></div>}
            {(rec.advance_deduction || 0) > 0 && <div className="flex justify-between text-destructive"><span>- Tạm ứng</span><span>{formatNumber(rec.advance_deduction)}đ</span></div>}
            {(rec.total_deduction || 0) > 0 && <div className="flex justify-between text-destructive"><span>- Khấu trừ</span><span>{formatNumber(rec.total_deduction)}đ</span></div>}
            <div className="flex justify-between border-t pt-2 font-bold text-base">
              <span>Thực nhận</span>
              <span className="text-primary">{formatNumber(rec.net_salary)}đ</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-0">
          {attendanceDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Không có dữ liệu chấm công.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Ngày</TableHead>
                    <TableHead className="text-[10px]">Ca</TableHead>
                    <TableHead className="text-[10px]">Vào</TableHead>
                    <TableHead className="text-[10px]">Ra</TableHead>
                    <TableHead className="text-[10px]">TT</TableHead>
                    <TableHead className="text-[10px] text-right">Phút</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceDetails.map((d: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-[10px]">{d.date ? format(new Date(d.date), 'dd/MM') : '-'}</TableCell>
                      <TableCell className="text-[10px] max-w-[60px] truncate">{d.shift_name || '-'}</TableCell>
                      <TableCell className="text-[10px]">{d.check_in ? format(new Date(d.check_in), 'HH:mm') : '-'}</TableCell>
                      <TableCell className="text-[10px]">{d.check_out ? format(new Date(d.check_out), 'HH:mm') : '-'}</TableCell>
                      <TableCell className="text-[10px]">
                        <AttendanceStatusBadge status={d.status} lateMinutes={d.late_minutes} />
                      </TableCell>
                      <TableCell className="text-[10px] text-right">{d.total_work_minutes || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="breakdown" className="mt-0 space-y-3">
          {/* Bonus details */}
          {bonusDetails.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1">Thưởng</p>
              {bonusDetails.map((b: any, i: number) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span className="text-muted-foreground">{b.name} ({b.type})</span>
                  <span>+{formatNumber(b.amount)}đ</span>
                </div>
              ))}
            </div>
          )}

          {/* Allowance details */}
          {allowanceDetails.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1">Phụ cấp</p>
              {allowanceDetails.map((a: any, i: number) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span>+{formatNumber(a.amount)}đ</span>
                </div>
              ))}
            </div>
          )}

          {/* Holiday details */}
          {holidayDetails.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1">Ngày lễ</p>
              {holidayDetails.map((h: any, i: number) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span className="text-muted-foreground">{h.holiday} ({h.multiplier}%, {h.days} ngày)</span>
                  <span>+{formatNumber(h.extra)}đ</span>
                </div>
              ))}
            </div>
          )}

          {/* Penalty details */}
          {penaltyDetails.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1 text-destructive">Phạt</p>
              {penaltyDetails.map((p: any, i: number) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span className="text-muted-foreground">{p.name} (×{p.count})</span>
                  <span className="text-destructive">-{formatNumber(p.amount)}đ</span>
                </div>
              ))}
            </div>
          )}

          {bonusDetails.length === 0 && allowanceDetails.length === 0 && holidayDetails.length === 0 && penaltyDetails.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Không có chi tiết bổ sung.</p>
          )}
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );
}

function AttendanceStatusBadge({ status, lateMinutes }: { status: string; lateMinutes: number }) {
  if (status === 'absent') return <Badge variant="destructive" className="text-[9px] px-1 py-0">Vắng</Badge>;
  if (status === 'late') return (
    <Badge variant="outline" className="text-orange-600 border-orange-300 text-[9px] px-1 py-0">
      Trễ {lateMinutes > 0 ? `${lateMinutes}'` : ''}
    </Badge>
  );
  if (status === 'on_time') return <Badge variant="outline" className="text-green-600 border-green-300 text-[9px] px-1 py-0">OK</Badge>;
  if (status === 'pending') return <Badge variant="outline" className="text-[9px] px-1 py-0">Pending</Badge>;
  return <Badge variant="outline" className="text-[9px] px-1 py-0">{status}</Badge>;
}
