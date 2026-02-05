 import { useState, useEffect } from 'react';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { useUpsertStaffKPI, type StaffKPISetting } from '@/hooks/useStaffKPI';
 import { toast } from 'sonner';
 import { Loader2 } from 'lucide-react';
 import { formatCurrency } from '@/lib/mockData';
 
 interface KPISettingsDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   userId: string;
   userName: string;
   currentSetting?: StaffKPISetting | null;
 }
 
 export function KPISettingsDialog({
   open,
   onOpenChange,
   userId,
   userName,
   currentSetting,
 }: KPISettingsDialogProps) {
   const [kpiType, setKpiType] = useState<'revenue' | 'orders'>('revenue');
   const [targetValue, setTargetValue] = useState('');
   const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
 
   const upsertKPI = useUpsertStaffKPI();
 
   useEffect(() => {
     if (currentSetting) {
       setKpiType(currentSetting.kpi_type);
       setTargetValue(String(currentSetting.target_value));
       setPeriodType(currentSetting.period_type);
     } else {
       setKpiType('revenue');
       setTargetValue('');
       setPeriodType('monthly');
     }
   }, [currentSetting, open]);
 
   const handleSave = () => {
     const value = parseFloat(targetValue.replace(/[,\.]/g, ''));
     if (isNaN(value) || value <= 0) {
       toast.error('Vui lòng nhập mục tiêu hợp lệ');
       return;
     }
 
     upsertKPI.mutate({
       userId,
       kpiType,
       targetValue: value,
       periodType,
     }, {
       onSuccess: () => {
         toast.success('Đã lưu thiết lập KPI');
         onOpenChange(false);
       },
       onError: (error) => {
         toast.error('Lỗi: ' + (error as Error).message);
       },
     });
   };
 
   const formatInputValue = (value: string) => {
     const num = value.replace(/[^0-9]/g, '');
     if (!num) return '';
     return Number(num).toLocaleString('vi-VN');
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-md">
         <DialogHeader>
           <DialogTitle>Thiết lập KPI</DialogTitle>
           <DialogDescription>
             Đặt mục tiêu KPI cho <strong>{userName}</strong>
           </DialogDescription>
         </DialogHeader>
 
         <div className="space-y-4">
           <div className="space-y-2">
             <Label>Loại KPI</Label>
             <Select value={kpiType} onValueChange={(v) => setKpiType(v as 'revenue' | 'orders')}>
               <SelectTrigger>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="revenue">Theo doanh số (VNĐ)</SelectItem>
                 <SelectItem value="orders">Theo số đơn hàng</SelectItem>
               </SelectContent>
             </Select>
           </div>
 
           <div className="space-y-2">
             <Label>Chu kỳ</Label>
             <Select value={periodType} onValueChange={(v) => setPeriodType(v as 'daily' | 'weekly' | 'monthly')}>
               <SelectTrigger>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="daily">Hàng ngày</SelectItem>
                 <SelectItem value="weekly">Hàng tuần</SelectItem>
                 <SelectItem value="monthly">Hàng tháng</SelectItem>
               </SelectContent>
             </Select>
           </div>
 
           <div className="space-y-2">
             <Label>
               Mục tiêu {kpiType === 'revenue' ? '(VNĐ)' : '(số đơn)'}
             </Label>
             <Input
               type="text"
               placeholder={kpiType === 'revenue' ? '50,000,000' : '100'}
               value={targetValue}
               onChange={(e) => setTargetValue(formatInputValue(e.target.value))}
             />
             {kpiType === 'revenue' && targetValue && (
               <p className="text-xs text-muted-foreground">
                 = {formatCurrency(parseFloat(targetValue.replace(/[,\.]/g, '')) || 0)}
               </p>
             )}
           </div>
         </div>
 
         <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Hủy
           </Button>
           <Button onClick={handleSave} disabled={upsertKPI.isPending}>
             {upsertKPI.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
             Lưu
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }