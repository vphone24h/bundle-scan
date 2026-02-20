import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MoreHorizontal, Check, X, Search, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAffiliateWithdrawals, useProcessWithdrawal } from '@/hooks/useAffiliate';

const statusConfig = {
  pending: { label: 'Chờ duyệt', variant: 'secondary' as const },
  approved: { label: 'Đã duyệt', variant: 'default' as const },
  paid: { label: 'Đã thanh toán', variant: 'outline' as const },
  rejected: { label: 'Từ chối', variant: 'destructive' as const },
};

export function AffiliateWithdrawalsManagement() {
  const { data: withdrawals, isLoading } = useAffiliateWithdrawals();
  const processWithdrawal = useProcessWithdrawal();

  const [search, setSearch] = useState('');
  const [rejectDialog, setRejectDialog] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const filteredWithdrawals = withdrawals?.filter((w) =>
    w.affiliates?.affiliate_code?.toLowerCase().includes(search.toLowerCase()) ||
    w.bank_account_holder?.toLowerCase().includes(search.toLowerCase())
  );

  const handleApprove = async (id: string) => {
    await processWithdrawal.mutateAsync({ id, status: 'approved' });
  };

  const handlePaid = async (id: string) => {
    await processWithdrawal.mutateAsync({ id, status: 'paid' });
  };

  const handleReject = async () => {
    if (rejectDialog) {
      await processWithdrawal.mutateAsync({
        id: rejectDialog.id,
        status: 'rejected',
        rejected_reason: rejectReason,
      });
      setRejectDialog(null);
      setRejectReason('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Yêu cầu Rút tiền
            </CardTitle>
            <CardDescription>
              Xử lý các yêu cầu rút tiền hoa hồng từ affiliate
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 search-input-highlight"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày yêu cầu</TableHead>
              <TableHead>Affiliate</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead>Ngân hàng</TableHead>
              <TableHead>Chủ tài khoản</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWithdrawals?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Chưa có yêu cầu rút tiền nào
                </TableCell>
              </TableRow>
            ) : (
              filteredWithdrawals?.map((withdrawal) => (
                <TableRow key={withdrawal.id}>
                  <TableCell>
                    {format(new Date(withdrawal.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{withdrawal.affiliates?.affiliate_code}</span>
                    <p className="text-sm text-muted-foreground">
                      {withdrawal.affiliates?.tenants?.name}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {withdrawal.amount.toLocaleString('vi-VN')} VND
                  </TableCell>
                  <TableCell>
                    <p>{withdrawal.bank_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {withdrawal.bank_account_number}
                    </p>
                  </TableCell>
                  <TableCell>{withdrawal.bank_account_holder}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={statusConfig[withdrawal.status].variant}>
                      {statusConfig[withdrawal.status].label}
                    </Badge>
                    {withdrawal.rejected_reason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {withdrawal.rejected_reason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(withdrawal.status === 'pending' || withdrawal.status === 'approved') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {withdrawal.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => handleApprove(withdrawal.id)}>
                                <Check className="mr-2 h-4 w-4" />
                                Duyệt
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRejectDialog(withdrawal)}>
                                <X className="mr-2 h-4 w-4" />
                                Từ chối
                              </DropdownMenuItem>
                            </>
                          )}
                          {withdrawal.status === 'approved' && (
                            <DropdownMenuItem onClick={() => handlePaid(withdrawal.id)}>
                              <Check className="mr-2 h-4 w-4" />
                              Đánh dấu đã thanh toán
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối yêu cầu rút tiền</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Bạn có chắc muốn từ chối yêu cầu rút <strong>{rejectDialog?.amount?.toLocaleString('vi-VN')} VND</strong>?
            </p>
            <div className="space-y-2">
              <Label>Lý do từ chối</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do từ chối..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Đóng
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processWithdrawal.isPending}
            >
              {processWithdrawal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
