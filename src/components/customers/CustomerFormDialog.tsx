 import { useEffect, useState } from 'react';
 import { useForm, Controller } from 'react-hook-form';
 import { zodResolver } from '@hookform/resolvers/zod';
 import { z } from 'zod';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import {
   Form,
   FormControl,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
 } from '@/components/ui/form';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { useCreateCustomer } from '@/hooks/useCustomers';
 import { useUpdateCustomer, CustomerWithPoints } from '@/hooks/useCustomerPoints';
 import { useBranches } from '@/hooks/useBranches';
 import { useStaffList, CRM_STATUS_LABELS, CRMStatus } from '@/hooks/useCRM';
 import { toast } from 'sonner';
 import { CustomerSourceSelect } from './CustomerSourceSelect';
 import { CustomerTagSelect } from '@/components/crm/CustomerTagSelect';
 import { ContactChannelInput, ChannelData } from '@/components/crm/ContactChannelInput';
 import { StaffAssignSelect } from '@/components/crm/StaffAssignSelect';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 
 const formSchema = z.object({
   name: z.string().min(1, 'Tên khách hàng là bắt buộc').max(100),
   phone: z.string().min(1, 'Số điện thoại là bắt buộc').max(20),
   email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
   address: z.string().max(500).optional(),
   birthday: z.string().optional(),
   preferred_branch_id: z.string().optional(),
   source: z.string().optional(),
   note: z.string().max(1000).optional(),
   status: z.enum(['active', 'inactive']).optional(),
   crm_status: z.enum(['new', 'caring', 'purchased', 'inactive']).optional(),
   assigned_staff_id: z.string().optional(),
   tag_ids: z.array(z.string()).optional(),
   contact_channels: z.object({
     zalo: z.string().optional(),
     facebook: z.string().optional(),
     tiktok: z.string().optional(),
   }).optional(),
 });
 
 type FormData = z.infer<typeof formSchema>;
 
 interface CustomerFormDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   customer?: CustomerWithPoints | null;
 }
 
 export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
   const { data: branches } = useBranches();
   const { data: staffList } = useStaffList();
   const createCustomer = useCreateCustomer();
   const updateCustomer = useUpdateCustomer();
   const [activeTab, setActiveTab] = useState('basic');
 
   const form = useForm<FormData>({
     resolver: zodResolver(formSchema),
     defaultValues: {
       name: '',
       phone: '',
       email: '',
       address: '',
       birthday: '',
       preferred_branch_id: '_none_',
       source: '',
       note: '',
       status: 'active',
       crm_status: 'new',
       assigned_staff_id: '_none_',
       tag_ids: [],
       contact_channels: {},
     },
   });
 
   useEffect(() => {
     if (customer) {
       form.reset({
         name: customer.name,
         phone: customer.phone,
         email: customer.email || '',
         address: customer.address || '',
         birthday: customer.birthday || '',
         preferred_branch_id: customer.preferred_branch_id || '_none_',
         source: (customer as any).source || '',
         note: customer.note || '',
         status: customer.status,
         crm_status: ((customer as any).crm_status as CRMStatus) || 'new',
         assigned_staff_id: (customer as any).assigned_staff_id || '_none_',
         tag_ids: [],
         contact_channels: {},
       });
     } else {
       form.reset({
         name: '',
         phone: '',
         email: '',
         address: '',
         birthday: '',
         preferred_branch_id: '_none_',
         source: '',
         note: '',
         status: 'active',
         crm_status: 'new',
         assigned_staff_id: '_none_',
         tag_ids: [],
         contact_channels: {},
       });
     }
     setActiveTab('basic');
   }, [customer, form, open]);
 
   const onSubmit = async (data: FormData) => {
     try {
       if (customer) {
         await updateCustomer.mutateAsync({
           id: customer.id,
           name: data.name,
           phone: data.phone,
           email: data.email || null,
           address: data.address || null,
           birthday: data.birthday || null,
           preferred_branch_id: data.preferred_branch_id === '_none_' ? null : data.preferred_branch_id,
           source: data.source || null,
           note: data.note || null,
           status: data.status,
           crm_status: data.crm_status,
           assigned_staff_id: data.assigned_staff_id === '_none_' ? null : data.assigned_staff_id,
         } as any);
         toast.success('Cập nhật khách hàng thành công');
       } else {
         await createCustomer.mutateAsync({
           name: data.name,
           phone: data.phone,
           email: data.email || null,
           address: data.address || null,
           source: data.source || null,
           note: data.note || null,
         });
         toast.success('Thêm khách hàng thành công');
       }
       onOpenChange(false);
     } catch (error: any) {
       toast.error(error.message || 'Có lỗi xảy ra');
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
         <DialogHeader className="flex-shrink-0">
           <DialogTitle>{customer ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}</DialogTitle>
         </DialogHeader>
 
         <Form {...form}>
           <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
               <TabsList className="w-full grid grid-cols-2">
                 <TabsTrigger value="basic">Thông tin</TabsTrigger>
                 <TabsTrigger value="crm">CRM</TabsTrigger>
               </TabsList>
               
               <TabsContent value="basic" className="flex-1 overflow-y-auto space-y-4 pr-1 mt-4">
                 <FormField
                   control={form.control}
                   name="name"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Tên khách hàng *</FormLabel>
                       <FormControl>
                         <Input placeholder="Nhập tên khách hàng" {...field} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
 
                 <FormField
                   control={form.control}
                   name="phone"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Số điện thoại *</FormLabel>
                       <FormControl>
                         <Input placeholder="Nhập số điện thoại" {...field} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
 
                 <FormField
                   control={form.control}
                   name="email"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Email</FormLabel>
                       <FormControl>
                         <Input type="email" placeholder="Nhập email" {...field} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
 
                 <FormField
                   control={form.control}
                   name="source"
                   render={({ field }) => (
                     <FormItem>
                       <FormControl>
                         <CustomerSourceSelect
                           value={field.value || ''}
                           onChange={field.onChange}
                         />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
 
                 <FormField
                   control={form.control}
                   name="birthday"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Ngày sinh</FormLabel>
                       <FormControl>
                         <Input type="date" {...field} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
 
                 <FormField
                   control={form.control}
                   name="preferred_branch_id"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Chi nhánh thường mua</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value}>
                         <FormControl>
                           <SelectTrigger>
                             <SelectValue placeholder="Chọn chi nhánh" />
                           </SelectTrigger>
                         </FormControl>
                         <SelectContent>
                           <SelectItem value="_none_">Không chọn</SelectItem>
                           {branches?.map((branch) => (
                             <SelectItem key={branch.id} value={branch.id}>
                               {branch.name}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
 
                 <FormField
                   control={form.control}
                   name="address"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Địa chỉ</FormLabel>
                       <FormControl>
                         <Input placeholder="Nhập địa chỉ" {...field} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
 
                 <FormField
                   control={form.control}
                   name="note"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Ghi chú</FormLabel>
                       <FormControl>
                         <Textarea placeholder="Ghi chú về khách hàng" {...field} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
               </TabsContent>
 
               <TabsContent value="crm" className="flex-1 overflow-y-auto space-y-4 pr-1 mt-4">
                 <Controller
                   control={form.control}
                   name="assigned_staff_id"
                   render={({ field }) => (
                     <StaffAssignSelect
                       value={field.value === '_none_' ? null : field.value || null}
                       onChange={(v) => field.onChange(v || '_none_')}
                     />
                   )}
                 />
 
                 {customer && (
                   <FormField
                     control={form.control}
                     name="crm_status"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Trạng thái CRM</FormLabel>
                         <Select onValueChange={field.onChange} value={field.value}>
                           <FormControl>
                             <SelectTrigger>
                               <SelectValue />
                             </SelectTrigger>
                           </FormControl>
                           <SelectContent>
                             {Object.entries(CRM_STATUS_LABELS).map(([value, label]) => (
                               <SelectItem key={value} value={value}>{label}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 )}
 
                 <Controller
                   control={form.control}
                   name="tag_ids"
                   render={({ field }) => (
                     <CustomerTagSelect
                       selectedTagIds={field.value || []}
                       onTagsChange={field.onChange}
                     />
                   )}
                 />
 
                 <Controller
                   control={form.control}
                   name="contact_channels"
                   render={({ field }) => (
                     <ContactChannelInput
                       channels={field.value || {}}
                       onChannelsChange={field.onChange}
                     />
                   )}
                 />
 
                 {customer && (
                   <FormField
                     control={form.control}
                     name="status"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Trạng thái hoạt động</FormLabel>
                         <Select onValueChange={field.onChange} value={field.value}>
                           <FormControl>
                             <SelectTrigger>
                               <SelectValue />
                             </SelectTrigger>
                           </FormControl>
                           <SelectContent>
                             <SelectItem value="active">Hoạt động</SelectItem>
                             <SelectItem value="inactive">Ngừng theo dõi</SelectItem>
                           </SelectContent>
                         </Select>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 )}
               </TabsContent>
             </Tabs>
 
             <div className="flex justify-end gap-2 pt-4 flex-shrink-0 border-t mt-4">
               <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                 Hủy
               </Button>
               <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
                 {customer ? 'Cập nhật' : 'Thêm mới'}
               </Button>
             </div>
           </form>
         </Form>
       </DialogContent>
     </Dialog>
   );
 }