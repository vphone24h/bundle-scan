 import { useState, useMemo } from 'react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
 import { Checkbox } from '@/components/ui/checkbox';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { useCustomers } from '@/hooks/useCustomers';
 import { Search, X, Users } from 'lucide-react';
 
 interface SelectedCustomer {
   id: string;
   name: string;
   phone: string;
 }
 
 interface CustomerMultiSelectProps {
   selectedCustomers: SelectedCustomer[];
   onSelectionChange: (customers: SelectedCustomer[]) => void;
 }
 
 export function CustomerMultiSelect({ selectedCustomers, onSelectionChange }: CustomerMultiSelectProps) {
   const [searchQuery, setSearchQuery] = useState('');
   const { data: customers, isLoading } = useCustomers();
 
   const filteredCustomers = useMemo(() => {
     if (!customers) return [];
     const query = searchQuery.toLowerCase().trim();
     if (!query) return customers.slice(0, 50); // Show first 50 if no search
     return customers.filter(c =>
       c.name.toLowerCase().includes(query) || c.phone.includes(query)
     ).slice(0, 50);
   }, [customers, searchQuery]);
 
   const handleToggle = (customer: { id: string; name: string; phone: string }) => {
     const isSelected = selectedCustomers.some(c => c.id === customer.id);
     if (isSelected) {
       onSelectionChange(selectedCustomers.filter(c => c.id !== customer.id));
     } else {
       onSelectionChange([...selectedCustomers, customer]);
     }
   };
 
   const handleRemove = (id: string) => {
     onSelectionChange(selectedCustomers.filter(c => c.id !== id));
   };
 
   return (
     <div className="space-y-3">
       {/* Selected customers badges */}
       {selectedCustomers.length > 0 && (
         <div className="flex flex-wrap gap-1.5">
           {selectedCustomers.map(c => (
             <Badge key={c.id} variant="secondary" className="text-xs py-1 pr-1 gap-1">
               {c.name}
               <button
                 type="button"
                 onClick={() => handleRemove(c.id)}
                 className="ml-1 hover:bg-muted rounded-full p-0.5"
               >
                 <X className="h-3 w-3" />
               </button>
             </Badge>
           ))}
         </div>
       )}
 
       {/* Search */}
       <div className="relative">
         <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
         <Input
           placeholder="Tìm theo tên hoặc SĐT..."
           value={searchQuery}
           onChange={(e) => setSearchQuery(e.target.value)}
           className="pl-9 h-9 text-base search-input-highlight"
         />
       </div>
 
       {/* Customer list */}
       <ScrollArea className="h-[200px] border rounded-md">
         {isLoading ? (
           <div className="p-4 text-center text-sm text-muted-foreground">Đang tải...</div>
         ) : filteredCustomers.length === 0 ? (
           <div className="p-4 text-center text-sm text-muted-foreground">
             {searchQuery ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng'}
           </div>
         ) : (
           <div className="divide-y">
             {filteredCustomers.map(customer => {
               const isSelected = selectedCustomers.some(c => c.id === customer.id);
               return (
                 <label
                   key={customer.id}
                   className="flex items-center gap-3 p-2.5 hover:bg-muted/50 cursor-pointer"
                 >
                   <Checkbox
                     checked={isSelected}
                     onCheckedChange={() => handleToggle(customer)}
                   />
                   <div className="flex-1 min-w-0">
                     <p className="font-medium text-sm truncate">{customer.name}</p>
                     <p className="text-xs text-muted-foreground">{customer.phone}</p>
                   </div>
                 </label>
               );
             })}
           </div>
         )}
       </ScrollArea>
 
       {/* Selection summary */}
       <div className="flex items-center gap-2 text-xs text-muted-foreground">
         <Users className="h-3.5 w-3.5" />
         <span>Đã chọn: {selectedCustomers.length} khách hàng</span>
       </div>
     </div>
   );
 }