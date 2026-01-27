import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  MoreVertical, 
  Pencil, 
  Trash2, 
  GripVertical, 
  ExternalLink,
  Eye,
  MousePointer,
  Calendar,
} from 'lucide-react';
import { 
  Advertisement, 
  useDeleteAdvertisement, 
  useToggleAdvertisement,
  useReorderAdvertisements,
} from '@/hooks/useAdvertisements';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface AdvertisementListProps {
  advertisements: Advertisement[];
  onEdit: (ad: Advertisement) => void;
}

export function AdvertisementList({ advertisements, onEdit }: AdvertisementListProps) {
  const isMobile = useIsMobile();
  const deleteAd = useDeleteAdvertisement();
  const toggleAd = useToggleAdvertisement();
  const reorderAds = useReorderAdvertisements();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      deleteAd.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggle = (id: string, currentState: boolean) => {
    toggleAd.mutate({ id, is_active: !currentState });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const currentOrder = advertisements.map(a => a.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    currentOrder.splice(draggedIndex, 1);
    currentOrder.splice(targetIndex, 0, draggedId);

    reorderAds.mutate(currentOrder);
    setDraggedId(null);
  };

  const isAdActive = (ad: Advertisement) => {
    if (!ad.is_active) return false;
    const now = new Date();
    const startDate = new Date(ad.start_date);
    const endDate = ad.end_date ? new Date(ad.end_date) : null;
    return startDate <= now && (!endDate || endDate >= now);
  };

  if (advertisements.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <p>Chưa có quảng cáo nào</p>
        <p className="text-sm">Bấm "Thêm quảng cáo" để bắt đầu</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {advertisements.map((ad) => (
          <Card
            key={ad.id}
            draggable
            onDragStart={(e) => handleDragStart(e, ad.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, ad.id)}
            className={`transition-all ${draggedId === ad.id ? 'opacity-50' : ''} ${
              !isAdActive(ad) ? 'opacity-60' : ''
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Drag handle */}
                <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground pt-1">
                  <GripVertical className="h-5 w-5" />
                </div>

                {/* Image thumbnail */}
                <div className="w-20 h-14 sm:w-32 sm:h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  {ad.image_url ? (
                    <img
                      src={ad.image_url}
                      alt={ad.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="text-xs font-medium text-primary">No Image</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{ad.title}</h3>
                        <Badge variant={isAdActive(ad) ? 'default' : 'secondary'}>
                          {isAdActive(ad) ? 'Đang hiển thị' : 'Ẩn'}
                        </Badge>
                        {ad.ad_type === 'internal' && (
                          <Badge variant="outline">Nội bộ</Badge>
                        )}
                      </div>
                      {ad.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {ad.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={ad.is_active}
                        onCheckedChange={() => handleToggle(ad.id, ad.is_active)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.open(ad.link_url, '_blank')}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Xem link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(ad)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteId(ad.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Stats & Date */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      <span>{ad.view_count} lượt xem</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MousePointer className="h-3 w-3" />
                      <span>{ad.click_count} lượt click</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {format(new Date(ad.start_date), 'dd/MM/yyyy', { locale: vi })}
                        {ad.end_date && ` - ${format(new Date(ad.end_date), 'dd/MM/yyyy', { locale: vi })}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa quảng cáo?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Quảng cáo sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
