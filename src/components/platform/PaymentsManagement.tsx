import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  usePaymentRequests, 
  useApprovePayment,
  PaymentRequest 
} from '@/hooks/useTenant';
import { 
  Check, 
  X, 
  MoreHorizontal,
  CreditCard,
  Loader2,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Chờ duyệt', variant: 'secondary' },
  approved: { label: 'Đã duyệt', variant: 'default' },
  rejected: { label: 'Từ chối', variant: 'destructive' },
  cancelled: { label: 'Đã hủy', variant: 'outline' },
};

export function PaymentsManagement() {
  const { data: payments, isLoading } = usePaymentRequests();
  const approvePayment = useApprovePayment();
  
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedPayment, setSelectedPayment] = useState<PaymentRequest | null>(null);
  const [actionDialog, setActionDialog] = useState<'approve' | 'reject' | 'view' | null>(null);
  const [rejectedReason, setRejectedReason] = useState('');
  const [bonusDays, setBonusDays] = useState('0');

  const filteredPayments = payments?.filter(p => 
    statusFilter === 'all' || p.status === statusFilter
  );

  const handleApprove = async () => {
    if (!selectedPayment) return;

    try {
      await approvePayment.mutateAsync({
        paymentId: selectedPayment.id,
        action: 'approve',
        bonusDays: parseInt(bonusDays) || 0,
      });

      toast({
        title: 'Thành công',
        description: 'Đã duyệt thanh toán và kích hoạt gói dịch vụ',
      });

      setActionDialog(null);
      setSelectedPayment(null);
      setBonusDays('0');
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!selectedPayment) return;

    try {
      await approvePayment.mutateAsync({
        paymentId: selectedPayment.id,
        action: 'reject',
        rejectedReason,
      });

      toast({
        title: 'Thành công',
        description: 'Đã từ chối yêu cầu thanh toán',
      });

      setActionDialog(null);
      setSelectedPayment(null);
      setRejectedReason('');
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="pending">
            Chờ duyệt ({payments?.filter(p => p.status === 'pending').length || 0})
          </TabsTrigger>
          <TabsTrigger value="approved">Đã duyệt</TabsTrigger>
          <TabsTrigger value="rejected">Từ chối</TabsTrigger>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead>Gói dịch vụ</TableHead>
                <TableHead>Số tiền</TableHead>
                <TableHead>Mã thanh toán</TableHead>
                <TableHead>Ngày yêu cầu</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Không có yêu cầu thanh toán nào
                  </TableCell>
                </TableRow>
              )}
              {filteredPayments?.map((payment) => {
                const status = statusConfig[payment.status];
                
                return (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.tenants?.name}</p>
                        <p className="text-sm text-muted-foreground">{payment.tenants?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{payment.subscription_plans?.name}</TableCell>
                    <TableCell className="font-medium">
                      {formatNumber(payment.amount)}đ
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {payment.payment_code}
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.requested_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedPayment(payment);
                            setActionDialog('view');
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Xem chi tiết
                          </DropdownMenuItem>
                          {payment.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setSelectedPayment(payment);
                                setActionDialog('approve');
                              }}>
                                <Check className="h-4 w-4 mr-2" />
                                Duyệt
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setActionDialog('reject');
                                }}
                                className="text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Từ chối
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredPayments?.map((payment) => {
          const status = statusConfig[payment.status];
          
          return (
            <Card key={payment.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{payment.tenants?.name}</p>
                      <p className="text-sm text-muted-foreground">{payment.subscription_plans?.name}</p>
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Số tiền:</span>
                    <span className="font-medium">{formatNumber(payment.amount)}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mã:</span>
                    <span className="font-mono">{payment.payment_code}</span>
                  </div>
                </div>
                {payment.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedPayment(payment);
                        setActionDialog('approve');
                      }}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Duyệt
                    </Button>
                    <Button 
                      variant="destructive"
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedPayment(payment);
                        setActionDialog('reject');
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Từ chối
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Approve Dialog */}
      <Dialog open={actionDialog === 'approve'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duyệt thanh toán</DialogTitle>
            <DialogDescription>
              {selectedPayment?.tenants?.name} - {selectedPayment?.subscription_plans?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Số tiền:</span>
                <span className="font-bold">{formatNumber(selectedPayment?.amount || 0)}đ</span>
              </div>
              <div className="flex justify-between">
                <span>Mã thanh toán:</span>
                <span className="font-mono">{selectedPayment?.payment_code}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Thêm ngày bonus (tùy chọn)</Label>
              <Input
                type="number"
                value={bonusDays}
                onChange={(e) => setBonusDays(e.target.value)}
                min="0"
                placeholder="0"
              />
              <p className="text-sm text-muted-foreground">
                Tặng thêm ngày sử dụng ngoài gói
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Hủy
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={approvePayment.isPending}
            >
              {approvePayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận duyệt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === 'reject'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối thanh toán</DialogTitle>
            <DialogDescription>
              {selectedPayment?.tenants?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Lý do từ chối</Label>
              <Textarea
                value={rejectedReason}
                onChange={(e) => setRejectedReason(e.target.value)}
                placeholder="Nhập lý do từ chối..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Hủy
            </Button>
            <Button 
              variant="destructive"
              onClick={handleReject}
              disabled={approvePayment.isPending}
            >
              {approvePayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={actionDialog === 'view'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chi tiết thanh toán</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Doanh nghiệp</p>
                <p className="font-medium">{selectedPayment?.tenants?.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gói dịch vụ</p>
                <p className="font-medium">{selectedPayment?.subscription_plans?.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Số tiền</p>
                <p className="font-medium">{formatNumber(selectedPayment?.amount || 0)}đ</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phương thức</p>
                <p className="font-medium">{selectedPayment?.payment_method}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Mã thanh toán</p>
                <p className="font-mono">{selectedPayment?.payment_code}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Trạng thái</p>
                <Badge variant={statusConfig[selectedPayment?.status || 'pending'].variant}>
                  {statusConfig[selectedPayment?.status || 'pending'].label}
                </Badge>
              </div>
              {selectedPayment?.rejected_reason && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Lý do từ chối</p>
                  <p className="text-destructive">{selectedPayment.rejected_reason}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}