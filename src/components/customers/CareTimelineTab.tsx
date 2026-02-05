 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Textarea } from '@/components/ui/textarea';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
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
 import { useCareLogs, useCreateCareLog } from '@/hooks/useCRM';
 import { format } from 'date-fns';
 import { vi } from 'date-fns/locale';
 import { Plus, Phone, MessageCircle, Calendar, FileText, CheckCircle, Mail } from 'lucide-react';
 import { toast } from 'sonner';
 
 const ACTION_TYPES = [
   { value: 'call', label: 'Cuộc gọi', icon: Phone, color: 'bg-blue-100 text-blue-800' },
   { value: 'message', label: 'Tin nhắn', icon: MessageCircle, color: 'bg-green-100 text-green-800' },
   { value: 'email', label: 'Email', icon: Mail, color: 'bg-purple-100 text-purple-800' },
   { value: 'meeting', label: 'Gặp mặt', icon: Calendar, color: 'bg-orange-100 text-orange-800' },
   { value: 'note', label: 'Ghi chú', icon: FileText, color: 'bg-gray-100 text-gray-800' },
   { value: 'task_completed', label: 'Hoàn thành', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-800' },
 ];
 
 interface CareTimelineTabProps {
   customerId: string | null;
   customerName?: string;
   customerPhone?: string;
   customerEmail?: string;
 }
 
 export function CareTimelineTab({ customerId, customerName, customerPhone, customerEmail }: CareTimelineTabProps) {
   const [showAddDialog, setShowAddDialog] = useState(false);
   const [formData, setFormData] = useState({
     actionType: 'call',
     content: '',
     result: '',
   });
 
   const { data: logs, isLoading } = useCareLogs(customerId);
   const createLog = useCreateCareLog();
 
   const handleAddLog = async () => {
     if (!customerId) {
       toast.error('Vui lòng chọn khách hàng từ tab Danh sách');
       return;
     }
     if (!formData.content.trim()) {
       toast.error('Vui lòng nhập nội dung');
       return;
     }
 
     try {
       await createLog.mutateAsync({
         customerId,
         actionType: formData.actionType,
         content: formData.content,
         result: formData.result || undefined,
       });
       toast.success('Đã thêm ghi chú');
       setShowAddDialog(false);
       setFormData({ actionType: 'call', content: '', result: '' });
     } catch (error: any) {
       toast.error(error.message || 'Lỗi');
     }
   };
 
   const getActionConfig = (actionType: string) => {
     return ACTION_TYPES.find(a => a.value === actionType) || ACTION_TYPES[4];
   };
 
   if (!customerId) {
     return (
       <Card>
         <CardContent className="py-12 text-center text-muted-foreground">
           Chọn khách hàng từ tab "Danh sách" để xem nhật ký chăm sóc
         </CardContent>
       </Card>
     );
   }
 
   return (
     <div className="space-y-4">
       {/* Customer Info */}
       <Card>
         <CardContent className="pt-4">
           <div className="flex items-center justify-between">
             <div>
               <h3 className="font-semibold text-lg">{customerName}</h3>
               <p className="text-muted-foreground">{customerPhone}</p>
               {customerEmail && <p className="text-sm text-muted-foreground">{customerEmail}</p>}
             </div>
             <Button onClick={() => setShowAddDialog(true)}>
               <Plus className="h-4 w-4 mr-2" />
               Thêm ghi chú
             </Button>
           </div>
         </CardContent>
       </Card>
 
       {/* Timeline */}
       <Card>
         <CardHeader>
           <CardTitle className="text-base">Lịch sử chăm sóc</CardTitle>
         </CardHeader>
         <CardContent>
           {isLoading ? (
             <p className="text-center py-8 text-muted-foreground">Đang tải...</p>
           ) : logs?.length === 0 ? (
             <p className="text-center py-8 text-muted-foreground">Chưa có lịch sử chăm sóc nào</p>
           ) : (
             <div className="relative">
               <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
               <div className="space-y-6">
                 {logs?.map((log) => {
                   const config = getActionConfig(log.action_type);
                   const Icon = config.icon;
 
                   return (
                     <div key={log.id} className="relative pl-12">
                       <div className={`absolute left-2 w-7 h-7 rounded-full flex items-center justify-center ${config.color}`}>
                         <Icon className="h-3.5 w-3.5" />
                       </div>
                       <div className="bg-muted/50 rounded-lg p-3">
                         <div className="flex items-center justify-between mb-1">
                           <Badge variant="outline" className="text-xs">{config.label}</Badge>
                           <span className="text-xs text-muted-foreground">
                             {format(new Date(log.created_at), 'HH:mm - dd/MM/yyyy', { locale: vi })}
                           </span>
                         </div>
                         <p className="text-sm">{log.content}</p>
                         {log.result && (
                           <p className="text-sm text-muted-foreground mt-1">
                             <span className="font-medium">Kết quả:</span> {log.result}
                           </p>
                         )}
                         {log.staff_name && (
                           <p className="text-xs text-muted-foreground mt-2">NV: {log.staff_name}</p>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}
         </CardContent>
       </Card>
 
       {/* Add Log Dialog */}
       <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Thêm ghi chú chăm sóc</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div className="space-y-2">
               <Label>Loại hoạt động</Label>
               <Select value={formData.actionType} onValueChange={(v) => setFormData(prev => ({ ...prev, actionType: v }))}>
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                   {ACTION_TYPES.filter(t => t.value !== 'task_completed').map((type) => (
                     <SelectItem key={type.value} value={type.value}>
                       <div className="flex items-center gap-2">
                         <type.icon className="h-4 w-4" />
                         {type.label}
                       </div>
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-2">
               <Label>Nội dung *</Label>
               <Textarea
                 value={formData.content}
                 onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                 placeholder="Nội dung cuộc gọi / tin nhắn..."
                 rows={3}
               />
             </div>
 
             <div className="space-y-2">
               <Label>Kết quả (tùy chọn)</Label>
               <Input
                 value={formData.result}
                 onChange={(e) => setFormData(prev => ({ ...prev, result: e.target.value }))}
                 placeholder="Kết quả trao đổi..."
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowAddDialog(false)}>Hủy</Button>
             <Button onClick={handleAddLog} disabled={createLog.isPending}>Thêm</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }