import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Calculator, Lock, FileSpreadsheet, ChevronRight, Search, Users, DollarSign, Gift, AlertTriangle, Download, ArrowUpDown, ChevronLeft, ChevronRight as ChevronRightIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { usePayrollPeriods, useCreatePayrollPeriod, useCalculatePayroll, usePayrollRecords, useLockPayrollPeriod } from '@/hooks/usePayroll';
import { usePlatformUser } from '@/hooks/useTenant';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Nháp', variant: 'outline' },
  confirmed: { label: 'Đã tính', variant: 'secondary' },
  paid: { label: 'Đã chốt', variant: 'default' },
  cancelled: { label: 'Đã hủy', variant: 'destructive' },
};

const PAGE_SIZE = 20;

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
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [currentPage, setCurrentPage] = useState(1);

  const handleCreate = () => {
    if (!periodName || !startDate || !endDate || !pu?.tenant_id) return;
    createPeriod.mutate({
      tenant_id: pu.tenant_id, name: periodName, period_type: 'monthly',
      start_date: startDate, end_date: endDate,
    }, {
      onSuccess: () => { setCreateOpen(false); setPeriodName(''); setStartDate(''); setEndDate(''); },
    });
  };

  const handleCalculate = (periodId: string, navigateAfter = false) => {
    if (!pu?.tenant_id) return;
    calculatePayroll.mutate({ period_id: periodId, tenant_id: pu.tenant_id }, {
      onSuccess: () => {
        if (navigateAfter) {
          setSelectedPeriodId(periodId);
          setCurrentPage(1);
          setSearchQuery('');
        }
      },
    });
  };

  const handleLock = (periodId: string, status: 'paid' = 'paid') => {
    if (!confirm('Chốt bảng lương? Sau khi chốt sẽ không thể chỉnh sửa.')) return;
    lockPeriod.mutate({ periodId, status });
  };

  // Filtered & sorted records
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    let result = [...records];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => (r.user_name || '').toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'salary_desc': return (b.net_salary || 0) - (a.net_salary || 0);
        case 'salary_asc': return (a.net_salary || 0) - (b.net_salary || 0);
        case 'work_days': return (b.total_work_days || 0) - (a.total_work_days || 0);
        default: return (a.user_name || '').localeCompare(b.user_name || '');
      }
    });
    return result;
  }, [records, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Summary stats
  const summary = useMemo(() => {
    if (!records) return { count: 0, totalNet: 0, totalBonus: 0, totalPenalty: 0, totalCommission: 0, totalAllowance: 0 };
    return {
      count: records.length,
      totalNet: records.reduce((s, r) => s + (r.net_salary || 0), 0),
      totalBonus: records.reduce((s, r) => s + (r.total_bonus || 0), 0),
      totalPenalty: records.reduce((s, r) => s + ((r as any).total_penalty || 0), 0),
      totalCommission: records.reduce((s, r) => s + (r.total_commission || 0), 0),
      totalAllowance: records.reduce((s, r) => s + (r.total_allowance || 0), 0),
    };
  }, [records]);

  // Export all employees
  const handleExportAll = () => {
    if (!records?.length) return;
    const period = periods?.find(p => p.id === selectedPeriodId);

    // Sheet 1: Summary
    const ws1Data = records.map(r => {
      const rec = r as any;
      return {
        'Nhân viên': r.user_name || r.user_id,
        'Công chuẩn': rec.expected_work_days || 0,
        'Ngày công': r.total_work_days,
        'Giờ công': r.total_work_hours,
        'Đi trễ': rec.late_count || 0,
        'Về sớm': rec.early_leave_count || 0,
        'Vắng': rec.absent_count || 0,
        'Tăng ca (h)': rec.overtime_hours || 0,
        'Lương chính': r.base_salary,
        'Thưởng': r.total_bonus,
        'Hoa hồng': r.total_commission,
        'Phụ cấp': r.total_allowance,
        'Lễ': rec.holiday_bonus || 0,
        'Tăng ca': rec.overtime_pay || 0,
        'Phạt': rec.total_penalty || 0,
        'Tạm ứng': rec.advance_deduction || 0,
        'Thực nhận': r.net_salary,
      };
    });
    const ws1 = XLSX.utils.json_to_sheet(ws1Data);

    // Sheet 2: Breakdown detail for all employees
    const breakdownRows: any[] = [];
    for (const r of records) {
      const rec = r as any;
      const name = r.user_name || r.user_id;
      const configSnapshot = rec.config_snapshot || {};

      // Base salary
      breakdownRows.push({ 'Nhân viên': name, 'Loại': 'Lương chính', 'Tên': configSnapshot.template_name || 'Lương cơ bản', 'Chi tiết': `${configSnapshot.salary_type === 'hourly' ? 'Theo giờ' : configSnapshot.salary_type === 'daily' ? 'Theo ngày' : configSnapshot.salary_type === 'shift' ? 'Theo ca' : 'Cố định'}`, 'Số tiền': r.base_salary });

      // Bonuses
      for (const b of (rec.bonus_details || [])) {
        breakdownRows.push({ 'Nhân viên': name, 'Loại': 'Thưởng', 'Tên': b.name, 'Chi tiết': b.type || '', 'Số tiền': b.amount });
      }
      // Commissions
      for (const c of (rec.commission_details || [])) {
        breakdownRows.push({ 'Nhân viên': name, 'Loại': 'Hoa hồng', 'Tên': c.name || c.product_name || 'Hoa hồng', 'Chi tiết': c.type || '', 'Số tiền': c.amount });
      }
      // Allowances
      for (const a of (rec.allowance_details_v2 || [])) {
        breakdownRows.push({ 'Nhân viên': name, 'Loại': 'Phụ cấp', 'Tên': a.name, 'Chi tiết': '', 'Số tiền': a.amount });
      }
      // Holidays
      for (const h of (rec.holiday_details || [])) {
        breakdownRows.push({ 'Nhân viên': name, 'Loại': 'Ngày lễ', 'Tên': h.holiday, 'Chi tiết': `${h.multiplier}% x ${h.days} ngày`, 'Số tiền': h.extra });
      }
      // Overtime
      for (const o of (configSnapshot.overtime_details || [])) {
        breakdownRows.push({ 'Nhân viên': name, 'Loại': 'Tăng ca', 'Tên': o.name, 'Chi tiết': o.type === 'full_day' ? `${o.count} ngày` : `${o.hours}h`, 'Số tiền': o.amount });
      }
      // Penalties
      for (const p of (rec.penalty_details || [])) {
        breakdownRows.push({ 'Nhân viên': name, 'Loại': 'Phạt', 'Tên': `${p.name} (×${p.count})`, 'Chi tiết': '', 'Số tiền': -p.amount });
      }
      // Advance
      if ((rec.advance_deduction || 0) > 0) {
        breakdownRows.push({ 'Nhân viên': name, 'Loại': 'Tạm ứng', 'Tên': 'Khấu trừ tạm ứng', 'Chi tiết': '', 'Số tiền': -rec.advance_deduction });
      }
      // Net
      breakdownRows.push({ 'Nhân viên': name, 'Loại': '=== THỰC NHẬN ===', 'Tên': '', 'Chi tiết': '', 'Số tiền': r.net_salary });
    }
    const ws2 = XLSX.utils.json_to_sheet(breakdownRows.length ? breakdownRows : [{ 'Ghi chú': 'Không có dữ liệu' }]);

    // Sheet 3: Attendance
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
        });
      }
    }
    const ws3 = XLSX.utils.json_to_sheet(attendanceRows.length ? attendanceRows : [{ 'Ghi chú': 'Không có dữ liệu' }]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Bảng lương');
    XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết lương');
    XLSX.utils.book_append_sheet(wb, ws3, 'Chi tiết công');
    XLSX.writeFile(wb, `bang_luong_${(period?.name || 'export').replace(/\s/g, '_')}.xlsx`);
    toast.success('Đã xuất Excel toàn bộ nhân viên');
  };

  // Export single employee
  const handleExportSingle = (record: any) => {
    const rec = record as any;
    const period = periods?.find(p => p.id === selectedPeriodId);
    const name = (record.user_name || 'nhan_vien').replace(/\s/g, '_');
    const configSnapshot = rec.config_snapshot || {};

    // Sheet 1: Salary info
    const salarySheet = [
      ['BẢNG LƯƠNG CHI TIẾT'],
      ['Nhân viên', record.user_name],
      ['Kỳ lương', period?.name || ''],
      ['Mẫu lương', configSnapshot.template_name || ''],
      [''],
      ['Khoản mục', 'Chi tiết', 'Giá trị'],
      ['Lương chính', `${configSnapshot.salary_type === 'hourly' ? 'Theo giờ' : configSnapshot.salary_type === 'daily' ? 'Theo ngày' : 'Cố định'}`, record.base_salary || 0],
    ];
    // Bonuses detail
    for (const b of (rec.bonus_details || [])) {
      salarySheet.push(['Thưởng', `${b.name} (${b.type || ''})`, b.amount]);
    }
    // Commission detail
    for (const c of (rec.commission_details || [])) {
      salarySheet.push(['Hoa hồng', c.name || c.product_name || 'Hoa hồng', c.amount]);
    }
    // Allowance detail
    for (const a of (rec.allowance_details_v2 || [])) {
      salarySheet.push(['Phụ cấp', a.name, a.amount]);
    }
    // Holiday detail
    for (const h of (rec.holiday_details || [])) {
      salarySheet.push(['Ngày lễ', `${h.holiday} (${h.multiplier}%, ${h.days} ngày)`, h.extra]);
    }
    // Overtime
    for (const o of (configSnapshot.overtime_details || [])) {
      salarySheet.push(['Tăng ca', `${o.name} ${o.type === 'full_day' ? `(${o.count} ngày)` : `(${o.hours}h)`}`, o.amount]);
    }
    // Penalties detail
    for (const p of (rec.penalty_details || [])) {
      salarySheet.push(['Phạt', `${p.name} (×${p.count})`, -p.amount]);
    }
    if ((rec.advance_deduction || 0) > 0) {
      salarySheet.push(['Tạm ứng', 'Khấu trừ tạm ứng', -rec.advance_deduction]);
    }
    salarySheet.push(['']);
    salarySheet.push(['THỰC NHẬN', '', record.net_salary || 0]);

    const ws1 = XLSX.utils.aoa_to_sheet(salarySheet);
    ws1['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 18 }];

    // Sheet 2: Attendance
    const attendanceDetails = rec.attendance_details || [];
    const attRows: any[][] = [['Ngày', 'Ca', 'Giờ vào', 'Giờ ra', 'Trạng thái', 'Trễ (phút)', 'Tổng (phút)']];
    attendanceDetails.forEach((d: any) => {
      attRows.push([
        d.date, d.shift_name || '-',
        d.check_in ? format(new Date(d.check_in), 'HH:mm') : '-',
        d.check_out ? format(new Date(d.check_out), 'HH:mm') : '-',
        d.status, d.late_minutes || 0, d.total_work_minutes || 0,
      ]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(attRows);
    ws2['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Bảng lương chi tiết');
    XLSX.utils.book_append_sheet(wb, ws2, 'Ngày công');
    XLSX.writeFile(wb, `luong_${name}.xlsx`);
    toast.success(`Đã xuất lương: ${record.user_name}`);
  };

  // ===== Period List =====
  if (!selectedPeriodId) {
    const filteredPeriods = periods?.filter(p => filterStatus === 'all' || p.status === filterStatus) || [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-base">Danh sách kỳ lương</h3>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Tạo kỳ lương
          </Button>
        </div>

        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="draft">Nháp</SelectItem>
              <SelectItem value="confirmed">Đã tính</SelectItem>
              <SelectItem value="paid">Đã chốt</SelectItem>
              <SelectItem value="cancelled">Đã hủy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filteredPeriods.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Chưa có kỳ lương.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {filteredPeriods.map(p => (
              <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setSelectedPeriodId(p.id); setCurrentPage(1); setSearchQuery(''); setExpandedRowId(null); }}>
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
                        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); handleCalculate(p.id, true); }} disabled={calculatePayroll.isPending}>
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

  // ===== Period Detail (Payroll Summary) =====
  const period = periods?.find(p => p.id === selectedPeriodId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPeriodId(null)}>← Quay lại</Button>
          <h3 className="font-semibold text-sm">{period?.name}</h3>
          <Badge variant={STATUS_MAP[period?.status || 'draft']?.variant || 'outline'}>
            {STATUS_MAP[period?.status || 'draft']?.label}
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(period?.status === 'draft' || period?.status === 'confirmed') && (
            <Button size="sm" variant="outline" onClick={() => handleCalculate(selectedPeriodId)} disabled={calculatePayroll.isPending}>
              <Calculator className="h-3.5 w-3.5 mr-1" />
              {period?.status === 'confirmed' ? 'Tính lại' : 'Tính lương'}
            </Button>
          )}
          {period?.status === 'confirmed' && (
            <Button size="sm" variant="destructive" onClick={() => handleLock(selectedPeriodId, 'paid')} disabled={lockPeriod.isPending}>
              <Lock className="h-3.5 w-3.5 mr-1" />Chốt bảng lương
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleExportAll} disabled={!records?.length}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Xuất tất cả
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />Nhân viên</div>
            <p className="font-bold text-lg">{summary.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><DollarSign className="h-3 w-3" />Tổng lương</div>
            <p className="font-bold text-primary text-lg">{formatNumber(summary.totalNet)}đ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Gift className="h-3 w-3" />Thưởng</div>
            <p className="font-bold text-lg" style={{ color: 'hsl(var(--chart-2))' }}>{formatNumber(summary.totalBonus)}đ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">Hoa hồng</div>
            <p className="font-bold text-lg" style={{ color: 'hsl(var(--chart-1))' }}>{formatNumber(summary.totalCommission)}đ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">Phụ cấp</div>
            <p className="font-bold text-lg">{formatNumber(summary.totalAllowance)}đ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="h-3 w-3" />Phạt</div>
            <p className="font-bold text-destructive text-lg">{formatNumber(summary.totalPenalty)}đ</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Tìm nhân viên..."
            className="pl-8 h-8 text-xs"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <Select value={sortBy} onValueChange={v => { setSortBy(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Tên A-Z</SelectItem>
            <SelectItem value="salary_desc">Lương cao → thấp</SelectItem>
            <SelectItem value="salary_asc">Lương thấp → cao</SelectItem>
            <SelectItem value="work_days">Ngày công nhiều nhất</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Records Table with Expandable Rows */}
      {!records?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
          {period?.status === 'draft' ? 'Nhấn "Tính lương" để hệ thống tự động lấy dữ liệu chấm công và tính lương.' : 'Không có dữ liệu.'}
        </CardContent></Card>
      ) : filteredRecords.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Không tìm thấy nhân viên.</CardContent></Card>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-8"></TableHead>
                  <TableHead className="text-xs">Nhân viên</TableHead>
                  <TableHead className="text-xs text-center">Ngày công</TableHead>
                  <TableHead className="text-xs text-center">Giờ công</TableHead>
                  <TableHead className="text-xs text-right">Lương chính</TableHead>
                  <TableHead className="text-xs text-right">Thưởng</TableHead>
                  <TableHead className="text-xs text-right">Hoa hồng</TableHead>
                  <TableHead className="text-xs text-right">Phụ cấp</TableHead>
                  <TableHead className="text-xs text-right text-destructive">Phạt</TableHead>
                  <TableHead className="text-xs text-right font-bold">Thực nhận</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.map(r => {
                  const rec = r as any;
                  const isExpanded = expandedRowId === r.id;
                  return (
                    <>
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                      >
                        <TableCell className="px-2">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[120px] truncate">{r.user_name || r.user_id?.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs text-center">
                          <span className="font-medium">{r.total_work_days}</span>
                          <span className="text-muted-foreground">/{rec.expected_work_days || '-'}</span>
                        </TableCell>
                        <TableCell className="text-xs text-center">{r.total_work_hours || 0}h</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(r.base_salary)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(r.total_bonus || 0)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(r.total_commission || 0)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(r.total_allowance || 0)}</TableCell>
                        <TableCell className="text-xs text-right text-destructive">{formatNumber(rec.total_penalty || 0)}</TableCell>
                        <TableCell className="text-xs text-right font-bold text-primary">{formatNumber(r.net_salary)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); handleExportSingle(r); }}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${r.id}-detail`}>
                          <TableCell colSpan={11} className="p-0 bg-muted/30">
                            <InlinePayrollBreakdown record={r} periodName={period?.name} onExport={() => handleExportSingle(r)} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{filteredRecords.length} nhân viên</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span>Trang {currentPage}/{totalPages}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== Inline Breakdown Component =====
function InlinePayrollBreakdown({ record, periodName, onExport }: { record: any; periodName?: string; onExport: () => void }) {
  const rec = record as any;
  const configSnapshot = rec.config_snapshot || {};
  const bonusDetails = rec.bonus_details || [];
  const commissionDetails = rec.commission_details || [];
  const allowanceDetails = rec.allowance_details_v2 || [];
  const penaltyDetails = rec.penalty_details || [];
  const holidayDetails = rec.holiday_details || [];
  const overtimeDetails = configSnapshot.overtime_details || [];

  return (
    <div className="p-4 space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          {configSnapshot.template_name && (
            <span className="text-muted-foreground">Mẫu lương: <span className="font-medium text-foreground">{configSnapshot.template_name}</span></span>
          )}
          {configSnapshot.user_revenue > 0 && (
            <span className="text-muted-foreground">Doanh thu: <span className="font-medium text-primary">{formatNumber(configSnapshot.user_revenue)}đ</span> ({configSnapshot.sale_count || 0} đơn)</span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={e => { e.stopPropagation(); onExport(); }}>
          <Download className="h-3 w-3 mr-1" />Xuất phiếu lương
        </Button>
      </div>

      {/* Attendance summary */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-background rounded-md p-2 text-center border">
          <p className="text-[10px] text-muted-foreground">Ngày công</p>
          <p className="font-bold text-sm">{rec.total_work_days}<span className="text-muted-foreground font-normal text-xs">/{rec.expected_work_days || '-'}</span></p>
        </div>
        <div className="bg-background rounded-md p-2 text-center border">
          <p className="text-[10px] text-muted-foreground">Giờ công</p>
          <p className="font-bold text-sm">{rec.total_work_hours || 0}h</p>
        </div>
        <div className="bg-background rounded-md p-2 text-center border">
          <p className="text-[10px] text-muted-foreground">Đi trễ</p>
          <p className="font-bold text-sm text-orange-600">{rec.late_count || 0}</p>
        </div>
        <div className="bg-background rounded-md p-2 text-center border">
          <p className="text-[10px] text-muted-foreground">Vắng</p>
          <p className="font-bold text-sm text-destructive">{rec.absent_count || 0}</p>
        </div>
        <div className="bg-background rounded-md p-2 text-center border">
          <p className="text-[10px] text-muted-foreground">Tăng ca</p>
          <p className="font-bold text-sm" style={{ color: 'hsl(var(--chart-1))' }}>{rec.overtime_hours || 0}h</p>
        </div>
      </div>

      {/* Salary breakdown grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Income items */}
        <div className="space-y-3">
          {/* Base salary */}
          <BreakdownSection icon="💰" title="Lương chính" total={rec.base_salary}>
            <BreakdownItem
              label={configSnapshot.salary_type === 'hourly' ? 'Theo giờ' : configSnapshot.salary_type === 'daily' ? 'Theo ngày' : configSnapshot.salary_type === 'shift' ? 'Theo ca' : 'Cố định tháng'}
              detail={configSnapshot.base_amount ? `Mức: ${formatNumber(configSnapshot.base_amount)}đ` : ''}
              amount={rec.base_salary}
            />
          </BreakdownSection>

          {/* Bonuses */}
          <BreakdownSection icon="🎁" title="Thưởng" total={rec.total_bonus || 0}>
            {bonusDetails.length > 0 ? bonusDetails.map((b: any, i: number) => (
              <BreakdownItem key={i} label={b.name} detail={b.type || ''} amount={b.amount} positive />
            )) : (
              <p className="text-[11px] text-muted-foreground italic">Không có khoản thưởng</p>
            )}
          </BreakdownSection>

          {/* Commissions */}
          <BreakdownSection icon="📊" title="Hoa hồng" total={rec.total_commission || 0}>
            {commissionDetails.length > 0 ? commissionDetails.map((c: any, i: number) => (
              <BreakdownItem key={i} label={c.name || c.product_name || 'Hoa hồng'} detail={c.type || ''} amount={c.amount} positive />
            )) : (
              <p className="text-[11px] text-muted-foreground italic">Không có hoa hồng</p>
            )}
          </BreakdownSection>

          {/* Allowances */}
          <BreakdownSection icon="📋" title="Phụ cấp" total={rec.total_allowance || 0}>
            {allowanceDetails.length > 0 ? allowanceDetails.map((a: any, i: number) => (
              <BreakdownItem key={i} label={a.name} amount={a.amount} positive />
            )) : (
              <p className="text-[11px] text-muted-foreground italic">Không có phụ cấp</p>
            )}
          </BreakdownSection>
        </div>

        {/* Right: More income + deductions */}
        <div className="space-y-3">
          {/* Holidays */}
          <BreakdownSection icon="🎌" title="Ngày lễ" total={rec.holiday_bonus || 0}>
            {holidayDetails.length > 0 ? holidayDetails.map((h: any, i: number) => (
              <BreakdownItem key={i} label={h.holiday} detail={`${h.multiplier}% × ${h.days} ngày`} amount={h.extra} positive />
            )) : (
              <p className="text-[11px] text-muted-foreground italic">Không có ngày lễ</p>
            )}
          </BreakdownSection>

          {/* Overtime */}
          <BreakdownSection icon="⏰" title="Tăng ca" total={rec.overtime_pay || 0}>
            {overtimeDetails.length > 0 ? overtimeDetails.map((o: any, i: number) => (
              <BreakdownItem key={i} label={o.name} detail={o.type === 'full_day' ? `${o.count} ngày` : `${o.hours}h`} amount={o.amount} positive />
            )) : (
              <p className="text-[11px] text-muted-foreground italic">Không có tăng ca</p>
            )}
          </BreakdownSection>

          {/* Penalties */}
          <BreakdownSection icon="⚠️" title="Phạt" total={rec.total_penalty || 0} isDeduction>
            {penaltyDetails.length > 0 ? penaltyDetails.map((p: any, i: number) => (
              <BreakdownItem key={i} label={p.name} detail={`×${p.count} lần`} amount={p.amount} negative />
            )) : (
              <p className="text-[11px] text-muted-foreground italic">Không có khoản phạt</p>
            )}
          </BreakdownSection>

          {/* Advance deduction */}
          <BreakdownSection icon="💳" title="Tạm ứng" total={rec.advance_deduction || 0} isDeduction>
            {(rec.advance_deduction || 0) > 0 ? (
              <BreakdownItem label="Khấu trừ tạm ứng" amount={rec.advance_deduction} negative />
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Không có tạm ứng</p>
            )}
          </BreakdownSection>
        </div>
      </div>

      {/* Net salary total */}
      <div className="flex items-center justify-between bg-primary/5 rounded-lg p-3 border border-primary/20">
        <span className="font-semibold text-sm">💵 THỰC NHẬN</span>
        <span className="font-bold text-lg text-primary">{formatNumber(rec.net_salary)}đ</span>
      </div>

      {/* Missing setup warnings */}
      {rec.missing_setup_reasons && rec.missing_setup_reasons.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
          <p className="text-xs font-medium text-destructive mb-1">⚠️ Thiếu cấu hình:</p>
          {rec.missing_setup_reasons.map((reason: string, i: number) => (
            <p key={i} className="text-xs text-muted-foreground">• {reason}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function BreakdownSection({ icon, title, total, isDeduction, children }: {
  icon: string; title: string; total: number; isDeduction?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bg-background rounded-lg border p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{icon} {title}</span>
        <span className={`text-xs font-bold ${isDeduction ? 'text-destructive' : 'text-primary'}`}>
          {isDeduction ? '-' : '+'}{formatNumber(total || 0)}đ
        </span>
      </div>
      <div className="space-y-1 pl-1">{children}</div>
    </div>
  );
}

function BreakdownItem({ label, detail, amount, positive, negative }: {
  label: string; detail?: string; amount: number; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <div className="flex-1 min-w-0">
        <span className="text-foreground">{label}</span>
        {detail && <span className="text-muted-foreground ml-1">({detail})</span>}
      </div>
      <span className={`font-medium ml-2 whitespace-nowrap ${negative ? 'text-destructive' : positive ? 'text-primary' : ''}`}>
        {negative ? '-' : '+'}{formatNumber(amount || 0)}đ
      </span>
    </div>
  );
}

function AttendanceStatusBadge({ status, lateMinutes }: { status: string; lateMinutes: number }) {
  if (status === 'absent') return <Badge variant="destructive" className="text-[9px] px-1 py-0">Vắng</Badge>;
  if (status === 'late') return (
    <Badge variant="outline" className="text-orange-600 border-orange-300 text-[9px] px-1 py-0">
      Trễ {lateMinutes > 0 ? `${lateMinutes}'` : ''}
    </Badge>
  );
  if (status === 'on_time') return <Badge variant="outline" className="text-[9px] px-1 py-0" style={{ color: 'hsl(var(--chart-2))', borderColor: 'hsl(var(--chart-2) / 0.3)' }}>OK</Badge>;
  if (status === 'pending') return <Badge variant="outline" className="text-[9px] px-1 py-0">Pending</Badge>;
  return <Badge variant="outline" className="text-[9px] px-1 py-0">{status}</Badge>;
}
