 import { useState } from 'react';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 import { X, Plus, Check, Tag } from 'lucide-react';
 import { useCustomerTags, useCreateCustomerTag, CustomerTag } from '@/hooks/useCRM';
 import { toast } from 'sonner';
 
 const PRESET_COLORS = [
   '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
   '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
   '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
 ];
 
 interface CustomerTagSelectProps {
   selectedTagIds: string[];
   onTagsChange: (tagIds: string[]) => void;
 }
 
 export function CustomerTagSelect({ selectedTagIds, onTagsChange }: CustomerTagSelectProps) {
   const { data: tags } = useCustomerTags();
   const createTag = useCreateCustomerTag();
   
   const [isCreating, setIsCreating] = useState(false);
   const [newTagName, setNewTagName] = useState('');
   const [newTagColor, setNewTagColor] = useState('#3b82f6');
   const [open, setOpen] = useState(false);
 
   const selectedTags = tags?.filter(t => selectedTagIds.includes(t.id)) || [];
 
   const handleToggleTag = (tagId: string) => {
     if (selectedTagIds.includes(tagId)) {
       onTagsChange(selectedTagIds.filter(id => id !== tagId));
     } else {
       onTagsChange([...selectedTagIds, tagId]);
     }
   };
 
   const handleCreateTag = async () => {
     if (!newTagName.trim()) return;
 
     try {
       const newTag = await createTag.mutateAsync({
         name: newTagName.trim(),
         color: newTagColor,
       });
       onTagsChange([...selectedTagIds, newTag.id]);
       setNewTagName('');
       setIsCreating(false);
       toast.success('Đã tạo tag mới');
     } catch (error: any) {
       toast.error(error.message || 'Lỗi tạo tag');
     }
   };
 
   const handleRemoveTag = (tagId: string, e: React.MouseEvent) => {
     e.stopPropagation();
     onTagsChange(selectedTagIds.filter(id => id !== tagId));
   };
 
   return (
     <div className="space-y-2">
       <label className="text-sm font-medium">Gắn thẻ (Tags)</label>
       
       {/* Selected Tags Display */}
       <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 border rounded-md bg-background">
         {selectedTags.length === 0 ? (
           <span className="text-sm text-muted-foreground">Chọn hoặc tạo tag...</span>
         ) : (
           selectedTags.map(tag => (
             <Badge
               key={tag.id}
               style={{ backgroundColor: tag.color }}
               className="text-white gap-1 pr-1"
             >
               {tag.name}
               <button
                 type="button"
                 onClick={(e) => handleRemoveTag(tag.id, e)}
                 className="hover:bg-white/20 rounded p-0.5"
               >
                 <X className="h-3 w-3" />
               </button>
             </Badge>
           ))
         )}
       </div>
 
       {/* Tag Selection Popover */}
       <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
           <Button type="button" variant="outline" size="sm" className="w-full">
             <Tag className="h-4 w-4 mr-2" />
             Chọn hoặc tạo tag
           </Button>
         </PopoverTrigger>
         <PopoverContent className="w-72 p-3" align="start">
           <div className="space-y-3">
             {/* Existing Tags */}
             <div className="space-y-1.5">
               <p className="text-xs font-medium text-muted-foreground">Tags có sẵn</p>
               <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                 {tags?.map(tag => {
                   const isSelected = selectedTagIds.includes(tag.id);
                   return (
                     <Badge
                       key={tag.id}
                       style={{ 
                         backgroundColor: isSelected ? tag.color : 'transparent',
                         borderColor: tag.color,
                         color: isSelected ? 'white' : tag.color,
                       }}
                       variant="outline"
                       className="cursor-pointer gap-1"
                       onClick={() => handleToggleTag(tag.id)}
                     >
                       {isSelected && <Check className="h-3 w-3" />}
                       {tag.name}
                     </Badge>
                   );
                 })}
                 {(!tags || tags.length === 0) && (
                   <p className="text-xs text-muted-foreground">Chưa có tag nào</p>
                 )}
               </div>
             </div>
 
             {/* Create New Tag */}
             {isCreating ? (
               <div className="space-y-2 pt-2 border-t">
                 <Input
                   placeholder="Tên tag mới..."
                   value={newTagName}
                   onChange={(e) => setNewTagName(e.target.value)}
                   className="h-8"
                 />
                 <div className="flex gap-1 flex-wrap">
                   {PRESET_COLORS.map(color => (
                     <button
                       key={color}
                       type="button"
                       className={`w-5 h-5 rounded-full border-2 ${
                         newTagColor === color ? 'border-foreground' : 'border-transparent'
                       }`}
                       style={{ backgroundColor: color }}
                       onClick={() => setNewTagColor(color)}
                     />
                   ))}
                 </div>
                 <div className="flex gap-2">
                   <Button
                     type="button"
                     size="sm"
                     onClick={handleCreateTag}
                     disabled={!newTagName.trim() || createTag.isPending}
                   >
                     Tạo
                   </Button>
                   <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     onClick={() => setIsCreating(false)}
                   >
                     Hủy
                   </Button>
                 </div>
               </div>
             ) : (
               <Button
                 type="button"
                 variant="ghost"
                 size="sm"
                 className="w-full"
                 onClick={() => setIsCreating(true)}
               >
                 <Plus className="h-4 w-4 mr-2" />
                 Tạo tag mới
               </Button>
             )}
           </div>
         </PopoverContent>
       </Popover>
     </div>
   );
 }