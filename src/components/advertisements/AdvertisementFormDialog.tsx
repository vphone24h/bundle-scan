import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Upload, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Advertisement,
  useUploadAdImage,
} from '@/hooks/useAdvertisements';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePlatformUser } from '@/hooks/useTenant';

interface AdvertisementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advertisement: Advertisement | null;
  onClose: () => void;
  isPlatformAdmin?: boolean;
}

export function AdvertisementFormDialog({
  open,
  onOpenChange,
  advertisement,
  onClose,
  isPlatformAdmin = false,
}: AdvertisementFormDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: platformUser } = usePlatformUser();
  const uploadImage = useUploadAdImage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [adType, setAdType] = useState('banner');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [hasEndDate, setHasEndDate] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase
        .from('advertisements')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      toast({ title: 'Thành công', description: 'Đã thêm quảng cáo mới' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { data: result, error } = await supabase
        .from('advertisements')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      toast({ title: 'Thành công', description: 'Đã cập nhật quảng cáo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (advertisement) {
      setTitle(advertisement.title);
      setDescription(advertisement.description || '');
      setLinkUrl(advertisement.link_url);
      setImageUrl(advertisement.image_url || '');
      setVideoUrl((advertisement as any).video_url || '');
      setIsActive(advertisement.is_active);
      setAdType(advertisement.ad_type || 'banner');
      setStartDate(new Date(advertisement.start_date));
      if (advertisement.end_date) {
        setEndDate(new Date(advertisement.end_date));
        setHasEndDate(true);
      } else {
        setEndDate(undefined);
        setHasEndDate(false);
      }
    } else {
      resetForm();
    }
  }, [advertisement, open]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLinkUrl('');
    setImageUrl('');
    setVideoUrl('');
    setIsActive(true);
    setAdType('banner');
    setStartDate(new Date());
    setEndDate(undefined);
    setHasEndDate(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Lỗi', description: 'Ảnh phải nhỏ hơn 5MB', variant: 'destructive' });
      return;
    }

    const url = await uploadImage.mutateAsync(file);
    setImageUrl(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      title,
      description: description || null,
      link_url: linkUrl,
      image_url: imageUrl || null,
      video_url: videoUrl || null,
      is_active: isActive,
      ad_type: adType,
      start_date: startDate.toISOString(),
      end_date: hasEndDate && endDate ? endDate.toISOString() : null,
      tenant_id: isPlatformAdmin ? null : platformUser?.tenant_id,
    };

    if (advertisement) {
      await updateMutation.mutateAsync({ id: advertisement.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }

    onClose();
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {advertisement ? 'Chỉnh sửa quảng cáo' : 'Thêm quảng cáo mới'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Tên quảng cáo *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Ứng dụng ABC"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về quảng cáo"
              rows={3}
            />
          </div>

          {/* Image Upload - Facebook-like aspect ratio (1.91:1) */}
          <div className="space-y-2">
            <Label>Ảnh banner (Tỷ lệ như Facebook: 1200x628)</Label>
            {imageUrl ? (
              <div className="relative">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full aspect-[1.91/1] object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => setImageUrl('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full aspect-[1.91/1] border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadImage.isPending}
                />
                {uploadImage.isPending ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground text-center px-4">
                      Bấm để upload ảnh (tối đa 5MB)
                      <br />
                      <span className="text-xs">Khuyến nghị: 1200x628 pixels</span>
                    </span>
                  </>
                )}
              </label>
            )}
          </div>

          {/* Link URL */}
          <div className="space-y-2">
            <Label htmlFor="linkUrl">Link dẫn *</Label>
            <Input
              id="linkUrl"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              required
            />
          </div>

          {/* Ad Type */}
          <div className="space-y-2">
            <Label>Loại quảng cáo</Label>
            <Select value={adType} onValueChange={setAdType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="banner">🖼️ Banner (ảnh + link)</SelectItem>
                <SelectItem value="video">🎬 Video (chèn link video)</SelectItem>
                <SelectItem value="partner">Đối tác</SelectItem>
                <SelectItem value="internal">Nội bộ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Video URL - show when type is video */}
          {adType === 'video' && (
            <div className="space-y-2">
              <Label htmlFor="videoUrl">Link video *</Label>
              <Input
                id="videoUrl"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
              />
              <p className="text-xs text-muted-foreground">
                Hỗ trợ link trực tiếp đến file video (.mp4, .webm). Không hỗ trợ YouTube/Vimeo embed.
              </p>
            </div>
          )}

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Ngày bắt đầu</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, 'dd/MM/yyyy', { locale: vi })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ngày kết thúc</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Có thời hạn</span>
                <Switch checked={hasEndDate} onCheckedChange={setHasEndDate} />
              </div>
            </div>
            {hasEndDate && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy', { locale: vi }) : 'Chọn ngày'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => date < startDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Is Active */}
          <div className="flex items-center justify-between">
            <Label>Trạng thái hiển thị</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {advertisement ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
