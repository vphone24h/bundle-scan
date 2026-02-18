import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Megaphone, Info } from 'lucide-react';
import { useAdGateSettings, useUpdateAdGateSettings } from '@/hooks/useAdGate';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function AdGateManagement() {
  const { data: settings, isLoading } = useAdGateSettings();
  const update = useUpdateAdGateSettings();

  const [form, setForm] = useState({
    is_enabled: false,
    display_duration_seconds: 15,
    is_skippable: true,
    skip_after_seconds: 5,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        is_enabled: settings.is_enabled,
        display_duration_seconds: settings.display_duration_seconds,
        is_skippable: settings.is_skippable,
        skip_after_seconds: settings.skip_after_seconds,
      });
    }
  }, [settings]);

  const handleSave = () => {
    if (!settings) return;
    update.mutate({ id: settings.id, ...form });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Chế độ Quảng cáo khi hết hạn
          </CardTitle>
          <CardDescription>
            Khi bật: người dùng hết hạn vẫn dùng được nhưng phải xem quảng cáo mỗi thao tác.<br />
            Khi tắt: người dùng hết hạn bị chặn và bắt buộc mua gói (hành vi cũ).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div>
              <p className="font-semibold">Bật chế độ Quảng cáo</p>
              <p className="text-sm text-muted-foreground">
                {form.is_enabled
                  ? '✅ Người dùng hết hạn sẽ xem quảng cáo thay vì bị chặn'
                  : '🔒 Người dùng hết hạn bị chặn, yêu cầu mua gói'}
              </p>
            </div>
            <Switch
              checked={form.is_enabled}
              onCheckedChange={(v) => setForm({ ...form, is_enabled: v })}
            />
          </div>

          {form.is_enabled && (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Quảng cáo sẽ lấy từ danh sách quảng cáo đang hoạt động ở tab <strong>Quảng cáo</strong>. Cần có ít nhất 1 quảng cáo đang bật để hiển thị.
                </AlertDescription>
              </Alert>

              {/* Duration */}
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Thời gian hiển thị quảng cáo: <span className="text-primary font-bold">{form.display_duration_seconds}s</span>
                </Label>
                <Slider
                  min={5}
                  max={60}
                  step={5}
                  value={[form.display_duration_seconds]}
                  onValueChange={([v]) => setForm({ ...form, display_duration_seconds: v })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5 giây</span>
                  <span>60 giây</span>
                </div>
              </div>

              {/* Skippable */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Cho phép bỏ qua quảng cáo</p>
                  <p className="text-xs text-muted-foreground">Hiện nút "Bỏ qua" sau một khoảng thời gian</p>
                </div>
                <Switch
                  checked={form.is_skippable}
                  onCheckedChange={(v) => setForm({ ...form, is_skippable: v })}
                />
              </div>

              {form.is_skippable && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    Hiện nút "Bỏ qua" sau: <span className="text-primary font-bold">{form.skip_after_seconds}s</span>
                  </Label>
                  <Slider
                    min={3}
                    max={Math.min(30, form.display_duration_seconds - 1)}
                    step={1}
                    value={[form.skip_after_seconds]}
                    onValueChange={([v]) => setForm({ ...form, skip_after_seconds: v })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>3 giây</span>
                    <span>{Math.min(30, form.display_duration_seconds - 1)} giây</span>
                  </div>
                </div>
              )}
            </>
          )}

          <Button onClick={handleSave} disabled={update.isPending} className="w-full">
            {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Lưu cài đặt
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-2">📋 Tóm tắt cấu hình hiện tại:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Chế độ: <strong>{form.is_enabled ? 'Quảng cáo (người dùng có thể xem miễn phí)' : 'Chặn (bắt buộc mua gói)'}</strong></li>
            {form.is_enabled && (
              <>
                <li>• Thời gian xem: <strong>{form.display_duration_seconds} giây</strong></li>
                <li>• Bỏ qua: <strong>{form.is_skippable ? `Sau ${form.skip_after_seconds}s` : 'Không cho phép'}</strong></li>
              </>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
