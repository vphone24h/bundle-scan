import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, ShoppingCart, History, Target, DollarSign, Users, TrendingUp, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/mockData';
import { useStaffExportReceipts, useStaffCareLogs, useStaffActivity } from '@/hooks/useStaffDetail';
import { ACTION_LABELS, TABLE_LABELS } from '@/types/auditLog';
import { toast } from 'sonner';
import type { StaffWithKPI } from '@/hooks/useStaffKPI';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Quản lý',
  branch_admin: 'QL Chi nhánh',
  staff: 'Nhân viên',
  cashier: 'Kế toán',
};

const CARE_ACTION_LABELS: Record<string, string> = {
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto overscroll-contain w-[95vw] md:w-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base md:text-lg">
            <span className="truncate max-w-[180px] md:max-w-none">{staff.display_name}</span>
            <Badge variant="secondary" className="text-[10px] md:text-xs">
              {ROLE_LABELS[staff.user_role] || staff.user_role}
            </Badge>
            {staff.branch_name && (
              <Badge variant="outline" className="text-[10px] md:text-xs">{staff.branch_name}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* KPI Summary - 2x2 on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <Card>
            <CardContent className="p-2.5 md:p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-muted-foreground">Doanh thu</p>
                  <p className="font-bold text-xs md:text-sm truncate">{formatCurrency(stats?.total_revenue || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 md:p-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-muted-foreground">Đơn hàng</p>
                  <p className="font-bold text-xs md:text-sm">{stats?.total_orders || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 md:p-3">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-muted-foreground">Khách hàng</p>
                  <p className="font-bold text-xs md:text-sm">
                    {stats?.total_customers || 0}
                    {(stats?.new_customers || 0) > 0 && (
                      <span className="text-[10px] text-green-600 ml-0.5">(+{stats?.new_customers})</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 md:p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-muted-foreground">Hoàn thành</p>
                  <p className="font-bold text-xs md:text-sm">{stats?.conversion_rate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Detail */}
        {kpi && (
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  <span className="font-medium text-xs md:text-sm">Chi tiết KPI</span>
                </div>
                <Badge variant={staff.achievement_percentage >= 100 ? 'default' : 'secondary'} className="text-[10px] md:text-xs">
                  {staff.achievement_percentage.toFixed(1)}%
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
                <div>
                  <span className="text-muted-foreground">Loại:</span>{' '}
                  <span className="font-medium">{kpi.kpi_type === 'revenue' ? 'Doanh thu' : 'Đơn hàng'}</span>
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
        <Tabs defaultValue="orders" className="mt-1 md:mt-2">
          <TabsList className="w-full h-auto flex-wrap">
            <TabsTrigger value="orders" className="flex-1 text-xs md:text-sm py-1.5 gap-1">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Đơn bán</span>
              <span className="sm:hidden">Đơn</span>
              <span className="text-[10px]">({receipts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="care" className="flex-1 text-xs md:text-sm py-1.5 gap-1">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chăm sóc</span>
              <span className="sm:hidden">CSKH</span>
              <span className="text-[10px]">({careLogs.length})</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 text-xs md:text-sm py-1.5 gap-1">
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lịch sử</span>
              <span className="sm:hidden">LS</span>
              <span className="text-[10px]">({activities.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab - card layout on mobile */}
          <TabsContent value="orders">
            {loadingReceipts ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs md:text-sm">Không có đơn hàng</div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="md:hidden space-y-2 max-h-[40vh] overflow-y-auto overscroll-contain">
                  {receipts.map((r) => (
                    <div key={r.id} className="border rounded-lg p-3 text-xs">
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-mono text-muted-foreground">{r.receipt_code}</span>
                        <span className="font-bold">{formatCurrency(r.total_amount)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{r.customer_name || 'Khách lẻ'}</span>
                        <span>{format(new Date(r.export_date), 'dd/MM/yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden md:block overflow-auto max-h-[300px]">
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
              </>
            )}
          </TabsContent>

          {/* Care Logs Tab */}
          <TabsContent value="care">
            {loadingCare ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : careLogs.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs md:text-sm">Không có lịch sử chăm sóc</div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="md:hidden space-y-2 max-h-[40vh] overflow-y-auto overscroll-contain">
                  {careLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-3 text-xs">
                      <div className="flex justify-between items-center mb-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {CARE_ACTION_LABELS[log.action_type] || log.action_type}
                        </Badge>
                        <span className="text-muted-foreground">{format(new Date(log.created_at), 'dd/MM HH:mm')}</span>
                      </div>
                      <p className="font-medium mb-0.5">{log.customer_name || '-'}</p>
                      <p className="text-muted-foreground line-clamp-2">{log.content}</p>
                      {log.result && <p className="text-primary mt-1 text-[10px]">KQ: {log.result}</p>}
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden md:block overflow-auto max-h-[300px]">
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
                              {CARE_ACTION_LABELS[log.action_type] || log.action_type}
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
              </>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            {loadingActivity ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : activities.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs md:text-sm">Không có lịch sử</div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="md:hidden space-y-2 max-h-[40vh] overflow-y-auto overscroll-contain">
                  {activities.map((act) => {
                    const actionInfo = ACTION_LABELS[act.action_type] || { label: act.action_type, color: 'bg-gray-500' };
                    const shortCode = act.id.slice(0, 8).toUpperCase();
                    return (
                      <div key={act.id} className="border rounded-lg p-3 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <Badge className={`${actionInfo.color} text-white text-[10px]`}>
                            {actionInfo.label}
                          </Badge>
                          <span className="text-muted-foreground">{format(new Date(act.created_at), 'dd/MM HH:mm')}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="font-mono text-[10px] text-muted-foreground">#{shortCode}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(act.id);
                              toast.success('Đã sao chép mã thao tác');
                            }}
                            className="p-0.5 hover:bg-muted rounded"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                        {act.table_name && (
                          <p className="text-muted-foreground text-[10px] mb-0.5">
                            {TABLE_LABELS[act.table_name] || act.table_name}
                          </p>
                        )}
                        <p className="line-clamp-2">{act.description || '-'}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop: table */}
                <div className="hidden md:block overflow-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Mã</TableHead>
                        <TableHead className="font-semibold">Thời gian</TableHead>
                        <TableHead className="font-semibold">Hành động</TableHead>
                        <TableHead className="font-semibold">Nghiệp vụ</TableHead>
                        <TableHead className="font-semibold">Mô tả</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities.map((act) => {
                        const actionInfo = ACTION_LABELS[act.action_type] || { label: act.action_type, color: 'bg-gray-500' };
                        const shortCode = act.id.slice(0, 8).toUpperCase();
                        return (
                          <TableRow key={act.id}>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs text-muted-foreground">#{shortCode}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(act.id);
                                    toast.success('Đã sao chép mã thao tác');
                                  }}
                                  className="p-0.5 hover:bg-muted rounded"
                                >
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{format(new Date(act.created_at), 'dd/MM HH:mm')}</TableCell>
                            <TableCell>
                              <Badge className={`${actionInfo.color} text-white text-xs`}>
                                {actionInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {act.table_name ? TABLE_LABELS[act.table_name] || act.table_name : '-'}
                            </TableCell>
                            <TableCell className="text-sm max-w-[250px] truncate">{act.description || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
