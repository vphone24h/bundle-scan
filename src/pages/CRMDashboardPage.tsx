 import { useState } from 'react';
 import { MainLayout } from '@/components/layout/MainLayout';
 import { PageHeader } from '@/components/layout/PageHeader';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
 import { useStaffWithKPI, type StaffWithKPI } from '@/hooks/useStaffKPI';
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
   Calendar,
   UserCheck,
   Settings,
   Loader2,
 } from 'lucide-react';
 import { Link } from 'react-router-dom';
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
 
 const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
 
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
 
 export default function CRMDashboardPage() {
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
 
   // Stats calculations
   const totalRevenue = staffWithKPI.reduce((sum, s) => sum + (s.stats?.total_revenue || 0), 0);
   const totalOrders = staffWithKPI.reduce((sum, s) => sum + (s.stats?.total_orders || 0), 0);
   const newCustomersThisPeriod = staffWithKPI.reduce((sum, s) => sum + (s.stats?.new_customers || 0), 0);
 
   // Chart data
   const revenueByStaff = staffWithKPI
     .filter(s => s.stats && s.stats.total_revenue > 0)
     .map(s => ({
       name: s.display_name.split(' ').slice(-1)[0], // Last name only
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
 
   const isSuperAdmin = permissions?.role === 'super_admin';
   const isBranchAdmin = permissions?.role === 'branch_admin';
   const canManageKPI = isSuperAdmin || isBranchAdmin;
 
   const handleOpenKPIDialog = (staff: StaffWithKPI) => {
     setSelectedStaff(staff);
     setIsKPIDialogOpen(true);
   };
 
   return (
     <MainLayout>
       <PageHeader
         title="Dashboard CRM"
         description="Tổng quan hiệu suất nhân viên và chăm sóc khách hàng"
         actions={
           <Select value={period} onValueChange={setPeriod}>
             <SelectTrigger className="w-[140px]">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               {PERIOD_OPTIONS.map(opt => (
                 <SelectItem key={opt.value} value={opt.value}>
                   {opt.label}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
         }
       />
 
       <div className="p-4 sm:p-6 space-y-6">
         {/* Quick Stats */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           <Card>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                   <TrendingUp className="h-5 w-5 text-emerald-600" />
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground">Tổng doanh thu</p>
                   <p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                   <BarChart3 className="h-5 w-5 text-blue-600" />
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground">Tổng đơn hàng</p>
                   <p className="text-lg font-bold">{totalOrders}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                   <Users className="h-5 w-5 text-purple-600" />
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground">Khách hàng mới</p>
                   <p className="text-lg font-bold">{newCustomersThisPeriod}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                   <Clock className="h-5 w-5 text-orange-600" />
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground">Cần chăm sóc</p>
                   <p className="text-lg font-bold">{todaySchedules.length}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
         </div>
 
         {/* Alert Cards */}
         {overdueSchedules.length > 0 && (
           <Card className="border-destructive/50 bg-destructive/5">
             <CardContent className="p-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <AlertTriangle className="h-5 w-5 text-destructive" />
                   <div>
                     <p className="font-medium text-destructive">
                       {overdueSchedules.length} lịch chăm sóc quá hạn
                     </p>
                     <p className="text-sm text-muted-foreground">
                       Cần xử lý ngay
                     </p>
                   </div>
                 </div>
                 <Button variant="destructive" size="sm" asChild>
                   <Link to="/crm/care">Xem ngay</Link>
                 </Button>
               </div>
             </CardContent>
           </Card>
         )}
 
         {/* Charts & Tables */}
         <div className="grid lg:grid-cols-3 gap-6">
           {/* Revenue Chart */}
           <Card className="lg:col-span-2">
             <CardHeader>
               <CardTitle className="text-base flex items-center gap-2">
                 <BarChart3 className="h-4 w-4" />
                 Doanh thu theo nhân viên
               </CardTitle>
             </CardHeader>
             <CardContent>
               {staffLoading ? (
                 <div className="h-[250px] flex items-center justify-center">
                   <Loader2 className="h-6 w-6 animate-spin text-primary" />
                 </div>
               ) : revenueByStaff.length === 0 ? (
                 <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                   Chưa có dữ liệu
                 </div>
               ) : (
                 <ResponsiveContainer width="100%" height={250}>
                   <BarChart data={revenueByStaff}>
                     <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                     <XAxis dataKey="name" className="text-xs" />
                     <YAxis 
                       tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`}
                       className="text-xs"
                     />
                     <Tooltip 
                       formatter={(value: number) => formatCurrency(value)}
                       labelFormatter={(label) => `Nhân viên: ${label}`}
                     />
                     <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               )}
             </CardContent>
           </Card>
 
           {/* KPI Distribution */}
           <Card>
             <CardHeader>
               <CardTitle className="text-base flex items-center gap-2">
                 <Target className="h-4 w-4" />
                 Phân bố KPI
               </CardTitle>
             </CardHeader>
             <CardContent>
               {kpiDistribution.length === 0 ? (
                 <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                   Chưa có dữ liệu
                 </div>
               ) : (
                 <ResponsiveContainer width="100%" height={250}>
                   <PieChart>
                     <Pie
                       data={kpiDistribution}
                       cx="50%"
                       cy="50%"
                       innerRadius={50}
                       outerRadius={80}
                       dataKey="value"
                       label={({ name, value }) => `${name}: ${value}`}
                     >
                       {kpiDistribution.map((entry, index) => (
                         <Cell key={index} fill={entry.color} />
                       ))}
                     </Pie>
                     <Tooltip />
                   </PieChart>
                 </ResponsiveContainer>
               )}
             </CardContent>
           </Card>
         </div>
 
         {/* Staff KPI Table */}
         <Card>
           <CardHeader>
             <div className="flex items-center justify-between">
               <CardTitle className="text-base flex items-center gap-2">
                 <Crown className="h-4 w-4" />
                 Bảng xếp hạng nhân viên
               </CardTitle>
             </div>
           </CardHeader>
           <CardContent>
             {staffLoading ? (
               <div className="py-8 text-center">
                 <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
               </div>
             ) : (
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead className="w-12">#</TableHead>
                       <TableHead>Nhân viên</TableHead>
                       <TableHead>Chi nhánh</TableHead>
                       <TableHead className="text-right">Doanh thu</TableHead>
                       <TableHead className="text-right">Đơn hàng</TableHead>
                       <TableHead className="text-right">Khách hàng</TableHead>
                       <TableHead>KPI</TableHead>
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
                           ) : (
                             <span className="text-muted-foreground">{index + 1}</span>
                           )}
                         </TableCell>
                         <TableCell>
                           <div>
                             <p className="font-medium">{staff.display_name}</p>
                             <p className="text-xs text-muted-foreground capitalize">
                               {staff.user_role.replace('_', ' ')}
                             </p>
                           </div>
                         </TableCell>
                         <TableCell>
                           {staff.branch_name || <span className="text-muted-foreground">-</span>}
                         </TableCell>
                         <TableCell className="text-right font-medium">
                           {formatCurrency(staff.stats?.total_revenue || 0)}
                         </TableCell>
                         <TableCell className="text-right">
                           {staff.stats?.total_orders || 0}
                         </TableCell>
                         <TableCell className="text-right">
                           {staff.stats?.total_customers || 0}
                         </TableCell>
                         <TableCell>
                           {staff.kpi_setting ? (
                             <div className="text-xs">
                               <span className="font-medium">
                                 {staff.kpi_setting.kpi_type === 'revenue' 
                                   ? formatCurrency(staff.kpi_setting.target_value)
                                   : `${staff.kpi_setting.target_value} đơn`}
                               </span>
                               <span className="text-muted-foreground ml-1">
                                 /{staff.kpi_setting.period_type === 'monthly' ? 'tháng' : 
                                   staff.kpi_setting.period_type === 'weekly' ? 'tuần' : 'ngày'}
                               </span>
                             </div>
                           ) : (
                             <span className="text-xs text-muted-foreground">Chưa đặt</span>
                           )}
                         </TableCell>
                         <TableCell>
                           {staff.kpi_setting ? (
                             <div className="w-24">
                               <div className="flex items-center justify-between text-xs mb-1">
                                 <span className={
                                   staff.achievement_percentage >= 100 ? 'text-emerald-600 font-medium' :
                                   staff.achievement_percentage >= 50 ? 'text-amber-600' :
                                   'text-red-600'
                                 }>
                                   {staff.achievement_percentage}%
                                 </span>
                               </div>
                               <Progress 
                                 value={Math.min(staff.achievement_percentage, 100)} 
                                 className="h-1.5"
                               />
                             </div>
                           ) : (
                             <span className="text-xs text-muted-foreground">-</span>
                           )}
                         </TableCell>
                         {canManageKPI && (
                           <TableCell>
                             <Button
                               variant="ghost"
                               size="icon"
                               className="h-8 w-8"
                               onClick={() => handleOpenKPIDialog(staff)}
                             >
                               <Settings className="h-4 w-4" />
                             </Button>
                           </TableCell>
                         )}
                       </TableRow>
                     ))}
                     {staffWithKPI.length === 0 && (
                       <TableRow>
                         <TableCell colSpan={canManageKPI ? 9 : 8} className="text-center py-8 text-muted-foreground">
                           Chưa có dữ liệu nhân viên
                         </TableCell>
                       </TableRow>
                     )}
                   </TableBody>
                 </Table>
               </div>
             )}
           </CardContent>
         </Card>
 
         {/* Quick Actions */}
         <div className="flex flex-wrap gap-3">
           <Button asChild>
             <Link to="/crm/care">
               <Calendar className="mr-2 h-4 w-4" />
               Lịch chăm sóc
             </Link>
           </Button>
           <Button variant="outline" asChild>
             <Link to="/customers">
               <Users className="mr-2 h-4 w-4" />
               Quản lý khách hàng
             </Link>
           </Button>
           <Button variant="outline" asChild>
             <Link to="/crm/reports">
               <BarChart3 className="mr-2 h-4 w-4" />
               Báo cáo chi tiết
             </Link>
           </Button>
         </div>
       </div>
 
       {/* KPI Settings Dialog */}
       {selectedStaff && (
         <KPISettingsDialog
           open={isKPIDialogOpen}
           onOpenChange={setIsKPIDialogOpen}
           userId={selectedStaff.user_id}
           userName={selectedStaff.display_name}
           currentSetting={selectedStaff.kpi_setting}
         />
       )}
     </MainLayout>
   );
 }