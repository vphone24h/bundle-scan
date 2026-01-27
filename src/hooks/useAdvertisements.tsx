import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePlatformUser } from '@/hooks/useTenant';

export interface Advertisement {
  id: string;
  tenant_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string;
  display_order: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  click_count: number;
  view_count: number;
  ad_type: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateAdvertisementData {
  title: string;
  description?: string;
  image_url?: string;
  link_url: string;
  display_order?: number;
  is_active?: boolean;
  start_date?: string;
  end_date?: string | null;
  ad_type?: string;
}

// Hook để lấy danh sách quảng cáo (cho admin)
export function useAdvertisements() {
  const { data: platformUser } = usePlatformUser();

  return useQuery({
    queryKey: ['advertisements', platformUser?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Advertisement[];
    },
    enabled: !!platformUser?.tenant_id,
  });
}

// Hook để lấy quảng cáo đang hoạt động (cho user)
export function useActiveAdvertisements() {
  return useQuery({
    queryKey: ['active-advertisements'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Advertisement[];
    },
  });
}

// Hook tạo quảng cáo mới
export function useCreateAdvertisement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: platformUser } = usePlatformUser();

  return useMutation({
    mutationFn: async (data: CreateAdvertisementData) => {
      const { data: result, error } = await supabase
        .from('advertisements')
        .insert({
          ...data,
          tenant_id: platformUser?.tenant_id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      toast({ title: 'Thành công', description: 'Đã thêm quảng cáo mới' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

// Hook cập nhật quảng cáo
export function useUpdateAdvertisement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Advertisement> & { id: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      toast({ title: 'Thành công', description: 'Đã cập nhật quảng cáo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

// Hook xóa quảng cáo
export function useDeleteAdvertisement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      toast({ title: 'Thành công', description: 'Đã xóa quảng cáo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

// Hook toggle trạng thái quảng cáo
export function useToggleAdvertisement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('advertisements')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

// Hook cập nhật thứ tự hiển thị
export function useReorderAdvertisements() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        display_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('advertisements')
          .update({ display_order: update.display_order })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });
}

// Hook ghi nhận click
export function useTrackAdvertisementClick() {
  return useMutation({
    mutationFn: async (id: string) => {
      // Lấy click count hiện tại và tăng lên
      const { data: ad } = await supabase
        .from('advertisements')
        .select('click_count')
        .eq('id', id)
        .single();
      
      if (ad) {
        await supabase
          .from('advertisements')
          .update({ click_count: (ad.click_count || 0) + 1 })
          .eq('id', id);
      }
    },
  });
}

// Hook upload ảnh quảng cáo
export function useUploadAdImage() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `ads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('minigame-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('minigame-assets')
        .getPublicUrl(filePath);

      return publicUrl;
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi upload', description: error.message, variant: 'destructive' });
    },
  });
}
