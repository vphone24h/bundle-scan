import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Search, CheckCircle2, XCircle, Eye, Clock } from 'lucide-react';
import { usePreorders, useCancelPreorder, useCompletePreorder, usePreorderDetail } from '@/hooks/usePreorders';
import { formatNumber } from '@/lib/formatNumber';
import { PriceInput } from '@/components/ui/price-input';
import { format } from 'date-fns';
import { useCustomers } from '@/hooks/useCustomers';
import { toast } from '@/hooks/use-toast';

type CancelMode = 'full_refund' | 'partial_refund' | 'keep_all';

export default function PreorderHistoryPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: preorders, isLoading } = usePreorders({ status: statusFilter });
  const { data: customers } = useCustomers();

  const customerById = useMemo(() => {
    const m = new Map<string, any>();
    (customers || []).forEach((c: any) => m.set(c.id, c));
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    if (!preorders) return [];
    const q = search.trim().toLowerCase();
    if (!q) return preorders;
    return preorders.filter((p: any) => {
      const cust = p.customer_id ? customerById.get(p.customer_id) : null;
      return (
        (p.code || '').toLowerCase().includes(q) ||
        (cust?.name || '').toLowerCase().includes(q) ||
        (cust?.phone || '').toLowerCase().includes(q)
      );
    });
  }, [preorders, search, customerById]);

  const statusBadge = (s: string) => {
    if (s === 'pending') return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Đang giữ</Badge>;
    if (s === 'completed') return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Đã giao</Badge>;
    if (s === 'cancelled_full_refund') return <Badge variant="destructive">Hủy - Trả 100%</Badge>;
    if (s === 'cancelled_partial_refund') return <Badge variant="destructive">Hủy - Trả 1 phần</Badge>;
    if (s === 'cancelled_keep_all') return <Badge variant="destructive">Hủy - Giữ cọc</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  return (
    <MainLayout>
      <PageHeader title="Lịch sử đặt hàng (Cọc)" description="Quản lý các phiếu khách đã đặt cọc" />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo mã phiếu, tên KH, SĐT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              <TabsTrigger value="pending">Đang giữ</TabsTrigger>
              <TabsTrigger value="completed">Đã giao</TabsTrigger>
              <TabsTrigger value="cancelled_full_refund">Trả 100%</TabsTrigger>
              <TabsTrigger value="cancelled_partial_refund">Trả 1 phần</TabsTrigger>
              <TabsTrigger value="cancelled_keep_all">Giữ cọc</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã phiếu</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Tổng</TableHead>
                  <TableHead>Đã cọc</TableHead>
                  <TableHead>Còn lại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chưa có phiếu cọc nào</TableCell></TableRow>
                ) : filtered.map((p: any) => {
                  const cust = p.customer_id ? customerById.get(p.customer_id) : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(p.preorder_date), 'dd/MM/yy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{cust?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{cust?.phone || ''}</div>
                      </TableCell>
                      <TableCell className="font-medium">{formatNumber(Number(p.total_amount))}đ</TableCell>
                      <TableCell className="text-green-700">{formatNumber(Number(p.deposit_amount))}đ</TableCell>
                      <TableCell className="text-orange-700">{formatNumber(Number(p.remaining_amount))}đ</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setDetailId(p.id)} title="Xem">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {p.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => setCompleteId(p.id)}
                              >
                                Hoàn thành
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setCancelId(p.id)}
                              >
                                Hủy
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {detailId && <PreorderDetailDialog id={detailId} onClose={() => setDetailId(null)} />}

      {/* Complete Dialog */}
      {completeId && (
        <CompletePreorderDialog
          id={completeId}
          onClose={() => setCompleteId(null)}
        />
      )}

      {/* Cancel Dialog */}
      {cancelId && (
        <CancelPreorderDialog
          id={cancelId}
          onClose={() => setCancelId(null)}
        />
      )}
    </MainLayout>
  );
}

// ============= DETAIL DIALOG =============
function PreorderDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = usePreorderDetail(id);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Chi tiết phiếu cọc</DialogTitle></DialogHeader>
        {isLoading ? <div>Đang tải...</div> : data?.receipt ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Mã:</span> <span className="font-mono">{data.receipt.code}</span></div>
              <div><span className="text-muted-foreground">Ngày:</span> {format(new Date(data.receipt.preorder_date), 'dd/MM/yyyy HH:mm')}</div>
              <div><span className="text-muted-foreground">Tổng tiền:</span> <span className="font-semibold">{formatNumber(Number(data.receipt.total_amount))}đ</span></div>
              <div><span className="text-muted-foreground">Đã cọc:</span> <span className="text-green-700 font-semibold">{formatNumber(Number(data.receipt.deposit_amount))}đ</span></div>
              <div><span className="text-muted-foreground">Còn lại:</span> <span className="text-orange-700 font-semibold">{formatNumber(Number(data.receipt.remaining_amount))}đ</span></div>
              <div><span className="text-muted-foreground">Nguồn cọc:</span> {data.receipt.deposit_payment_source || '—'}</div>
            </div>
            {data.receipt.note && (
              <div className="text-sm"><span className="text-muted-foreground">Ghi chú:</span> {data.receipt.note}</div>
            )}
            <div>
              <div className="font-medium mb-2">Sản phẩm:</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>IMEI/SKU</TableHead>
                    <TableHead>SL</TableHead>
                    <TableHead>Giá</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((it: any) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.product_name}</TableCell>
                      <TableCell className="text-xs">{it.imei || it.sku}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell>{formatNumber(Number(it.sale_price))}đ</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data.receipt.cancel_reason && (
              <div className="text-sm bg-destructive/10 p-2 rounded">
                <div className="font-medium">Lý do hủy:</div>
                <div>{data.receipt.cancel_reason}</div>
              </div>
            )}
          </div>
        ) : <div>Không tìm thấy</div>}
      </DialogContent>
    </Dialog>
  );
}

// ============= COMPLETE DIALOG =============
function CompletePreorderDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = usePreorderDetail(id);
  const complete = useCompletePreorder();
  const [paymentSource, setPaymentSource] = useState('cash');
  const [additional, setAdditional] = useState(0);

  if (!data?.receipt) return null;
  const r = data.receipt;
  const remaining = Number(r.remaining_amount) || 0;

  // Khi mở: mặc định additional = remaining
  if (additional === 0 && remaining > 0) {
    setAdditional(remaining);
  }

  const handleComplete = async () => {
    try {
      await complete.mutateAsync({
        preorderId: id,
        additional_payment: additional,
        payment_source: paymentSource,
      });
      onClose();
    } catch {}
  };

  const debtAmount = Math.max(0, remaining - additional);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hoàn thành đơn cọc {r.code}</DialogTitle>
          <DialogDescription>Khách đến lấy hàng - Ghi nhận doanh thu và xuất hàng</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted p-3 rounded space-y-1 text-sm">
            <div className="flex justify-between"><span>Tổng đơn:</span><span className="font-semibold">{formatNumber(Number(r.total_amount))}đ</span></div>
            <div className="flex justify-between text-green-700"><span>Đã cọc:</span><span>-{formatNumber(Number(r.deposit_amount))}đ</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Còn phải trả:</span><span>{formatNumber(remaining)}đ</span></div>
          </div>

          <div>
            <Label>Khách thanh toán thêm</Label>
            <PriceInput value={additional} onChange={setAdditional} />
            {debtAmount > 0 && (
              <p className="text-xs text-orange-600 mt-1">Sẽ ghi công nợ: {formatNumber(debtAmount)}đ</p>
            )}
          </div>

          <div>
            <Label>Nguồn tiền nhận</Label>
            <Select value={paymentSource} onValueChange={setPaymentSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Tiền mặt</SelectItem>
                <SelectItem value="bank">Chuyển khoản</SelectItem>
                <SelectItem value="e_wallet">Ví điện tử</SelectItem>
                <SelectItem value="debt">Ghi vào công nợ (chưa thu tiền)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleComplete} disabled={complete.isPending} className="bg-green-600 hover:bg-green-700">
            {complete.isPending ? 'Đang xử lý...' : 'Xác nhận hoàn thành'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= CANCEL DIALOG =============
function CancelPreorderDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = usePreorderDetail(id);
  const cancel = useCancelPreorder();
  const [mode, setMode] = useState<CancelMode>('full_refund');
  const [keptAmount, setKeptAmount] = useState(0);
  const [refundSource, setRefundSource] = useState('cash');
  const [reason, setReason] = useState('');

  if (!data?.receipt) return null;
  const r = data.receipt;
  const deposit = Number(r.deposit_amount) || 0;

  let refundAmount = 0;
  if (mode === 'full_refund') refundAmount = deposit;
  else if (mode === 'partial_refund') refundAmount = Math.max(0, deposit - keptAmount);
  else refundAmount = 0;

  const handleCancel = async () => {
    if (mode === 'partial_refund' && (keptAmount <= 0 || keptAmount >= deposit)) {
      toast({ title: 'Số tiền giữ lại không hợp lệ', description: `Phải > 0 và < ${formatNumber(deposit)}đ`, variant: 'destructive' });
      return;
    }
    try {
      await cancel.mutateAsync({
        preorderId: id,
        mode,
        kept_amount: mode === 'partial_refund' ? keptAmount : (mode === 'keep_all' ? deposit : 0),
        refund_payment_source: refundAmount > 0 ? refundSource : null,
        reason: reason.trim() || undefined,
      });
      onClose();
    } catch {}
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hủy phiếu cọc {r.code}</DialogTitle>
          <DialogDescription>Số tiền cọc: <span className="font-semibold">{formatNumber(deposit)}đ</span></DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as CancelMode)}>
            <div className="flex items-start space-x-2 p-2 rounded border">
              <RadioGroupItem value="full_refund" id="m1" />
              <Label htmlFor="m1" className="flex-1 cursor-pointer">
                <div className="font-medium">Trả lại 100% cho khách</div>
                <div className="text-xs text-muted-foreground">Trả {formatNumber(deposit)}đ, xóa công nợ</div>
              </Label>
            </div>
            <div className="flex items-start space-x-2 p-2 rounded border">
              <RadioGroupItem value="partial_refund" id="m2" />
              <Label htmlFor="m2" className="flex-1 cursor-pointer">
                <div className="font-medium">Giữ lại 1 phần (phạt cọc)</div>
                <div className="text-xs text-muted-foreground">Cửa hàng giữ 1 phần, trả lại phần còn lại</div>
              </Label>
            </div>
            <div className="flex items-start space-x-2 p-2 rounded border">
              <RadioGroupItem value="keep_all" id="m3" />
              <Label htmlFor="m3" className="flex-1 cursor-pointer">
                <div className="font-medium">Mất luôn cọc</div>
                <div className="text-xs text-muted-foreground">Cửa hàng giữ toàn bộ {formatNumber(deposit)}đ</div>
              </Label>
            </div>
          </RadioGroup>

          {mode === 'partial_refund' && (
            <div>
              <Label>Số tiền cửa hàng giữ lại</Label>
              <PriceInput value={keptAmount} onChange={setKeptAmount} />
              <p className="text-xs text-muted-foreground mt-1">
                Trả lại khách: <span className="font-semibold">{formatNumber(refundAmount)}đ</span>
              </p>
            </div>
          )}

          {refundAmount > 0 && (
            <div>
              <Label>Nguồn tiền hoàn trả</Label>
              <Select value={refundSource} onValueChange={setRefundSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tiền mặt</SelectItem>
                  <SelectItem value="bank">Chuyển khoản</SelectItem>
                  <SelectItem value="e_wallet">Ví điện tử</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Lý do hủy</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ghi rõ lý do (tùy chọn)" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={cancel.isPending}>
            {cancel.isPending ? 'Đang xử lý...' : 'Xác nhận hủy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
