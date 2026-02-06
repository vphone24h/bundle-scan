import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, ShoppingCart, History, Target, DollarSign, Users, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/mockData';
import { useStaffExportReceipts, useStaffCareLogs, useStaffActivity } from '@/hooks/useStaffDetail';
import type { StaffWithKPI } from '@/hooks/useStaffKPI';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Quản lý',
  branch_admin: 'QL Chi nhánh',
  staff: 'Nhân viên',
  cashier: 'Thu ngân',
};

const ACTION_LABELS: Record<string, string> = {
  call: 'Gọi điện',
  message: 'Nhắn tin',
  email: 'Email',
  visit: 'Thăm trực tiếp',
  note: 'Ghi chú',
};

interface StaffDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffWithKPI | null;
  startDate: string;
  endDate: string;
}

export function StaffDetailDialog({ open, onOpenChange, staff, startDate, endDate }: StaffDetailDialogProps) {
  const { data: receipts = [], isLoading: loadingReceipts } = useStaffExportReceipts(
    staff?.user_id || null, startDate, endDate
  );
  const { data: careLogs = [], isLoading: loadingCare } = useStaffCareLogs(
    staff?.user_id || null, startDate, endDate
  );
  const { data: activities = [], isLoading: loadingActivity } = useStaffActivity(
    staff?.user_id || null, startDate, endDate
  );

  if (!staff) return null;

  const kpi = staff.kpi_setting;
  const stats = staff.stats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{staff.display_name}</span>
            <Badge variant="secondary">{ROLE_LABELS[staff.user_role] || staff.user_role}</Badge>
            {staff.branch_name && <Badge variant="outline">{staff.branch_name}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Doanh thu</p>
                  <p className="font-bold text-sm">{formatCurrency(stats?.total_revenue || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Đơn hàng</p>
                  <p className="font-bold text-sm">{stats?.total_orders || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Khách hàng</p>
                  <p className="font-bold text-sm">
                    {stats?.total_customers || 0}
                    {(stats?.new_customers || 0) > 0 && (
                      <span className="text-xs text-green-600 ml-1">(+{stats?.new_customers})</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Tỉ lệ hoàn thành</p>
                  <p className="font-bold text-sm">{stats?.conversion_rate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Detail */}
        {kpi && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Chi tiết KPI</span>
                </div>
                <Badge variant={staff.achievement_percentage >= 100 ? 'default' : 'secondary'}>
                  {staff.achievement_percentage.toFixed(1)}%
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Loại KPI:</span>{' '}
                  <span className="font-medium">{kpi.kpi_type === 'revenue' ? 'Doanh thu' : 'Số đơn hàng'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Chu kỳ:</span>{' '}
                  <span className="font-medium">
                    {kpi.period_type === 'daily' ? 'Ngày' : kpi.period_type === 'weekly' ? 'Tuần' : 'Tháng'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mục tiêu:</span>{' '}
                  <span className="font-medium">
                    {kpi.kpi_type === 'revenue' ? formatCurrency(kpi.target_value) : kpi.target_value + ' đơn'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Thực tế:</span>{' '}
                  <span className="font-medium">
                    {kpi.kpi_type === 'revenue'
                      ? formatCurrency(stats?.total_revenue || 0)
                      : (stats?.total_orders || 0) + ' đơn'}
                  </span>
                </div>
              </div>
              <Progress value={Math.min(staff.achievement_percentage, 100)} className="h-2 mt-3" />
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="orders" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="orders" className="flex-1">
              <ShoppingCart className="h-4 w-4 mr-1" />
              Đơn đã bán ({receipts.length})
            </TabsTrigger>
            <TabsTrigger value="care" className="flex-1">
              <Users className="h-4 w-4 mr-1" />
              Chăm sóc KH ({careLogs.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">
              <History className="h-4 w-4 mr-1" />
              Lịch sử ({activities.length})
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">
            {loadingReceipts ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Không có đơn hàng trong khoảng thời gian này</div>
            ) : (
              <div className="overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Mã phiếu</TableHead>
                      <TableHead className="font-semibold">Ngày</TableHead>
                      <TableHead className="font-semibold">Khách hàng</TableHead>
                      <TableHead className="font-semibold text-right">Tổng tiền</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.receipt_code}</TableCell>
                        <TableCell className="text-sm">{format(new Date(r.export_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-sm">{r.customer_name || 'Khách lẻ'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(r.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Care Logs Tab */}
          <TabsContent value="care">
            {loadingCare ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : careLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Không có lịch sử chăm sóc</div>
            ) : (
              <div className="overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Thời gian</TableHead>
                      <TableHead className="font-semibold">Loại</TableHead>
                      <TableHead className="font-semibold">Khách hàng</TableHead>
                      <TableHead className="font-semibold">Nội dung</TableHead>
                      <TableHead className="font-semibold">Kết quả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {careLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">{format(new Date(log.created_at), 'dd/MM HH:mm')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ACTION_LABELS[log.action_type] || log.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.customer_name || '-'}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{log.content}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.result || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            {loadingActivity ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Không có lịch sử hoạt động</div>
            ) : (
              <div className="overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Thời gian</TableHead>
                      <TableHead className="font-semibold">Hành động</TableHead>
                      <TableHead className="font-semibold">Bảng</TableHead>
                      <TableHead className="font-semibold">Mô tả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((act) => (
                      <TableRow key={act.id}>
                        <TableCell className="text-xs">{format(new Date(act.created_at), 'dd/MM HH:mm')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{act.action_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{act.table_name || '-'}</TableCell>
                        <TableCell className="text-sm max-w-[250px] truncate">{act.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
