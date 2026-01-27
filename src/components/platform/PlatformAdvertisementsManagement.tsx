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
  Plus,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdvertisementFormDialog } from '@/components/advertisements/AdvertisementFormDialog';
import { Advertisement } from '@/hooks/useAdvertisements';

// Hook để lấy tất cả quảng cáo (cho platform admin)
function useAllAdvertisements() {
  return useQuery({
    queryKey: ['all-advertisements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Advertisement[];
    },
  });
}

export function PlatformAdvertisementsManagement() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: ads, isLoading } = useAllAdvertisements();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('advertisements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-advertisements'] });
      toast({ title: 'Thành công', description: 'Đã xóa quảng cáo' });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('advertisements').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-advertisements'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from('advertisements')
          .update({ display_order: i })
          .eq('id', orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-advertisements'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  const handleToggle = (id: string, currentState: boolean) => {
    toggleMutation.mutate({ id, is_active: !currentState });
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
    if (!draggedId || draggedId === targetId || !ads) return;

    const currentOrder = ads.map(a => a.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    currentOrder.splice(draggedIndex, 1);
    currentOrder.splice(targetIndex, 0, draggedId);

    reorderMutation.mutate(currentOrder);
    setDraggedId(null);
  };

  const isAdActive = (ad: Advertisement) => {
    if (!ad.is_active) return false;
    const now = new Date();
    const startDate = new Date(ad.start_date);
    const endDate = ad.end_date ? new Date(ad.end_date) : null;
    return startDate <= now && (!endDate || endDate >= now);
  };

  const handleCreate = () => {
    setEditingAd(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingAd(null);
    queryClient.invalidateQueries({ queryKey: ['all-advertisements'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Quản lý Quảng Cáo</h2>
          <p className="text-sm text-muted-foreground">
            Tổng cộng: {ads?.length || 0} quảng cáo
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Thêm quảng cáo
        </Button>
      </div>

      {/* List */}
      {!ads || ads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <p>Chưa có quảng cáo nào</p>
          <p className="text-sm">Bấm "Thêm quảng cáo" để bắt đầu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
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

                  {/* Image thumbnail - Facebook-like aspect ratio */}
                  <div className="w-24 h-16 sm:w-40 sm:h-24 rounded-md overflow-hidden bg-muted flex-shrink-0">
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
                          {ad.ad_type === 'internal' ? (
                            <Badge variant="outline">Nội bộ</Badge>
                          ) : (
                            <Badge variant="outline" className="border-primary text-primary">Đối tác</Badge>
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
                            <DropdownMenuItem onClick={() => handleEdit(ad)}>
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
      )}

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

      {/* Form Dialog */}
      <AdvertisementFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        advertisement={editingAd}
        onClose={handleClose}
        isPlatformAdmin={true}
      />
    </div>
  );
}
