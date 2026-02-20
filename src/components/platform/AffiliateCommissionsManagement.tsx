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
import { Loader2, MoreHorizontal, Check, X, Search, Coins } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAffiliateCommissions, useUpdateCommissionStatus } from '@/hooks/useAffiliate';

const statusConfig = {
  pending: { label: 'Chờ duyệt', variant: 'secondary' as const },
  approved: { label: 'Được rút', variant: 'default' as const },
  paid: { label: 'Đã chi', variant: 'outline' as const },
  cancelled: { label: 'Hủy', variant: 'destructive' as const },
};

export function AffiliateCommissionsManagement() {
  const { data: commissions, isLoading } = useAffiliateCommissions();
  const updateStatus = useUpdateCommissionStatus();

  const [search, setSearch] = useState('');
  const [cancelDialog, setCancelDialog] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  const filteredCommissions = commissions?.filter((c) =>
    c.affiliates?.affiliate_code?.toLowerCase().includes(search.toLowerCase()) ||
    c.affiliate_referrals?.referred_email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleApprove = async (id: string) => {
    await updateStatus.mutateAsync({ id, status: 'approved' });
  };

  const handleCancel = async () => {
    if (cancelDialog) {
      await updateStatus.mutateAsync({
        id: cancelDialog.id,
        status: 'cancelled',
        cancel_reason: cancelReason,
      });
      setCancelDialog(null);
      setCancelReason('');
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
              <Coins className="h-5 w-5" />
              Quản lý Hoa hồng
            </CardTitle>
            <CardDescription>
              Theo dõi và duyệt hoa hồng cho affiliate
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
              <TableHead>Ngày</TableHead>
              <TableHead>Affiliate</TableHead>
              <TableHead>Người mua</TableHead>
              <TableHead>Gói</TableHead>
              <TableHead className="text-right">Giá trị đơn</TableHead>
              <TableHead className="text-right">Hoa hồng</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCommissions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Chưa có hoa hồng nào
                </TableCell>
              </TableRow>
            ) : (
              filteredCommissions?.map((commission) => (
                <TableRow key={commission.id}>
                  <TableCell>
                    {format(new Date(commission.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{commission.affiliates?.affiliate_code}</span>
                    <p className="text-sm text-muted-foreground">
                      {commission.affiliates?.tenants?.name}
                    </p>
                  </TableCell>
                  <TableCell>
                    {commission.affiliate_referrals?.tenants?.name || commission.affiliate_referrals?.referred_email || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {commission.subscription_plans?.name || 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    {commission.order_amount.toLocaleString('vi-VN')} VND
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {commission.commission_amount.toLocaleString('vi-VN')} VND
                    <p className="text-xs text-muted-foreground">
                      {commission.commission_type === 'percentage'
                        ? `${commission.commission_rate}%`
                        : 'Cố định'}
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={statusConfig[commission.status].variant}>
                      {statusConfig[commission.status].label}
                    </Badge>
                    {commission.hold_until && commission.status === 'pending' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Treo đến: {format(new Date(commission.hold_until), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {commission.status === 'pending' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleApprove(commission.id)}>
                            <Check className="mr-2 h-4 w-4" />
                            Duyệt
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCancelDialog(commission)}>
                            <X className="mr-2 h-4 w-4" />
                            Hủy
                          </DropdownMenuItem>
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

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy hoa hồng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Bạn có chắc muốn hủy hoa hồng này?
            </p>
            <div className="space-y-2">
              <Label>Lý do hủy</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy hoa hồng..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>
              Đóng
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hủy hoa hồng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
