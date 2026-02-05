 import { useState } from 'react';
 import { MainLayout } from '@/components/layout/MainLayout';
 import { PageHeader } from '@/components/layout/PageHeader';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
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
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from '@/components/ui/dialog';
 import {
   useCareSchedules,
   useCareScheduleTypes,
   useCreateCareSchedule,
   useCompleteCareSchedule,
   useCreateCareScheduleType,
   useStaffList,
   CareSchedule,
 } from '@/hooks/useCRM';
 import { useSearchParams, useNavigate } from 'react-router-dom';
 import { format, addDays, isToday, isPast, isFuture } from 'date-fns';
 import { vi } from 'date-fns/locale';
 import { Plus, Check, Clock, AlertTriangle, Calendar, Phone, User } from 'lucide-react';
 import { toast } from 'sonner';
 import { Label } from '@/components/ui/label';
 import { useCustomerDetail } from '@/hooks/useCustomerPoints';
 import { usePagination } from '@/hooks/usePagination';
 import { TablePagination } from '@/components/ui/table-pagination';
 
 const STATUS_CONFIG = {
   pending: { label: 'Chờ xử lý', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
   completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-800', icon: Check },
   cancelled: { label: 'Đã hủy', color: 'bg-gray-100 text-gray-800', icon: null },
   overdue: { label: 'Quá hạn', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
 };
 
 const QUICK_DAYS = [7, 15, 30];
 
 export default function CRMCarePage() {
   const [searchParams] = useSearchParams();
   const navigate = useNavigate();
   const customerId = searchParams.get('customerId');
   
   const [statusFilter, setStatusFilter] = useState('pending');
   const [showCreateDialog, setShowCreateDialog] = useState(false);
   const [showCompleteDialog, setShowCompleteDialog] = useState(false);
   const [selectedSchedule, setSelectedSchedule] = useState<CareSchedule | null>(null);
   const [completeResult, setCompleteResult] = useState('');
 
   // Form state
   const [formData, setFormData] = useState({
     careTypeId: '',
     careTypeName: '',
     scheduledDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
     scheduledTime: '',
     note: '',
     assignedStaffId: '',
     reminderDays: 1,
   });
   const [newTypeName, setNewTypeName] = useState('');
 
   const { data: schedules, isLoading } = useCareSchedules({
     customerId: customerId || undefined,
     status: statusFilter !== '_all_' ? statusFilter : undefined,
   });
   const { data: careTypes } = useCareScheduleTypes();
   const { data: staffList } = useStaffList();
   const { data: customer } = useCustomerDetail(customerId);
   
   const createSchedule = useCreateCareSchedule();
   const completeSchedule = useCompleteCareSchedule();
   const createCareType = useCreateCareScheduleType();
 
   const pagination = usePagination(schedules || [], { storageKey: 'crm-care' });
 
   // Stats
   const todayCount = schedules?.filter(s => s.status === 'pending' && isToday(new Date(s.scheduled_date))).length || 0;
   const overdueCount = schedules?.filter(s => s.status === 'pending' && isPast(new Date(s.scheduled_date)) && !isToday(new Date(s.scheduled_date))).length || 0;
   const upcomingCount = schedules?.filter(s => s.status === 'pending' && isFuture(new Date(s.scheduled_date))).length || 0;
 
   const handleQuickDays = (days: number) => {
     setFormData(prev => ({
       ...prev,
       scheduledDate: format(addDays(new Date(), days), 'yyyy-MM-dd'),
     }));
   };
 
   const handleCreateSchedule = async () => {
     if (!customerId) {
       toast.error('Vui lòng chọn khách hàng');
       return;
     }
     if (!formData.careTypeName) {
       toast.error('Vui lòng chọn loại chăm sóc');
       return;
     }
 
     try {
       await createSchedule.mutateAsync({
         customerId,
         careTypeId: formData.careTypeId || undefined,
         careTypeName: formData.careTypeName,
         scheduledDate: formData.scheduledDate,
         scheduledTime: formData.scheduledTime || undefined,
         note: formData.note || undefined,
         assignedStaffId: formData.assignedStaffId || undefined,
         reminderDays: formData.reminderDays,
       });
       toast.success('Đã tạo lịch chăm sóc');
       setShowCreateDialog(false);
       setFormData({
         careTypeId: '',
         careTypeName: '',
         scheduledDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
         scheduledTime: '',
         note: '',
         assignedStaffId: '',
         reminderDays: 1,
       });
     } catch (error: any) {
       toast.error(error.message || 'Lỗi tạo lịch');
     }
   };
 
   const handleComplete = async () => {
     if (!selectedSchedule) return;
 
     try {
       await completeSchedule.mutateAsync({
         scheduleId: selectedSchedule.id,
         result: completeResult,
       });
       toast.success('Đã hoàn thành');
       setShowCompleteDialog(false);
       setSelectedSchedule(null);
       setCompleteResult('');
     } catch (error: any) {
       toast.error(error.message || 'Lỗi');
     }
   };
 
   const handleAddCareType = async () => {
     if (!newTypeName.trim()) return;
     try {
       await createCareType.mutateAsync(newTypeName.trim());
       setNewTypeName('');
       toast.success('Đã thêm loại chăm sóc');
     } catch (error: any) {
       toast.error(error.message || 'Lỗi');
     }
   };
 
   const handleSelectType = (typeId: string) => {
     const type = careTypes?.find(t => t.id === typeId);
     if (type) {
       setFormData(prev => ({
         ...prev,
         careTypeId: type.id,
         careTypeName: type.name,
       }));
     }
   };
 
   return (
     <MainLayout>
       <PageHeader 
         title={customer ? `Lịch chăm sóc - ${customer.name}` : 'Lịch chăm sóc khách hàng'}
       />
 
       {/* Stats */}
       <div className="grid grid-cols-3 gap-4 mb-6">
         <Card>
           <CardContent className="pt-4">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-yellow-100 rounded-lg">
                 <Clock className="h-5 w-5 text-yellow-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold">{todayCount}</p>
                 <p className="text-xs text-muted-foreground">Hôm nay</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-4">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-red-100 rounded-lg">
                 <AlertTriangle className="h-5 w-5 text-red-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold">{overdueCount}</p>
                 <p className="text-xs text-muted-foreground">Quá hạn</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-4">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-blue-100 rounded-lg">
                 <Calendar className="h-5 w-5 text-blue-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold">{upcomingCount}</p>
                 <p className="text-xs text-muted-foreground">Sắp tới</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Filters & Actions */}
       <Card className="mb-6">
         <CardContent className="pt-4">
           <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
             <div className="flex gap-2">
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                 <SelectTrigger className="w-[150px]">
                   <SelectValue placeholder="Trạng thái" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="_all_">Tất cả</SelectItem>
                   <SelectItem value="pending">Chờ xử lý</SelectItem>
                   <SelectItem value="completed">Hoàn thành</SelectItem>
                   <SelectItem value="overdue">Quá hạn</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <Button onClick={() => setShowCreateDialog(true)} disabled={!customerId}>
               <Plus className="h-4 w-4 mr-2" />
               Tạo lịch chăm sóc
             </Button>
           </div>
           {!customerId && (
             <p className="text-sm text-muted-foreground mt-2">
               Vui lòng chọn khách hàng từ trang Quản lý khách hàng để tạo lịch chăm sóc
             </p>
           )}
         </CardContent>
       </Card>
 
       {/* Schedule List */}
       <Card>
         <CardContent className="p-0">
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Khách hàng</TableHead>
                 <TableHead>Loại chăm sóc</TableHead>
                 <TableHead>Ngày hẹn</TableHead>
                 <TableHead>NV phụ trách</TableHead>
                 <TableHead>Trạng thái</TableHead>
                 <TableHead className="w-[100px]"></TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {isLoading ? (
                 <TableRow>
                   <TableCell colSpan={6} className="text-center py-8">Đang tải...</TableCell>
                 </TableRow>
               ) : pagination.paginatedData.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                     Chưa có lịch chăm sóc nào
                   </TableCell>
                 </TableRow>
               ) : (
                 pagination.paginatedData.map((schedule) => {
                   const statusConfig = STATUS_CONFIG[schedule.status];
                   const isOverdue = schedule.status === 'pending' && isPast(new Date(schedule.scheduled_date)) && !isToday(new Date(schedule.scheduled_date));
                   
                   return (
                     <TableRow key={schedule.id}>
                       <TableCell>
                         <div>
                           <p className="font-medium">{schedule.customer?.name || '-'}</p>
                           <p className="text-sm text-muted-foreground">{schedule.customer?.phone}</p>
                         </div>
                       </TableCell>
                       <TableCell>
                         <Badge variant="outline">{schedule.care_type_name}</Badge>
                       </TableCell>
                       <TableCell>
                         <div className={isOverdue ? 'text-destructive font-medium' : ''}>
                           {format(new Date(schedule.scheduled_date), 'dd/MM/yyyy', { locale: vi })}
                           {schedule.scheduled_time && (
                             <span className="text-sm text-muted-foreground ml-1">
                               {schedule.scheduled_time}
                             </span>
                           )}
                         </div>
                       </TableCell>
                       <TableCell>
                         {staffList?.find(s => s.user_id === schedule.assigned_staff_id)?.display_name || '-'}
                       </TableCell>
                       <TableCell>
                         <Badge className={isOverdue ? STATUS_CONFIG.overdue.color : statusConfig.color}>
                           {isOverdue ? STATUS_CONFIG.overdue.label : statusConfig.label}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         {schedule.status === 'pending' && (
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => {
                               setSelectedSchedule(schedule);
                               setShowCompleteDialog(true);
                             }}
                           >
                             <Check className="h-4 w-4 mr-1" />
                             Xong
                           </Button>
                         )}
                       </TableCell>
                     </TableRow>
                   );
                 })
               )}
             </TableBody>
           </Table>
           
           {(schedules?.length || 0) > 0 && (
             <TablePagination
               currentPage={pagination.currentPage}
               totalPages={pagination.totalPages}
               pageSize={pagination.pageSize}
               totalItems={pagination.totalItems}
               startIndex={pagination.startIndex}
               endIndex={pagination.endIndex}
               onPageChange={pagination.setPage}
               onPageSizeChange={pagination.setPageSize}
             />
           )}
         </CardContent>
       </Card>
 
       {/* Create Schedule Dialog */}
       <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Tạo lịch chăm sóc</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div className="space-y-2">
               <Label>Loại chăm sóc *</Label>
               <Select value={formData.careTypeId} onValueChange={handleSelectType}>
                 <SelectTrigger>
                   <SelectValue placeholder="Chọn loại chăm sóc" />
                 </SelectTrigger>
                 <SelectContent>
                   {careTypes?.map((type) => (
                     <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               <div className="flex gap-2">
                 <Input
                   placeholder="Thêm loại mới..."
                   value={newTypeName}
                   onChange={(e) => setNewTypeName(e.target.value)}
                   className="flex-1"
                 />
                 <Button type="button" variant="outline" size="sm" onClick={handleAddCareType} disabled={!newTypeName.trim()}>
                   <Plus className="h-4 w-4" />
                 </Button>
               </div>
             </div>
 
             <div className="space-y-2">
               <Label>Ngày hẹn *</Label>
               <div className="flex gap-2 mb-2">
                 {QUICK_DAYS.map(days => (
                   <Button
                     key={days}
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={() => handleQuickDays(days)}
                   >
                     {days} ngày
                   </Button>
                 ))}
               </div>
               <Input
                 type="date"
                 value={formData.scheduledDate}
                 onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
               />
             </div>
 
             <div className="space-y-2">
               <Label>Giờ hẹn (tùy chọn)</Label>
               <Input
                 type="time"
                 value={formData.scheduledTime}
                 onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
               />
             </div>
 
             <div className="space-y-2">
               <Label>NV phụ trách</Label>
               <Select
                 value={formData.assignedStaffId}
                 onValueChange={(v) => setFormData(prev => ({ ...prev, assignedStaffId: v }))}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Chọn nhân viên" />
                 </SelectTrigger>
                 <SelectContent>
                   {staffList?.map((staff) => (
                     <SelectItem key={staff.user_id} value={staff.user_id}>
                       {staff.display_name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-2">
               <Label>Ghi chú</Label>
               <Textarea
                 value={formData.note}
                 onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                 placeholder="Nội dung cần trao đổi..."
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Hủy</Button>
             <Button onClick={handleCreateSchedule} disabled={createSchedule.isPending}>
               Tạo lịch
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Complete Dialog */}
       <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Hoàn thành chăm sóc</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div className="p-3 bg-muted rounded-lg">
               <p className="font-medium">{selectedSchedule?.customer?.name}</p>
               <p className="text-sm text-muted-foreground">{selectedSchedule?.care_type_name}</p>
             </div>
             <div className="space-y-2">
               <Label>Kết quả / Ghi chú</Label>
               <Textarea
                 value={completeResult}
                 onChange={(e) => setCompleteResult(e.target.value)}
                 placeholder="Kết quả cuộc gọi / trao đổi..."
                 rows={4}
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Hủy</Button>
             <Button onClick={handleComplete} disabled={completeSchedule.isPending}>
               <Check className="h-4 w-4 mr-2" />
               Hoàn thành
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </MainLayout>
   );
 }