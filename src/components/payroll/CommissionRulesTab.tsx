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
import { useCommissionRules, useCreateCommissionRule } from '@/hooks/usePayroll';
import { usePlatformUser } from '@/hooks/useTenant';
import { formatNumber } from '@/lib/formatNumber';

const RULE_TYPES = [
  { value: 'product', label: 'Theo sản phẩm' },
  { value: 'category', label: 'Theo danh mục' },
  { value: 'revenue', label: 'Theo doanh thu' },
];

const COMMISSION_TYPES = [
  { value: 'percentage', label: '%' },
  { value: 'fixed', label: 'Cố định (VNĐ)' },
];

export function CommissionRulesTab() {
  const { data: rules, isLoading } = useCommissionRules();
  const createRule = useCreateCommissionRule();
  const { data: pu } = usePlatformUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState('revenue');
  const [commissionType, setCommissionType] = useState('percentage');
  const [commissionValue, setCommissionValue] = useState('');
  const [priority, setPriority] = useState('0');

  const handleCreate = () => {
    if (!name || !commissionValue || !pu?.tenant_id) return;
    createRule.mutate({
      tenant_id: pu.tenant_id,
      name,
      rule_type: ruleType,
      commission_type: commissionType,
      commission_value: Number(commissionValue),
      priority: Number(priority),
    }, {
      onSuccess: () => { setOpen(false); setName(''); setCommissionValue(''); },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Quy tắc hoa hồng</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Thêm</Button>
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
                    <TableHead>Tên</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Giá trị</TableHead>
                    <TableHead>Ưu tiên</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules?.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell><Badge variant="outline">{RULE_TYPES.find(t => t.value === r.rule_type)?.label}</Badge></TableCell>
                      <TableCell>
                        {r.commission_type === 'percentage' ? `${r.commission_value}%` : `${formatNumber(r.commission_value)}đ`}
                      </TableCell>
                      <TableCell>{r.priority}</TableCell>
                    </TableRow>
                  ))}
                  {rules?.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Chưa có quy tắc hoa hồng</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden space-y-2">
              {rules?.map(r => (
                <div key={r.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{r.name}</p>
                    <Badge variant="outline" className="text-xs">{RULE_TYPES.find(t => t.value === r.rule_type)?.label}</Badge>
                  </div>
                  <p className="text-sm font-semibold">
                    {r.commission_type === 'percentage' ? `${r.commission_value}%` : `${formatNumber(r.commission_value)}đ`}
                  </p>
                </div>
              ))}
              {rules?.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Chưa có quy tắc</p>}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tạo quy tắc hoa hồng</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tên <span className="text-destructive">*</span></Label>
              <Input placeholder="VD: Hoa hồng bán điện thoại" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Loại</Label>
                <Select value={ruleType} onValueChange={setRuleType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Đơn vị</Label>
                <Select value={commissionType} onValueChange={setCommissionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COMMISSION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Giá trị <span className="text-destructive">*</span></Label>
                <Input type="number" placeholder="5" value={commissionValue} onChange={e => setCommissionValue(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ưu tiên</Label>
                <Input type="number" placeholder="0" value={priority} onChange={e => setPriority(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={handleCreate} disabled={createRule.isPending}>
              {createRule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
