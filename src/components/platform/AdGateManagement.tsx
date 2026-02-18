import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Megaphone, Info, Pin, Shuffle, MousePointerClick } from 'lucide-react';
import { useAdGateSettings, useUpdateAdGateSettings } from '@/hooks/useAdGate';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useActiveAdvertisements } from '@/hooks/useAdvertisements';
import { Badge } from '@/components/ui/badge';

export function AdGateManagement() {
  const { data: settings, isLoading } = useAdGateSettings();
  const update = useUpdateAdGateSettings();
  const { data: activeAds } = useActiveAdvertisements();

  const [form, setForm] = useState({
    is_enabled: false,
    display_duration_seconds: 15,
    is_skippable: true,
    skip_after_seconds: 5,
    pinned_ad_id: null as string | null,
    clicks_per_ad: 7,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        is_enabled: settings.is_enabled,
        display_duration_seconds: settings.display_duration_seconds,
        is_skippable: settings.is_skippable,
        skip_after_seconds: settings.skip_after_seconds,
        pinned_ad_id: (settings as any).pinned_ad_id ?? null,
        clicks_per_ad: (settings as any).clicks_per_ad ?? 7,
      });
    }
  }, [settings]);

  const handleSave = () => {
    if (!settings) return;
    update.mutate({ id: settings.id, ...form } as any);
  };

  const pinnedAd = activeAds?.find(a => a.id === form.pinned_ad_id);

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
              {/* Ad Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Pin className="h-4 w-4" />
                  Chọn quảng cáo hiển thị
                </Label>

                {/* Random option */}
                <div
                  onClick={() => setForm({ ...form, pinned_ad_id: null })}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    form.pinned_ad_id === null
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    form.pinned_ad_id === null ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {form.pinned_ad_id === null && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <Shuffle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Ngẫu nhiên</p>
                    <p className="text-xs text-muted-foreground">Tự động chọn từ các quảng cáo đang hoạt động</p>
                  </div>
                </div>

                {/* Specific ad options */}
                {activeAds && activeAds.length > 0 ? (
                  <div className="space-y-2">
                    {activeAds.map((ad) => (
                      <div
                        key={ad.id}
                        onClick={() => setForm({ ...form, pinned_ad_id: ad.id })}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          form.pinned_ad_id === ad.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/30'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          form.pinned_ad_id === ad.id ? 'border-primary' : 'border-muted-foreground'
                        }`}>
                          {form.pinned_ad_id === ad.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        {ad.image_url && (
                          <img
                            src={ad.image_url}
                            alt={ad.title}
                            className="w-12 h-8 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{ad.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs py-0">
                              {ad.ad_type === 'video' ? '🎬 Video' : '🖼️ Banner'}
                            </Badge>
                            {ad.description && (
                              <p className="text-xs text-muted-foreground truncate">{ad.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Chưa có quảng cáo nào đang hoạt động. Vào tab <strong>Quảng cáo</strong> để thêm và bật quảng cáo.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Clicks per ad */}
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4" />
                  Hiển thị quảng cáo sau mỗi: <span className="text-primary font-bold">{form.clicks_per_ad} lần thao tác</span>
                </Label>
                <Slider
                  min={1}
                  max={20}
                  step={1}
                  value={[form.clicks_per_ad]}
                  onValueChange={([v]) => setForm({ ...form, clicks_per_ad: v })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 (mỗi lần)</span>
                  <span>20 lần</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 Khuyến nghị: 5–10 lần để không gây phiền cho người dùng
                </p>
              </div>

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
                <li>• Quảng cáo: <strong>{pinnedAd ? pinnedAd.title : 'Ngẫu nhiên'}</strong></li>
                <li>• Hiện sau mỗi: <strong>{form.clicks_per_ad} lần thao tác</strong></li>
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
