import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Ticket, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useCustomerVouchers, useMarkVoucherUsed, CustomerVoucher } from '@/hooks/useVouchers';

export function VoucherHistoryTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('_all_');
  const { data: vouchers, isLoading } = useCustomerVouchers({ search, status: statusFilter });
  const markUsed = useMarkVoucherUsed();

  const handleMarkUsed = async (v: CustomerVoucher) => {
    if (!confirm(`Xác nhận đã sử dụng voucher "${v.code}"?`)) return;
    try {
      await markUsed.mutateAsync(v.id);
      toast.success('Đã cập nhật trạng thái voucher');
    } catch { toast.error('Lỗi cập nhật'); }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, SĐT, mã voucher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all_">Tất cả</SelectItem>
            <SelectItem value="unused">Chưa sử dụng</SelectItem>
            <SelectItem value="used">Đã sử dụng</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Lịch sử voucher ({vouchers?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !vouchers?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chưa có voucher nào được phát</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Mã voucher</TableHead>
                    <TableHead>Giảm giá</TableHead>
                    <TableHead>Nguồn</TableHead>
                    <TableHead>Ngày nhận</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.map(v => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{v.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{v.customer_phone}</p>
                          {v.customer_email && <p className="text-xs text-muted-foreground">{v.customer_email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{v.code}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {v.discount_type === 'percentage' ? `${v.discount_value}%` : `${formatNumber(v.discount_value)}đ`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {v.source === 'website' ? 'Website' : v.source === 'export' ? 'Bán hàng' : 'Thủ công'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(v.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </TableCell>
                      <TableCell>
                        {v.status === 'used' ? (
                          <Badge className="bg-green-100 text-green-700">Đã sử dụng</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">Chưa sử dụng</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {v.status === 'unused' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => handleMarkUsed(v)}
                            disabled={markUsed.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Trao voucher
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
