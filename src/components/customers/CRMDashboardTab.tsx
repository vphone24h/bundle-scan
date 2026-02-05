 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { useStaffWithKPI } from '@/hooks/useStaffKPI';
 import type { StaffWithKPI } from '@/hooks/useStaffKPI';
 import { useCareSchedules } from '@/hooks/useCRM';
 import { useCustomersWithPoints } from '@/hooks/useCustomerPoints';
 import { formatCurrency } from '@/lib/mockData';
 import { 
   Users, 
   TrendingUp, 
   Target, 
   Clock, 
   AlertTriangle,
   Crown,
   BarChart3,
   Settings,
   Loader2,
 } from 'lucide-react';
 import { KPISettingsDialog } from '@/components/crm/KPISettingsDialog';
 
 import { usePermissions } from '@/hooks/usePermissions';
 import {
   BarChart,
   Bar,
   XAxis,
   YAxis,
   CartesianGrid,
   Tooltip,
   ResponsiveContainer,
   PieChart,
   Pie,
   Cell,
 } from 'recharts';
 
 const PERIOD_OPTIONS = [
   { value: 'today', label: 'Hôm nay' },
   { value: 'week', label: 'Tuần này' },
   { value: 'month', label: 'Tháng này' },
 ];
 
 function getDateRange(period: string) {
   const today = new Date();
   let start: Date, end: Date;
 
   switch (period) {
     case 'today':
       start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
       end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
       break;
     case 'week':
       const dayOfWeek = today.getDay();
       start = new Date(today);
       start.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
       end = new Date(start);
       end.setDate(start.getDate() + 6);
       break;
     case 'month':
     default:
       start = new Date(today.getFullYear(), today.getMonth(), 1);
       end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
       break;
   }
 
   return { start, end };
 }
 
 export function CRMDashboardTab() {
   const [period, setPeriod] = useState('month');
   const [selectedStaff, setSelectedStaff] = useState<StaffWithKPI | null>(null);
   const [isKPIDialogOpen, setIsKPIDialogOpen] = useState(false);
 
   const { data: permissions } = usePermissions();
   const { start, end } = getDateRange(period);
   const { data: staffWithKPI = [], isLoading: staffLoading } = useStaffWithKPI(start, end);
   const { data: schedules = [] } = useCareSchedules({ status: 'pending' });
   const { data: customers = [] } = useCustomersWithPoints();
 
   const todaySchedules = schedules.filter(s => {
     const today = new Date().toISOString().split('T')[0];
     return s.scheduled_date === today;
   });
   const overdueSchedules = schedules.filter(s => s.status === 'overdue');
 
   const totalRevenue = staffWithKPI.reduce((sum, s) => sum + (s.stats?.total_revenue || 0), 0);
   const totalOrders = staffWithKPI.reduce((sum, s) => sum + (s.stats?.total_orders || 0), 0);
   const newCustomersThisPeriod = staffWithKPI.reduce((sum, s) => sum + (s.stats?.new_customers || 0), 0);
 
   const revenueByStaff = staffWithKPI
     .filter(s => s.stats && s.stats.total_revenue > 0)
     .map(s => ({
       name: s.display_name.split(' ').slice(-1)[0],
       revenue: s.stats?.total_revenue || 0,
       orders: s.stats?.total_orders || 0,
     }))
     .slice(0, 6);
 
   const kpiDistribution = [
     { name: 'Đạt > 100%', value: staffWithKPI.filter(s => s.achievement_percentage >= 100).length, color: '#10b981' },
     { name: '50-100%', value: staffWithKPI.filter(s => s.achievement_percentage >= 50 && s.achievement_percentage < 100).length, color: '#f59e0b' },
     { name: '< 50%', value: staffWithKPI.filter(s => s.achievement_percentage < 50 && s.achievement_percentage > 0).length, color: '#ef4444' },
     { name: 'Chưa có KPI', value: staffWithKPI.filter(s => !s.kpi_setting).length, color: '#94a3b8' },
   ].filter(d => d.value > 0);
 
   const canManageKPI = permissions?.role === 'super_admin' || permissions?.role === 'branch_admin';
 
   return (
    <div className="space-y-4 sm:space-y-6">
       {/* Period Selector */}
       <div className="flex justify-end">
         <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px] sm:w-[140px] h-9 text-sm">
             <SelectValue />
           </SelectTrigger>
           <SelectContent>
             {PERIOD_OPTIONS.map(opt => (
               <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
             ))}
           </SelectContent>
         </Select>
       </div>
 
       {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
         <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
               </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Doanh thu</p>
                <p className="text-sm sm:text-lg font-bold break-all">{formatCurrency(totalRevenue)}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
               </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Đơn hàng</p>
                <p className="text-sm sm:text-lg font-bold">{totalOrders}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
               </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Khách mới</p>
                <p className="text-sm sm:text-lg font-bold">{newCustomersThisPeriod}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
               </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Cần chăm sóc</p>
                <p className="text-sm sm:text-lg font-bold">{todaySchedules.length}</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Alert */}
       {overdueSchedules.length > 0 && (
         <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 sm:p-4">
             <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0" />
              <p className="font-medium text-destructive text-sm sm:text-base">
                 {overdueSchedules.length} lịch chăm sóc quá hạn cần xử lý
               </p>
             </div>
           </CardContent>
         </Card>
       )}
 
       {/* Charts */}
      <div className="grid gap-4 sm:gap-6">
        <Card>
           <CardHeader>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
               Doanh thu theo nhân viên
             </CardTitle>
           </CardHeader>
           <CardContent>
             {staffLoading ? (
              <div className="h-[150px] sm:h-[200px] flex items-center justify-center">
                 <Loader2 className="h-6 w-6 animate-spin text-primary" />
               </div>
             ) : revenueByStaff.length === 0 ? (
              <div className="h-[150px] sm:h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                 Chưa có dữ liệu
               </div>
             ) : (
              <ResponsiveContainer width="100%" height={150}>
                 <BarChart data={revenueByStaff}>
                   <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} className="text-xs" tick={{ fontSize: 10 }} />
                   <Tooltip formatter={(value: number) => formatCurrency(value)} />
                   <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             )}
           </CardContent>
         </Card>
       </div>
 
       {/* Staff Table */}
       <Card>
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
             Bảng xếp hạng nhân viên
           </CardTitle>
         </CardHeader>
        <CardContent className="px-2 sm:px-6">
           {staffLoading ? (
             <div className="py-8 text-center">
               <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
             </div>
           ) : (
            <>
              {/* Mobile: Card View */}
              <div className="sm:hidden divide-y">
                {staffWithKPI.map((staff, index) => (
                  <div key={staff.user_id} className="py-3 px-1">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {index < 3 ? (
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-100 text-gray-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {index + 1}
                          </div>
                        ) : <span className="text-xs text-muted-foreground w-5 text-center">{index + 1}</span>}
                        <div>
                          <p className="font-medium text-sm">{staff.display_name}</p>
                          <p className="text-xs text-muted-foreground">{staff.branch_name || '-'}</p>
                        </div>
                      </div>
                      {canManageKPI && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedStaff(staff);
                            setIsKPIDialogOpen(true);
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 pl-7">
                      <p className="text-sm font-semibold">{formatCurrency(staff.stats?.total_revenue || 0)}</p>
                      {staff.kpi_setting ? (
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(staff.achievement_percentage, 100)} className="h-1.5 w-12" />
                          <span className={`text-xs font-medium ${
                            staff.achievement_percentage >= 100 ? 'text-emerald-600' :
                            staff.achievement_percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {staff.achievement_percentage}%
                          </span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Chưa đặt KPI</span>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead className="text-right">Doanh thu</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Đơn hàng</TableHead>
                      <TableHead className="hidden lg:table-cell">KPI</TableHead>
                      <TableHead className="text-center">Hoàn thành</TableHead>
                      {canManageKPI && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffWithKPI.map((staff, index) => (
                      <TableRow key={staff.user_id}>
                        <TableCell>
                          {index < 3 ? (
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-gray-100 text-gray-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {index + 1}
                            </div>
                          ) : <span className="text-muted-foreground">{index + 1}</span>}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{staff.display_name}</p>
                          <p className="text-xs text-muted-foreground">{staff.branch_name || '-'}</p>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(staff.stats?.total_revenue || 0)}
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          {staff.stats?.total_orders || 0}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {staff.kpi_setting ? (
                            <span className="text-xs">
                              {staff.kpi_setting.kpi_type === 'revenue' 
                                ? formatCurrency(staff.kpi_setting.target_value)
                                : `${staff.kpi_setting.target_value} đơn`}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">Chưa đặt</span>}
                        </TableCell>
                        <TableCell>
                          {staff.kpi_setting ? (
                            <div className="w-20">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className={
                                  staff.achievement_percentage >= 100 ? 'text-emerald-600 font-medium' :
                                  staff.achievement_percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                                }>
                                  {staff.achievement_percentage}%
                                </span>
                              </div>
                              <Progress value={Math.min(staff.achievement_percentage, 100)} className="h-1.5" />
                            </div>
                          ) : <span className="text-xs text-muted-foreground">-</span>}
                        </TableCell>
                        {canManageKPI && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedStaff(staff);
                                setIsKPIDialogOpen(true);
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
           )}
         </CardContent>
       </Card>
 
       {selectedStaff && (
         <KPISettingsDialog
           open={isKPIDialogOpen}
           onOpenChange={setIsKPIDialogOpen}
           userId={selectedStaff.user_id}
           userName={selectedStaff.display_name}
           currentSetting={selectedStaff.kpi_setting}
         />
       )}
     </div>
   );
 }