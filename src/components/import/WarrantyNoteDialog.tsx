 import { useState } from 'react';
 import { Wrench } from 'lucide-react';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 
 interface WarrantyNoteDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onConfirm: (note: string) => void;
   productName?: string;
   isLoading?: boolean;
 }
 
 export function WarrantyNoteDialog({
   open,
   onOpenChange,
   onConfirm,
   productName,
   isLoading,
 }: WarrantyNoteDialogProps) {
   const [note, setNote] = useState('');
 
   const handleConfirm = () => {
     onConfirm(note);
     setNote('');
   };
 
   const handleClose = () => {
     setNote('');
     onOpenChange(false);
   };
 
   return (
     <Dialog open={open} onOpenChange={handleClose}>
       <DialogContent className="max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Wrench className="h-5 w-5 text-warning" />
             Chuyển sang bảo hành
           </DialogTitle>
         </DialogHeader>
 
         <div className="space-y-4">
           {productName && (
             <p className="text-sm text-muted-foreground">
               Sản phẩm: <span className="font-medium text-foreground">{productName}</span>
             </p>
           )}
           
           <div className="space-y-2">
             <Label htmlFor="warranty-note">Ghi chú bảo hành</Label>
             <Textarea
               id="warranty-note"
               value={note}
               onChange={(e) => setNote(e.target.value)}
               placeholder="Ai tiếp nhận, lý do bảo hành..."
               rows={3}
               autoFocus
             />
           </div>
         </div>
 
         <DialogFooter className="gap-2 sm:gap-0">
           <Button variant="outline" onClick={handleClose} disabled={isLoading}>
             Hủy
           </Button>
           <Button onClick={handleConfirm} disabled={isLoading}>
             {isLoading ? 'Đang xử lý...' : 'Xác nhận'}
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }