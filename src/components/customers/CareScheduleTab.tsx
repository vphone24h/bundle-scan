 import { useState } from 'react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
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
 import { format, addDays, isToday, isPast } from 'date-fns';
 import { vi } from 'date-fns/locale';
 import { Plus, Check, Clock, AlertTriangle, Calendar } from 'lucide-react';
 import { toast } from 'sonner';
 import { usePagination } from '@/hooks/usePagination';
 import { TablePagination } from '@/components/ui/table-pagination';
import { useIsMobile } from '@/hooks/use-mobile';
 
 const STATUS_CONFIG = {
   pending: { label: 'Chờ xử lý', color: 'bg-yellow-100 text-yellow-800' },
   completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-800' },
   cancelled: { label: 'Đã hủy', color: 'bg-gray-100 text-gray-800' },
   overdue: { label: 'Quá hạn', color: 'bg-red-100 text-red-800' },
 };
 
 interface CareScheduleTabProps {
   customerId: string | null;
   customerName?: string;
 }
 
 export function CareScheduleTab({ customerId, customerName }: CareScheduleTabProps) {
   const [statusFilter, setStatusFilter] = useState('pending');
   const [showCreateDialog, setShowCreateDialog] = useState(false);
   const [showCompleteDialog, setShowCompleteDialog] = useState(false);
   const [selectedSchedule, setSelectedSchedule] = useState<CareSchedule | null>(null);
   const [completeResult, setCompleteResult] = useState('');
 
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
   
   const createSchedule = useCreateCareSchedule();
   const completeSchedule = useCompleteCareSchedule();
   const createCareType = useCreateCareScheduleType();
 
   const pagination = usePagination(schedules || [], { storageKey: 'crm-care-tab' });
 
   const todayCount = schedules?.filter(s => s.status === 'pending' && isToday(new Date(s.scheduled_date))).length || 0;
   const overdueCount = schedules?.filter(s => s.status === 'pending' && isPast(new Date(s.scheduled_date)) && !isToday(new Date(s.scheduled_date))).length || 0;
   const upcomingCount = schedules?.filter(s => s.status === 'pending' && !isPast(new Date(s.scheduled_date))).length || 0;
 
   const handleQuickDays = (days: number) => {
     setFormData(prev => ({ ...prev, scheduledDate: format(addDays(new Date(), days), 'yyyy-MM-dd') }));
   };
 
   const handleCreateSchedule = async () => {
     if (!customerId) {
       toast.error('Vui lòng chọn khách hàng từ tab Danh sách');
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
       setFormData(prev => ({ ...prev, careTypeId: type.id, careTypeName: type.name }));
     }
   };
 
   return (
    <div className="space-y-3 sm:space-y-4">
       {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
         <Card>
          <CardContent className="pt-3 sm:pt-4 px-2 sm:px-4">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
               </div>
              <div className="text-center sm:text-left">
                <p className="text-lg sm:text-2xl font-bold">{todayCount}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Hôm nay</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
          <CardContent className="pt-3 sm:pt-4 px-2 sm:px-4">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
               </div>
              <div className="text-center sm:text-left">
                <p className="text-lg sm:text-2xl font-bold">{overdueCount}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Quá hạn</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
          <CardContent className="pt-3 sm:pt-4 px-2 sm:px-4">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
               </div>
              <div className="text-center sm:text-left">
                <p className="text-lg sm:text-2xl font-bold">{upcomingCount}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Sắp tới</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Filters & Actions */}
       <Card>
        <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center justify-between">
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] sm:w-[150px] h-9 text-sm">
                   <SelectValue placeholder="Trạng thái" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="_all_">Tất cả</SelectItem>
                   <SelectItem value="pending">Chờ xử lý</SelectItem>
                   <SelectItem value="completed">Hoàn thành</SelectItem>
                   <SelectItem value="overdue">Quá hạn</SelectItem>
                 </SelectContent>
               </Select>
              <Button size="sm" onClick={() => setShowCreateDialog(true)} disabled={!customerId} className="h-9">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tạo lịch</span>
              </Button>
             </div>
            {customerId && customerName && (
              <Badge variant="secondary" className="text-xs w-fit">
                Khách: {customerName}
              </Badge>
            )}
            {!customerId && (
              <p className="text-xs text-muted-foreground">
                Chọn khách hàng từ tab "Danh sách" để tạo lịch
              </p>
            )}
          </div>
         </CardContent>
       </Card>
 
       {/* Schedule List */}
       <Card>
         <CardContent className="p-0">
          {/* Mobile: Card View */}
          <div className="sm:hidden divide-y">
            {isLoading ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Đang tải...</p>
            ) : pagination.paginatedData.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                Chưa có lịch chăm sóc nào
              </p>
            ) : (
              pagination.paginatedData.map((schedule) => {
                const statusConfig = STATUS_CONFIG[schedule.status as keyof typeof STATUS_CONFIG];
                const isOverdue = schedule.status === 'pending' && isPast(new Date(schedule.scheduled_date)) && !isToday(new Date(schedule.scheduled_date));
                
                return (
                  <div key={schedule.id} className="p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{schedule.customer?.name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{schedule.customer?.phone}</p>
                      </div>
                      <Badge className={`text-xs ${isOverdue ? STATUS_CONFIG.overdue.color : statusConfig?.color}`}>
                        {isOverdue ? STATUS_CONFIG.overdue.label : statusConfig?.label}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <Badge variant="outline" className="text-xs">{schedule.care_type_name}</Badge>
                        <p className={`text-xs mt-1 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {format(new Date(schedule.scheduled_date), 'dd/MM/yyyy', { locale: vi })}
                          {schedule.scheduled_time && ` ${schedule.scheduled_time}`}
                        </p>
                      </div>
                      {schedule.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            setSelectedSchedule(schedule);
                            setShowCompleteDialog(true);
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* Desktop: Table View */}
          <Table className="hidden sm:table">
             <TableHeader>
               <TableRow>
                 <TableHead>Khách hàng</TableHead>
                 <TableHead>Loại chăm sóc</TableHead>
                 <TableHead>Ngày hẹn</TableHead>
                 <TableHead className="hidden md:table-cell">NV phụ trách</TableHead>
                 <TableHead>Trạng thái</TableHead>
                 <TableHead className="w-[80px]"></TableHead>
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
                   const statusConfig = STATUS_CONFIG[schedule.status as keyof typeof STATUS_CONFIG];
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
                             <span className="text-sm text-muted-foreground ml-1">{schedule.scheduled_time}</span>
                           )}
                         </div>
                       </TableCell>
                       <TableCell className="hidden md:table-cell">
                         {staffList?.find(s => s.user_id === schedule.assigned_staff_id)?.display_name || '-'}
                       </TableCell>
                       <TableCell>
                         <Badge className={isOverdue ? STATUS_CONFIG.overdue.color : statusConfig?.color}>
                           {isOverdue ? STATUS_CONFIG.overdue.label : statusConfig?.label}
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
                             <Check className="h-4 w-4" />
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
 
       {/* Create Dialog */}
       <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Tạo lịch chăm sóc</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div className="space-y-2">
               <Label>Loại chăm sóc *</Label>
               <Select value={formData.careTypeId} onValueChange={handleSelectType}>
                 <SelectTrigger><SelectValue placeholder="Chọn loại chăm sóc" /></SelectTrigger>
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
                 <Button type="button" variant="outline" size="sm" onClick={handleAddCareType}>
                   <Plus className="h-4 w-4" />
                 </Button>
               </div>
             </div>
 
             <div className="space-y-2">
               <Label>Ngày hẹn *</Label>
               <div className="flex gap-2 mb-2">
                 {[7, 15, 30].map(days => (
                   <Button key={days} type="button" variant="outline" size="sm" onClick={() => handleQuickDays(days)}>
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
               <Select value={formData.assignedStaffId} onValueChange={(v) => setFormData(prev => ({ ...prev, assignedStaffId: v }))}>
                 <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                 <SelectContent>
                   {staffList?.map((staff) => (
                     <SelectItem key={staff.user_id} value={staff.user_id}>{staff.display_name}</SelectItem>
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
             <Button onClick={handleCreateSchedule} disabled={createSchedule.isPending}>Tạo lịch</Button>
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
             <div className="bg-muted/50 p-3 rounded-lg">
               <p className="font-medium">{selectedSchedule?.customer?.name}</p>
               <p className="text-sm text-muted-foreground">{selectedSchedule?.care_type_name}</p>
             </div>
             <div className="space-y-2">
               <Label>Kết quả chăm sóc</Label>
               <Textarea
                 value={completeResult}
                 onChange={(e) => setCompleteResult(e.target.value)}
                 placeholder="Mô tả kết quả..."
                 rows={3}
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Hủy</Button>
             <Button onClick={handleComplete} disabled={completeSchedule.isPending}>Hoàn thành</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }