import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string | null;
  name?: string;
}

export function AvatarPreviewDialog({ open, onOpenChange, imageUrl, name }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-2 flex items-center justify-center bg-black/90 border-none">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name || 'Avatar'}
            className="w-full max-h-[80vh] object-contain rounded-lg"
          />
        ) : (
          <Avatar className="h-64 w-64">
            <AvatarFallback className="text-6xl">{(name || 'U')[0]}</AvatarFallback>
          </Avatar>
        )}
      </DialogContent>
    </Dialog>
  );
}
