import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Bot, Image as ImageIcon, Loader2, Save } from 'lucide-react';

export function PlatformAISettings() {
  const queryClient = useQueryClient();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [imageEnabled, setImageEnabled] = useState(true);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setAiEnabled(settings.ai_description_enabled);
      setImageEnabled(settings.auto_image_enabled);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('platform_settings')
        .update({
          ai_description_enabled: aiEnabled,
          auto_image_enabled: imageEnabled,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', settings!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast({ title: 'Đã lưu cài đặt AI' });
    },
    onError: () => {
      toast({ title: 'Lỗi khi lưu', variant: 'destructive' });
    },
  });

  const hasChanges = settings && (aiEnabled !== settings.ai_description_enabled || imageEnabled !== settings.auto_image_enabled);

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          Cài đặt AI tự động (toàn hệ thống)
        </CardTitle>
        <CardDescription>
          Bật/tắt tính năng AI khi thêm sản phẩm từ kho lên website — áp dụng cho tất cả cửa hàng
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              AI tự viết mô tả sản phẩm
            </Label>
            <p className="text-xs text-muted-foreground">Tự động tạo mô tả chuyên nghiệp, SEO title, SEO description bằng AI</p>
          </div>
          <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Tự động lấy ảnh sản phẩm
            </Label>
            <p className="text-xs text-muted-foreground">Lấy ảnh có sẵn từ kho khi nhập sản phẩm lên website</p>
          </div>
          <Switch checked={imageEnabled} onCheckedChange={setImageEnabled} />
        </div>
        {hasChanges && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gap-2">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu cài đặt
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
