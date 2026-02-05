 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { useStaffList } from '@/hooks/useCRM';
 import { UserCircle } from 'lucide-react';
 
 interface StaffAssignSelectProps {
   value: string | null;
   onChange: (staffId: string | null) => void;
   label?: string;
 }
 
 export function StaffAssignSelect({ value, onChange, label = 'Nhân viên phụ trách' }: StaffAssignSelectProps) {
   const { data: staffList, isLoading } = useStaffList();
 
   return (
     <div className="space-y-2">
       <label className="text-sm font-medium flex items-center gap-2">
         <UserCircle className="h-4 w-4" />
         {label}
       </label>
       <Select
         value={value || '_none_'}
         onValueChange={(v) => onChange(v === '_none_' ? null : v)}
         disabled={isLoading}
       >
         <SelectTrigger>
           <SelectValue placeholder="Chọn nhân viên..." />
         </SelectTrigger>
         <SelectContent>
           <SelectItem value="_none_">Chưa phân công</SelectItem>
           {staffList?.map((staff) => (
             <SelectItem key={staff.user_id} value={staff.user_id}>
               {staff.display_name || 'Nhân viên'} 
               {staff.user_role === 'super_admin' && ' (Admin)'}
               {staff.user_role === 'branch_admin' && ' (QL)'}
             </SelectItem>
           ))}
         </SelectContent>
       </Select>
     </div>
   );
 }