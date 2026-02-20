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
import { Loader2, MoreHorizontal, Check, X, Search, Users } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAffiliates, useUpdateAffiliateStatus, Affiliate } from '@/hooks/useAffiliate';

const statusConfig = {
  pending: { label: 'Chờ duyệt', variant: 'secondary' as const },
  active: { label: 'Hoạt động', variant: 'default' as const },
  blocked: { label: 'Đã khóa', variant: 'destructive' as const },
};

export function AffiliatesManagement() {
  const { data: affiliates, isLoading } = useAffiliates();
  const updateStatus = useUpdateAffiliateStatus();

  const [search, setSearch] = useState('');
  const [blockDialog, setBlockDialog] = useState<Affiliate | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const filteredAffiliates = affiliates?.filter((a) =>
    a.affiliate_code.toLowerCase().includes(search.toLowerCase()) ||
    a.tenants?.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.tenants?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleApprove = async (id: string) => {
    await updateStatus.mutateAsync({ id, status: 'active' });
  };

  const handleBlock = async () => {
    if (blockDialog) {
      await updateStatus.mutateAsync({
        id: blockDialog.id,
        status: 'blocked',
        blocked_reason: blockReason,
      });
      setBlockDialog(null);
      setBlockReason('');
    }
  };

  const handleUnblock = async (id: string) => {
    await updateStatus.mutateAsync({ id, status: 'active' });
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
              <Users className="h-5 w-5" />
              Danh sách Affiliate
            </CardTitle>
            <CardDescription>
              Quản lý tất cả affiliate trong hệ thống
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
              <TableHead>Mã Affiliate</TableHead>
              <TableHead>Cửa hàng</TableHead>
              <TableHead className="text-center">Lượt click</TableHead>
              <TableHead className="text-center">Giới thiệu</TableHead>
              <TableHead className="text-center">Chuyển đổi</TableHead>
              <TableHead className="text-right">Tổng HH</TableHead>
              <TableHead className="text-right">Số dư</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAffiliates?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Chưa có affiliate nào
                </TableCell>
              </TableRow>
            ) : (
              filteredAffiliates?.map((affiliate) => (
                <TableRow key={affiliate.id}>
                  <TableCell className="font-mono font-medium">
                    {affiliate.affiliate_code}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{affiliate.tenants?.name || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">
                        {affiliate.tenants?.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {affiliate.total_clicks.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-center">
                    {affiliate.total_referrals.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-center">
                    {affiliate.total_conversions.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {affiliate.total_commission_earned.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {affiliate.available_balance.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={statusConfig[affiliate.status].variant}>
                      {statusConfig[affiliate.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {affiliate.status === 'pending' && (
                          <DropdownMenuItem onClick={() => handleApprove(affiliate.id)}>
                            <Check className="mr-2 h-4 w-4" />
                            Duyệt
                          </DropdownMenuItem>
                        )}
                        {affiliate.status === 'blocked' ? (
                          <DropdownMenuItem onClick={() => handleUnblock(affiliate.id)}>
                            <Check className="mr-2 h-4 w-4" />
                            Mở khóa
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setBlockDialog(affiliate)}>
                            <X className="mr-2 h-4 w-4" />
                            Khóa
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Block Dialog */}
      <Dialog open={!!blockDialog} onOpenChange={() => setBlockDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Khóa Affiliate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Bạn có chắc muốn khóa affiliate <strong>{blockDialog?.affiliate_code}</strong>?
            </p>
            <div className="space-y-2">
              <Label>Lý do khóa</Label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Nhập lý do khóa affiliate..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Khóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
