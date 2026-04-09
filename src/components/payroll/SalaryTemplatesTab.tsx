import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2 } from 'lucide-react';
import { useSalaryTemplates, useCreateSalaryTemplate } from '@/hooks/usePayroll';
import { usePlatformUser } from '@/hooks/useTenant';
import { formatNumber } from '@/lib/formatNumber';

const SALARY_TYPES = [
  { value: 'fixed', label: 'Cố định' },
  { value: 'hourly', label: 'Theo giờ' },
  { value: 'daily', label: 'Theo ngày' },
  { value: 'shift', label: 'Theo ca' },
];

export function SalaryTemplatesTab() {
  const { data: templates, isLoading } = useSalaryTemplates();
  const createTemplate = useCreateSalaryTemplate();
  const { data: pu } = usePlatformUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [salaryType, setSalaryType] = useState('fixed');
  const [baseAmount, setBaseAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name || !baseAmount || !pu?.tenant_id) return;
    createTemplate.mutate({
      tenant_id: pu.tenant_id,
      name,
      salary_type: salaryType,
      base_amount: Number(baseAmount),
      description: description || undefined,
    }, {
      onSuccess: () => { setOpen(false); setName(''); setBaseAmount(''); setDescription(''); },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Mẫu lương</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Thêm mẫu</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên mẫu</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Mức cơ bản</TableHead>
                    <TableHead>Mô tả</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates?.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><Badge variant="outline">{SALARY_TYPES.find(s => s.value === t.salary_type)?.label || t.salary_type}</Badge></TableCell>
                      <TableCell className="text-right">{formatNumber(t.base_amount)}đ</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{t.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {templates?.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Chưa có mẫu lương</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {templates?.map(t => (
                <div key={t.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{t.name}</p>
                    <Badge variant="outline" className="text-xs">{SALARY_TYPES.find(s => s.value === t.salary_type)?.label}</Badge>
                  </div>
                  <p className="text-sm font-semibold">{formatNumber(t.base_amount)}đ</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
              ))}
              {templates?.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Chưa có mẫu lương</p>}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tạo mẫu lương</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tên mẫu <span className="text-destructive">*</span></Label>
              <Input placeholder="VD: Lương nhân viên bán hàng" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Loại lương</Label>
              <Select value={salaryType} onValueChange={setSalaryType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SALARY_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mức cơ bản (VNĐ) <span className="text-destructive">*</span></Label>
              <Input type="number" placeholder="5000000" value={baseAmount} onChange={e => setBaseAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mô tả</Label>
              <Input placeholder="Ghi chú thêm" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={handleCreate} disabled={createTemplate.isPending}>
              {createTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
