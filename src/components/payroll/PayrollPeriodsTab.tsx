import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Calculator, Lock, FileSpreadsheet, Eye, ChevronRight } from 'lucide-react';
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
    const ws = XLSX.utils.json_to_sheet(records.map(r => ({
      'Nhân viên': r.user_name || r.user_id,
      'Ngày công': r.total_work_days,
      'Giờ công': r.total_work_hours,
      'Lương chính': r.base_salary,
      'Thưởng': r.total_bonus,
      'Hoa hồng': r.total_commission,
      'Phụ cấp': r.total_allowance,
      'Phạt': (r as any).total_penalty || 0,
      'Tạm ứng': (r as any).advance_deduction || 0,
      'Khấu trừ': r.total_deduction,
      'Thực nhận': r.net_salary,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bảng lương');
    XLSX.writeFile(wb, `BangLuong_${period?.name || 'export'}.xlsx`);
    toast.success('Đã xuất Excel');
  };

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
                {createPeriod.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Tạo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const period = periods?.find(p => p.id === selectedPeriodId);
  const totalNetSalary = records?.reduce((s, r) => s + (r.net_salary || 0), 0) || 0;

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
          {period?.status === 'draft' && (
            <Button size="sm" variant="outline" onClick={() => handleCalculate(selectedPeriodId)} disabled={calculatePayroll.isPending}>
              <Calculator className="h-3.5 w-3.5 mr-1" />Tính lương
            </Button>
          )}
          {period?.status === 'calculated' && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleCalculate(selectedPeriodId)} disabled={calculatePayroll.isPending}>
                <Calculator className="h-3.5 w-3.5 mr-1" />Tính lại
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleLock(selectedPeriodId)} disabled={lockPeriod.isPending}>
                <Lock className="h-3.5 w-3.5 mr-1" />Chốt bảng lương
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={!records?.length}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Tổng chi phí lương:</span>
          <span className="font-bold text-primary text-lg">{formatNumber(totalNetSalary)}đ</span>
        </CardContent>
      </Card>

      {!records?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
          {period?.status === 'draft' ? 'Nhấn "Tính lương" để hệ thống tự động tính.' : 'Không có dữ liệu.'}
        </CardContent></Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nhân viên</TableHead>
                <TableHead className="text-xs text-right">Công</TableHead>
                <TableHead className="text-xs text-right">Lương</TableHead>
                <TableHead className="text-xs text-right">Thưởng</TableHead>
                <TableHead className="text-xs text-right">HH</TableHead>
                <TableHead className="text-xs text-right">PC</TableHead>
                <TableHead className="text-xs text-right">Phạt</TableHead>
                <TableHead className="text-xs text-right font-bold">Nhận</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-medium max-w-[100px] truncate">{r.user_name || r.user_id?.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs text-right">{r.total_work_days}</TableCell>
                  <TableCell className="text-xs text-right">{formatNumber(r.base_salary)}</TableCell>
                  <TableCell className="text-xs text-right">{formatNumber(r.total_bonus || 0)}</TableCell>
                  <TableCell className="text-xs text-right">{formatNumber(r.total_commission || 0)}</TableCell>
                  <TableCell className="text-xs text-right">{formatNumber(r.total_allowance || 0)}</TableCell>
                  <TableCell className="text-xs text-right text-destructive">{formatNumber((r as any).total_penalty || r.total_deduction || 0)}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-primary">{formatNumber(r.net_salary)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDetailRecord(r)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm">Chi tiết lương - {detailRecord?.user_name}</DialogTitle></DialogHeader>
          {detailRecord && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2 border-b pb-2">
                <div><span className="text-muted-foreground">Ngày công:</span> <strong>{detailRecord.total_work_days}</strong></div>
                <div><span className="text-muted-foreground">Giờ công:</span> <strong>{detailRecord.total_work_hours}h</strong></div>
                <div><span className="text-muted-foreground">Đi trễ:</span> <strong>{detailRecord.late_count} lần</strong></div>
                <div><span className="text-muted-foreground">Tăng ca:</span> <strong>{detailRecord.overtime_hours}h</strong></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">+ Lương chính</span><span>{formatNumber(detailRecord.base_salary)}đ</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">+ Thưởng</span><span>{formatNumber(detailRecord.total_bonus || 0)}đ</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">+ Hoa hồng</span><span>{formatNumber(detailRecord.total_commission || 0)}đ</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">+ Phụ cấp</span><span>{formatNumber(detailRecord.total_allowance || 0)}đ</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">+ Ngày lễ</span><span>{formatNumber((detailRecord as any).holiday_bonus || 0)}đ</span></div>
                <div className="flex justify-between text-destructive"><span>- Phạt</span><span>{formatNumber((detailRecord as any).total_penalty || 0)}đ</span></div>
                <div className="flex justify-between text-destructive"><span>- Tạm ứng</span><span>{formatNumber((detailRecord as any).advance_deduction || 0)}đ</span></div>
                <div className="flex justify-between text-destructive"><span>- Khấu trừ khác</span><span>{formatNumber(detailRecord.total_deduction || 0)}đ</span></div>
                <div className="flex justify-between border-t pt-2 font-bold text-base">
                  <span>Thực nhận</span>
                  <span className="text-primary">{formatNumber(detailRecord.net_salary)}đ</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
