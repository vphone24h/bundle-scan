import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  Popover, PopoverContent, PopoverTrigger 
} from '@/components/ui/popover';
import { UserCircle, Tag, X, Check } from 'lucide-react';
import { useStaffList, useCustomerTags, useBulkAssignStaff, useBulkAssignTag } from '@/hooks/useCRM';
import { toast } from 'sonner';

interface CustomerBulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function CustomerBulkActions({ selectedIds, onClearSelection }: CustomerBulkActionsProps) {
  const { data: staffList } = useStaffList();
  const { data: tags } = useCustomerTags();
  const bulkAssignStaff = useBulkAssignStaff();
  const bulkAssignTag = useBulkAssignTag();
  const [staffOpen, setStaffOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  const count = selectedIds.length;
  if (count === 0) return null;

  const handleAssignStaff = async (staffId: string) => {
    try {
      await bulkAssignStaff.mutateAsync({
        customerIds: selectedIds,
        staffId: staffId === '_none_' ? null : staffId,
      });
      toast.success(`Đã gán nhân viên cho ${count} khách hàng`);
      setStaffOpen(false);
      onClearSelection();
    } catch {
      toast.error('Lỗi gán nhân viên');
    }
  };

  const handleAssignTag = async (tagId: string) => {
    try {
      await bulkAssignTag.mutateAsync({ customerIds: selectedIds, tagId });
      toast.success(`Đã gắn tag cho ${count} khách hàng`);
      setTagOpen(false);
      onClearSelection();
    } catch {
      toast.error('Lỗi gắn tag');
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 px-3 bg-primary/5 border border-primary/20 rounded-lg">
      <Badge variant="secondary" className="shrink-0">
        {count} đã chọn
      </Badge>

      {/* Assign Staff */}
      <Popover open={staffOpen} onOpenChange={setStaffOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
            <UserCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Gán NV</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <p className="text-xs font-medium text-muted-foreground mb-2">Chọn nhân viên</p>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            <button
              className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
              onClick={() => handleAssignStaff('_none_')}
            >
              Bỏ phân công
            </button>
            {staffList?.map(staff => (
              <button
                key={staff.user_id}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                onClick={() => handleAssignStaff(staff.user_id)}
              >
                {staff.display_name}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Assign Tag */}
      <Popover open={tagOpen} onOpenChange={setTagOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
            <Tag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Gắn tag</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <p className="text-xs font-medium text-muted-foreground mb-2">Chọn tag</p>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {tags?.map(tag => (
              <button
                key={tag.id}
                className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-muted"
                onClick={() => handleAssignTag(tag.id)}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
            {(!tags || tags.length === 0) && (
              <p className="text-xs text-muted-foreground p-2">Chưa có tag. Vào Cài đặt để tạo.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 ml-auto"
        onClick={onClearSelection}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
