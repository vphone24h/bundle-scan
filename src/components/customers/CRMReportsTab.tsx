 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
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
 import { useStaffWithKPI } from '@/hooks/useStaffKPI';
 import { useCareSchedules } from '@/hooks/useCRM';
 import { useCustomerSources } from '@/hooks/useCustomerSources';
 import { useCustomersWithPoints } from '@/hooks/useCustomerPoints';
 import { formatCurrency } from '@/lib/mockData';
 import { 
   BarChart3,
   Users,
   TrendingUp,
   MapPin,
   Calendar,
   Loader2,
 } from 'lucide-react';
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
 
 const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
 
 export function CRMReportsTab() {
   const [period, setPeriod] = useState('month');
   
   const getDateRange = () => {
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
   };
 
   const { start, end } = getDateRange();
   const { data: staffWithKPI = [], isLoading: staffLoading } = useStaffWithKPI(start, end);
   const { data: customerSources = [] } = useCustomerSources();
   const { data: customers = [] } = useCustomersWithPoints();
   const { data: schedules = [] } = useCareSchedules();
 
   const revenueByStaff = staffWithKPI
     .filter(s => s.stats && s.stats.total_revenue > 0)
     .map(s => ({
       name: s.display_name,
       revenue: s.stats?.total_revenue || 0,
       orders: s.stats?.total_orders || 0,
     }))
     .sort((a, b) => b.revenue - a.revenue);
 
   const customersBySource = customerSources.map(source => ({
     name: source.name,
     value: customers.filter(c => c.source === source.name).length,
   })).filter(s => s.value > 0);
 
   const scheduleStats = {
     total: schedules.length,
     completed: schedules.filter(s => s.status === 'completed').length,
     pending: schedules.filter(s => s.status === 'pending').length,
     overdue: schedules.filter(s => s.status === 'overdue').length,
   };
 
   const scheduleChartData = [
     { name: 'Hoàn thành', value: scheduleStats.completed, color: '#10b981' },
     { name: 'Đang chờ', value: scheduleStats.pending, color: '#3b82f6' },
     { name: 'Quá hạn', value: scheduleStats.overdue, color: '#ef4444' },
   ].filter(s => s.value > 0);
 
   return (
     <div className="space-y-6">
       {/* Period Selector */}
       <div className="flex justify-end">
         <Select value={period} onValueChange={setPeriod}>
           <SelectTrigger className="w-[140px]">
             <SelectValue />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="today">Hôm nay</SelectItem>
             <SelectItem value="week">Tuần này</SelectItem>
             <SelectItem value="month">Tháng này</SelectItem>
           </SelectContent>
         </Select>
       </div>
 
       <Tabs defaultValue="revenue">
         <TabsList className="grid w-full grid-cols-3 max-w-md">
           <TabsTrigger value="revenue">Doanh thu</TabsTrigger>
           <TabsTrigger value="customers">Khách hàng</TabsTrigger>
           <TabsTrigger value="care">Chăm sóc</TabsTrigger>
         </TabsList>
 
         {/* Revenue Tab */}
         <TabsContent value="revenue" className="space-y-6 mt-6">
           <div className="grid lg:grid-cols-2 gap-6">
             <Card>
               <CardHeader>
                 <CardTitle className="text-base flex items-center gap-2">
                   <TrendingUp className="h-4 w-4" />
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
                     <BarChart data={revenueByStaff} layout="vertical">
                       <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                       <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} />
                       <YAxis type="category" dataKey="name" width={100} />
                       <Tooltip formatter={(value: number) => formatCurrency(value)} />
                       <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 )}
               </CardContent>
             </Card>
 
             <Card>
               <CardHeader>
                 <CardTitle className="text-base">Chi tiết doanh số</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="overflow-x-auto">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Nhân viên</TableHead>
                         <TableHead className="text-right">Doanh thu</TableHead>
                         <TableHead className="text-right">Đơn hàng</TableHead>
                         <TableHead className="text-right">TB/đơn</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {revenueByStaff.map((staff, i) => (
                         <TableRow key={i}>
                           <TableCell className="font-medium">{staff.name}</TableCell>
                           <TableCell className="text-right">{formatCurrency(staff.revenue)}</TableCell>
                           <TableCell className="text-right">{staff.orders}</TableCell>
                           <TableCell className="text-right">
                             {staff.orders > 0 ? formatCurrency(staff.revenue / staff.orders) : '-'}
                           </TableCell>
                         </TableRow>
                       ))}
                       {revenueByStaff.length === 0 && (
                         <TableRow>
                           <TableCell colSpan={4} className="text-center text-muted-foreground">
                             Chưa có dữ liệu
                           </TableCell>
                         </TableRow>
                       )}
                     </TableBody>
                   </Table>
                 </div>
               </CardContent>
             </Card>
           </div>
         </TabsContent>
 
         {/* Customers Tab */}
         <TabsContent value="customers" className="space-y-6 mt-6">
           <div className="grid lg:grid-cols-2 gap-6">
             <Card>
               <CardHeader>
                 <CardTitle className="text-base flex items-center gap-2">
                   <MapPin className="h-4 w-4" />
                   Khách hàng theo nguồn
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 {customersBySource.length === 0 ? (
                   <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                     Chưa có dữ liệu
                   </div>
                 ) : (
                   <ResponsiveContainer width="100%" height={250}>
                     <PieChart>
                       <Pie
                         data={customersBySource}
                         cx="50%"
                         cy="50%"
                         outerRadius={90}
                         dataKey="value"
                         label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                       >
                         {customersBySource.map((_, index) => (
                           <Cell key={index} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Pie>
                       <Tooltip />
                     </PieChart>
                   </ResponsiveContainer>
                 )}
               </CardContent>
             </Card>
 
             <Card>
               <CardHeader>
                 <CardTitle className="text-base flex items-center gap-2">
                   <Users className="h-4 w-4" />
                   Thống kê nguồn khách
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   {customersBySource.map((source, i) => (
                     <div key={i} className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                         <span>{source.name}</span>
                       </div>
                       <div className="flex items-center gap-2">
                         <Badge variant="secondary">{source.value} khách</Badge>
                         <span className="text-sm text-muted-foreground">
                           ({((source.value / customers.length) * 100).toFixed(1)}%)
                         </span>
                       </div>
                     </div>
                   ))}
                   {customersBySource.length === 0 && (
                     <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu nguồn khách</p>
                   )}
                 </div>
               </CardContent>
             </Card>
           </div>
         </TabsContent>
 
         {/* Care Tab */}
         <TabsContent value="care" className="space-y-6 mt-6">
           <div className="grid lg:grid-cols-2 gap-6">
             <Card>
               <CardHeader>
                 <CardTitle className="text-base flex items-center gap-2">
                   <Calendar className="h-4 w-4" />
                   Tình trạng chăm sóc
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 {scheduleChartData.length === 0 ? (
                   <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                     Chưa có dữ liệu
                   </div>
                 ) : (
                   <ResponsiveContainer width="100%" height={250}>
                     <PieChart>
                       <Pie
                         data={scheduleChartData}
                         cx="50%"
                         cy="50%"
                         innerRadius={50}
                         outerRadius={90}
                         dataKey="value"
                         label={({ name, value }) => `${name}: ${value}`}
                       >
                         {scheduleChartData.map((entry, index) => (
                           <Cell key={index} fill={entry.color} />
                         ))}
                       </Pie>
                       <Tooltip />
                     </PieChart>
                   </ResponsiveContainer>
                 )}
               </CardContent>
             </Card>
 
             <Card>
               <CardHeader>
                 <CardTitle className="text-base">Thống kê lịch hẹn</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="bg-muted/50 rounded-lg p-4 text-center">
                     <p className="text-3xl font-bold">{scheduleStats.total}</p>
                     <p className="text-sm text-muted-foreground">Tổng lịch hẹn</p>
                   </div>
                   <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
                     <p className="text-3xl font-bold text-emerald-600">{scheduleStats.completed}</p>
                     <p className="text-sm text-muted-foreground">Hoàn thành</p>
                   </div>
                   <div className="bg-blue-500/10 rounded-lg p-4 text-center">
                     <p className="text-3xl font-bold text-blue-600">{scheduleStats.pending}</p>
                     <p className="text-sm text-muted-foreground">Đang chờ</p>
                   </div>
                   <div className="bg-red-500/10 rounded-lg p-4 text-center">
                     <p className="text-3xl font-bold text-red-600">{scheduleStats.overdue}</p>
                     <p className="text-sm text-muted-foreground">Quá hạn</p>
                   </div>
                 </div>
                 {scheduleStats.total > 0 && (
                   <div className="mt-4 pt-4 border-t">
                     <p className="text-sm text-muted-foreground text-center">
                       Tỷ lệ hoàn thành: <span className="font-medium text-foreground">
                         {((scheduleStats.completed / scheduleStats.total) * 100).toFixed(1)}%
                       </span>
                     </p>
                   </div>
                 )}
               </CardContent>
             </Card>
           </div>
         </TabsContent>
       </Tabs>
     </div>
   );
 }