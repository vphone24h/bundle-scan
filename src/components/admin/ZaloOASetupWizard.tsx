import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageCircle, ExternalLink, CheckCircle2,
  Loader2, AlertTriangle, Zap, Unplug, RefreshCw, Eye, EyeOff,
  Shield, Key, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ZaloOASetupWizardProps {
  formData: any;
  handleChange: (field: string, value: any) => void;
  tenantId: string | null;
  onSave?: () => void;
}

export function ZaloOASetupWizard({ formData, handleChange, tenantId, onSave }: ZaloOASetupWizardProps) {
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasOAId = !!formData.zalo_oa_id?.trim();
  const hasToken = !!formData.zalo_access_token?.trim();
  const isConnected = hasOAId && hasToken;

  const handleTest = async () => {
    if (!isConnected || !tenantId) {
      toast.error('Vui lòng nhập OA ID và Access Token trước');
      return;
    }

    // Save first
    if (onSave) onSave();

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-zalo-message', {
        body: {
          tenant_id: tenantId,
          customer_name: 'Test',
          customer_phone: formData.store_phone || '0123456789',
          message_type: 'test',
        },
      });
      if (error) throw new Error(data?.details || data?.error || error.message);
      if (data?.error) throw new Error(data.details || data.error);
      toast.success('✅ Đã gửi tin nhắn test thành công!');
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Không xác định'));
    } finally {
      setTesting(false);
    }
  };

  const handleRefreshToken = async () => {
    if (!tenantId) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('zalo-oauth-callback', {
        body: { action: 'refresh_token', tenant_id: tenantId },
      });
      if (error) throw new Error(data?.details || error.message);
      if (data?.error) throw new Error(data.details || data.error);
      toast.success('✅ Đã gia hạn token thành công!');
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Không xác định'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = () => {
    if (!confirm('Bạn có chắc muốn ngắt kết nối Zalo OA?')) return;
    handleChange('zalo_access_token', '');
    handleChange('zalo_oa_id', '');
    handleChange('zalo_enabled', false);
    handleChange('zalo_app_id', '');
    handleChange('zalo_app_secret', '');
    handleChange('zalo_refresh_token', '');
    handleChange('zalo_zns_template_id', '');
    if (onSave) onSave();
    toast.success('Đã ngắt kết nối Zalo OA');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Zalo OA + ZNS</Label>
            <p className="text-[11px] text-muted-foreground">Gửi tin nhắn tự động cho mọi khách hàng (không cần follow)</p>
          </div>
        </div>
        {isConnected ? (
          <Badge className="bg-green-500/10 text-green-700 border-green-500/20 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Đã kết nối
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <Unplug className="h-3 w-3" /> Chưa kết nối
          </Badge>
        )}
      </div>

      {/* Setup Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-xs">
            <p className="font-medium">📋 Hướng dẫn lấy thông tin:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>
                Truy cập{' '}
                <a href="https://oa.zalo.me" target="_blank" rel="noopener noreferrer"
                   className="text-primary font-medium underline underline-offset-2 inline-flex items-center gap-0.5">
                  oa.zalo.me <ExternalLink className="h-3 w-3" />
                </a>{' '}
                → Copy <strong>OA ID</strong> từ trang quản lý OA
              </li>
              <li>
                Truy cập{' '}
                <a href="https://developers.zalo.me/tools/explorer" target="_blank" rel="noopener noreferrer"
                   className="text-primary font-medium underline underline-offset-2 inline-flex items-center gap-0.5">
                  API Explorer <ExternalLink className="h-3 w-3" />
                </a>{' '}
                → Chọn <strong>OA Access Token</strong> → Copy token
              </li>
              <li>
                (Để gửi cho khách chưa follow) Vào{' '}
                <a href="https://zns.zalo.me" target="_blank" rel="noopener noreferrer"
                   className="text-primary font-medium underline underline-offset-2 inline-flex items-center gap-0.5">
                  ZNS Console <ExternalLink className="h-3 w-3" />
                </a>{' '}
                → Tạo template → Copy <strong>Template ID</strong>
              </li>
            </ol>
          </div>

          {/* OA ID */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">OA ID</Label>
            <Input
              value={formData.zalo_oa_id || ''}
              onChange={e => handleChange('zalo_oa_id', e.target.value)}
              placeholder="Dán OA ID tại đây..."
              className="text-sm font-mono"
            />
          </div>

          {/* Access Token */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">OA Access Token</Label>
            <div className="relative">
              <Input
                value={formData.zalo_access_token || ''}
                onChange={e => handleChange('zalo_access_token', e.target.value)}
                placeholder="Dán Access Token tại đây..."
                type={showToken ? 'text' : 'password'}
                className="text-sm font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* App ID & Secret (for refresh token) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              App ID <span className="text-muted-foreground font-normal">(tùy chọn - dùng để gia hạn token tự động)</span>
            </Label>
            <Input
              value={formData.zalo_app_id || ''}
              onChange={e => handleChange('zalo_app_id', e.target.value)}
              placeholder="App ID từ developers.zalo.me"
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              Secret Key <span className="text-muted-foreground font-normal">(tùy chọn)</span>
            </Label>
            <div className="relative">
              <Input
                value={formData.zalo_app_secret || ''}
                onChange={e => handleChange('zalo_app_secret', e.target.value)}
                placeholder="Secret Key từ developers.zalo.me"
                type={showSecret ? 'text' : 'password'}
                className="text-sm font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Separator />

          {/* ZNS Template ID */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-primary" />
              ZNS Template ID
              <span className="text-muted-foreground font-normal">(gửi cho khách chưa follow)</span>
            </Label>
            <Input
              value={(formData as any).zalo_zns_template_id || ''}
              onChange={e => handleChange('zalo_zns_template_id', e.target.value)}
              placeholder="Template ID từ ZNS Console..."
              className="text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              ZNS cho phép gửi tin nhắn đến SĐT khách hàng mà không cần họ follow OA. Template phải được Zalo phê duyệt trước.
            </p>
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 rounded-lg border border-muted p-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground">
              Thông tin được lưu trữ an toàn. Chỉ dùng để gửi tin nhắn qua Zalo API.
            </p>
          </div>

          {/* Warning about token expiry */}
          {isConnected && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-900/10 p-2.5">
              <p className="text-[11px] text-yellow-700 dark:text-yellow-400 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Access Token có hạn sử dụng. Nếu token hết hạn, hãy lấy token mới từ API Explorer hoặc nhấn "Gia hạn token" (cần có App ID + Secret Key).
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions when connected */}
      {isConnected && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Auto-send Settings */}
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Tự động gửi tin nhắn khi:
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <Label className="text-xs">Khách đặt hàng trên website</Label>
                </div>
                <Badge variant="secondary" className="text-[10px]">Luôn bật</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${formData.zalo_on_export ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  <Label className="text-xs">Xuất hàng (bán hàng)</Label>
                </div>
                <Switch
                  checked={formData.zalo_on_export ?? false}
                  onCheckedChange={checked => handleChange('zalo_on_export', checked)}
                />
              </div>
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 flex-1"
                disabled={testing}
                onClick={handleTest}
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                Test gửi Zalo
              </Button>
              
              {formData.zalo_app_id && formData.zalo_app_secret && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={refreshing}
                  onClick={handleRefreshToken}
                >
                  {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Gia hạn token
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={handleDisconnect}
              >
                <Unplug className="h-3.5 w-3.5" />
                Ngắt kết nối
              </Button>
            </div>

            {/* Note about ZNS vs CS */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10 p-2.5">
              <p className="text-[11px] text-blue-700 dark:text-blue-400">
                <strong>Cách gửi tin:</strong><br/>
                • <strong>Khách đã follow OA:</strong> Gửi tin tư vấn (CS) miễn phí<br/>
                • <strong>Khách chưa follow:</strong> Gửi qua ZNS (cần Template ID, tính phí theo Zalo)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
