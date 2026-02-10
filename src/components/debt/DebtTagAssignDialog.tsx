import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useDebtTags, useDebtTagAssignments, useAssignDebtTag, useRemoveDebtTag } from '@/hooks/useDebtTags';
import { toast } from '@/hooks/use-toast';
import { Hash, Check } from 'lucide-react';

interface DebtTagAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityType: 'customer' | 'supplier';
  entityName: string;
}

export function DebtTagAssignDialog({ open, onOpenChange, entityId, entityType, entityName }: DebtTagAssignDialogProps) {
  const { data: tags } = useDebtTags();
  const { data: assignments } = useDebtTagAssignments(entityType);
  const assignTag = useAssignDebtTag();
  const removeTag = useRemoveDebtTag();

  const entityAssignments = assignments?.filter(a => a.entity_id === entityId) || [];
  const assignedTagIds = new Set(entityAssignments.map(a => a.tag_id));

  const handleToggle = async (tagId: string) => {
    try {
      if (assignedTagIds.has(tagId)) {
        await removeTag.mutateAsync({ tagId, entityId, entityType });
        toast({ title: 'Đã gỡ hashtag' });
      } else {
        await assignTag.mutateAsync({ tag_id: tagId, entity_id: entityId, entity_type: entityType });
        toast({ title: 'Đã gắn hashtag' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Hash className="h-4 w-4" />
            Gắn hashtag — {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {(!tags || tags.length === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Chưa có hashtag. Hãy tạo hashtag trước.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isAssigned = assignedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggle(tag.id)}
                    disabled={assignTag.isPending || removeTag.isPending}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant="outline"
                      className={`cursor-pointer gap-1 transition-all text-white border-0 ${isAssigned ? 'ring-2 ring-offset-1 ring-foreground/30' : 'opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: tag.color }}
                    >
                      {isAssigned && <Check className="h-3 w-3" />}
                      #{tag.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
