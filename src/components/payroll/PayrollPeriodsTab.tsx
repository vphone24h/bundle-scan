import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Eye } from 'lucide-react';
import { usePayrollPeriods, useCreatePayrollPeriod, usePayrollRecords } from '@/hooks/usePayroll';
import { usePlatformUser } from '@/hooks/useTenant';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Nháp', variant: 'secondary' },
  confirmed: { label: 'Đã chốt', variant: 'default' },
  paid: { label: 'Đã trả', variant: 'outline' },
  cancelled: { label: 'Hủy', variant: 'destructive' },
};

const PERIOD_TYPES = [
  { value: 'weekly', label: 'Tuần' },
  { value: 'biweekly', label: '2 tuần' },
  { value: 'monthly', label: 'Tháng' },
];

export function PayrollPeriodsTab() {
  const { data: periods, isLoading } = usePayrollPeriods();
  const createPeriod = useCreatePayrollPeriod();
  const { data: pu } = usePlatformUser();
  const [open, setOpen] = useState(false);
  const [detailPeriodId, setDetailPeriodId] = useState<string | null>(null);
  const { data: records } = usePayrollRecords(detailPeriodId || undefined);

  const [name, setName] = useState('');
  const [periodType, setPeriodType] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleCreate = () => {
    if (!name || !startDate || !endDate || !pu?.tenant_id) return;
    createPeriod.mutate({
      tenant_id: pu.tenant_id,
      name,
      period_type: periodType,
      start_date: startDate,
      end_date: endDate,
    }, {
      onSuccess: () => { setOpen(false); setName(''); setStartDate(''); setEndDate(''); },
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Kỳ lương</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Tạo kỳ lương</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kỳ lương</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods?.map(p => {
                      const st = STATUS_MAP[p.status] || { label: p.status, variant: 'outline' as const };
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{PERIOD_TYPES.find(t => t.value === p.period_type)?.label}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(p.start_date), 'dd/MM/yyyy', { locale: vi })} - {format(new Date(p.end_date), 'dd/MM/yyyy', { locale: vi })}
                          </TableCell>
                          <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setDetailPeriodId(p.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {periods?.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chưa có kỳ lương</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-2">
                {periods?.map(p => {
                  const st = STATUS_MAP[p.status] || { label: p.status, variant: 'outline' as const };
                  return (
                    <div key={p.id} className="border rounded-lg p-3 space-y-2" onClick={() => setDetailPeriodId(p.id)}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{p.name}</p>
                        <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.start_date), 'dd/MM/yyyy')} - {format(new Date(p.end_date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  );
                })}
                {periods?.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Chưa có kỳ lương</p>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tạo kỳ lương</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tên kỳ lương <span className="text-destructive">*</span></Label>
              <Input placeholder="VD: Lương T6/2026" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Loại</Label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIOD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
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
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={handleCreate} disabled={createPeriod.isPending}>
              {createPeriod.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailPeriodId} onOpenChange={() => setDetailPeriodId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Chi tiết kỳ lương</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {records?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Chưa có dữ liệu lương. Hãy tính lương từ dữ liệu chấm công.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhân viên</TableHead>
                    <TableHead className="text-right">Lương CB</TableHead>
                    <TableHead className="text-right">Hoa hồng</TableHead>
                    <TableHead className="text-right">Thực nhận</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records?.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.user_name || 'N/A'}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.base_salary)}đ</TableCell>
                      <TableCell className="text-right">{formatNumber(r.total_commission)}đ</TableCell>
                      <TableCell className="text-right font-semibold">{formatNumber(r.net_salary)}đ</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
