import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  MessageCircle, ExternalLink, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Zap, Unplug, RefreshCw, Link2, Eye, EyeOff,
  ArrowRight, Shield
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
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [oaName, setOaName] = useState('');

  const hasAppId = !!formData.zalo_app_id?.trim();
  const hasAppSecret = !!formData.zalo_app_secret?.trim();
  const hasToken = !!formData.zalo_access_token?.trim();
  const hasOAId = !!formData.zalo_oa_id?.trim();
  const isConnected = hasToken && hasOAId;
  const canConnect = hasAppId && hasAppSecret;

  // Listen for OAuth callback message from popup
  const handleOAuthMessage = useCallback(async (event: MessageEvent) => {
    if (event.data?.type === 'zalo-oauth-callback' && event.data?.code) {
      setConnecting(true);
      try {
        const { data, error } = await supabase.functions.invoke('zalo-oauth-callback', {
          body: {
            action: 'exchange_code',
            tenant_id: tenantId || event.data.state,
            code: event.data.code,
            app_id: formData.zalo_app_id,
            app_secret: formData.zalo_app_secret,
          },
        });

        if (error) throw new Error(data?.details || data?.error || error.message);
        if (data?.error) throw new Error(data.details || data.error);

        // Update local form state
        if (data?.oa_id) handleChange('zalo_oa_id', String(data.oa_id));
        handleChange('zalo_enabled', true);
        handleChange('zalo_access_token', 'connected');
        setOaName(data?.oa_name || '');
        
        toast.success('🎉 Kết nối Zalo OA thành công!');
        if (onSave) onSave();
      } catch (err: any) {
        toast.error('Lỗi kết nối: ' + (err.message || 'Không xác định'));
      } finally {
        setConnecting(false);
      }
    }
  }, [tenantId, formData.zalo_app_id, formData.zalo_app_secret, handleChange, onSave]);

  useEffect(() => {
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [handleOAuthMessage]);

  const handleConnect = async () => {
    if (!canConnect || !tenantId) {
      toast.error('Vui lòng nhập App ID và Secret Key trước');
      return;
    }

    // Save app credentials first
    handleChange('zalo_app_id', formData.zalo_app_id?.trim());
    handleChange('zalo_app_secret', formData.zalo_app_secret?.trim());

    setConnecting(true);
    try {
      // Get OAuth URL
      const { data, error } = await supabase.functions.invoke('zalo-oauth-callback', {
        body: {
          action: 'get_oauth_url',
          tenant_id: tenantId,
          app_id: formData.zalo_app_id?.trim(),
        },
      });

      if (error || data?.error) {
        throw new Error(data?.details || data?.error || error?.message);
      }

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      
      const popup = window.open(
        data.oauth_url,
        'zalo-oauth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );

      if (!popup) {
        toast.error('Trình duyệt đã chặn popup. Vui lòng cho phép popup và thử lại.');
        setConnecting(false);
        return;
      }

      // Poll for popup close or redirect
      const pollTimer = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(pollTimer);
            setConnecting(false);
          }
          // Try to read URL (will throw if cross-origin)
          const popupUrl = popup.location?.href;
          if (popupUrl && popupUrl.includes('code=')) {
            const url = new URL(popupUrl);
            const code = url.searchParams.get('code');
            const oaId = url.searchParams.get('oa_id');
            popup.close();
            clearInterval(pollTimer);

            if (code) {
              // Exchange code for token
              const { data: tokenData, error: tokenError } = await supabase.functions.invoke('zalo-oauth-callback', {
                body: {
                  action: 'exchange_code',
                  tenant_id: tenantId,
                  code,
                  app_id: formData.zalo_app_id?.trim(),
                  app_secret: formData.zalo_app_secret?.trim(),
                },
              });

              if (tokenError) throw new Error(tokenData?.details || tokenError.message);
              if (tokenData?.error) throw new Error(tokenData.details || tokenData.error);

              if (tokenData?.oa_id) handleChange('zalo_oa_id', String(tokenData.oa_id));
              handleChange('zalo_enabled', true);
              handleChange('zalo_access_token', 'connected'); // Just mark as connected
              setOaName(tokenData?.oa_name || '');
              
              toast.success('🎉 Kết nối Zalo OA thành công!');
              if (onSave) onSave();
            }
            setConnecting(false);
          }
        } catch {
          // Cross-origin, keep polling
        }
      }, 500);

      // Safety timeout
      setTimeout(() => {
        clearInterval(pollTimer);
        if (connecting) setConnecting(false);
      }, 120000);

    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Không xác định'));
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Bạn có chắc muốn ngắt kết nối Zalo OA?')) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('zalo-oauth-callback', {
        body: { action: 'disconnect', tenant_id: tenantId },
      });
      if (error) throw error;

      handleChange('zalo_access_token', '');
      handleChange('zalo_oa_id', '');
      handleChange('zalo_enabled', false);
      handleChange('zalo_refresh_token', '');
      handleChange('zalo_app_id', '');
      handleChange('zalo_app_secret', '');
      setOaName('');
      toast.success('Đã ngắt kết nối Zalo OA');
      if (onSave) onSave();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Không xác định'));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefreshToken = async () => {
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

  const handleTest = async () => {
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Zalo OA</Label>
            <p className="text-[11px] text-muted-foreground">Gửi tin nhắn tự động qua Zalo Official Account</p>
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

      {/* Connected State */}
      {isConnected ? (
        <div className="space-y-3">
          {/* Connection Info Card */}
          <Card className="border-green-500/20 bg-green-50/30 dark:bg-green-900/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                  Z
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{oaName || `OA #${formData.zalo_oa_id}`}</p>
                  <p className="text-[11px] text-muted-foreground">OA ID: {formData.zalo_oa_id}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRefreshToken}
                    disabled={refreshing}
                    title="Gia hạn token"
                  >
                    {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    title="Ngắt kết nối"
                  >
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Test button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                disabled={testing}
                onClick={handleTest}
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                Gửi tin nhắn test
              </Button>
            </CardContent>
          </Card>

          {/* Auto-send Settings */}
          <Card>
            <CardContent className="p-4 space-y-3">
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

              {/* Note about followers */}
              <div className="rounded-lg border border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10 p-2.5 mt-2">
                <p className="text-[11px] text-blue-700 dark:text-blue-400">
                  <strong>Lưu ý:</strong> Khách hàng phải <strong>Quan tâm (Follow)</strong> Zalo OA thì mới nhận được tin nhắn.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Not Connected State — Setup Flow */
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  canConnect ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
                }`}>
                  {canConnect ? '✓' : '1'}
                </div>
                <div className="flex-1 h-0.5 bg-border rounded">
                  <div className={`h-full rounded transition-all ${canConnect ? 'w-full bg-green-500' : 'w-0'}`} />
                </div>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isConnected ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  2
                </div>
              </div>

              {/* Instructions */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-xs">
                <p className="font-medium">📋 Chuẩn bị:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  <li>
                    Truy cập{' '}
                    <a href="https://developers.zalo.me" target="_blank" rel="noopener noreferrer" 
                       className="text-primary font-medium underline underline-offset-2 inline-flex items-center gap-0.5">
                      developers.zalo.me <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    → Tạo ứng dụng mới
                  </li>
                  <li>Chọn loại <strong>"Giao tiếp với OA"</strong></li>
                  <li>Vào <strong>Cài đặt</strong> → Copy <strong>App ID</strong> và <strong>Secret Key</strong></li>
                  <li>Vào <strong>Cấu hình OA</strong> → Thêm <strong>Callback Domain</strong>: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{window.location.hostname}</code></li>
                </ol>
              </div>

              {/* App ID input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">App ID</Label>
                <Input
                  value={formData.zalo_app_id || ''}
                  onChange={e => handleChange('zalo_app_id', e.target.value)}
                  placeholder="Dán App ID tại đây..."
                  className="text-sm font-mono"
                />
              </div>

              {/* Secret Key input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Secret Key</Label>
                <div className="relative">
                  <Input
                    value={formData.zalo_app_secret || ''}
                    onChange={e => handleChange('zalo_app_secret', e.target.value)}
                    placeholder="Dán Secret Key tại đây..."
                    type={showAppSecret ? 'text' : 'password'}
                    className="text-sm font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAppSecret(!showAppSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Security note */}
              <div className="flex items-start gap-2 rounded-lg border border-muted p-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground">
                  Thông tin được mã hóa và lưu trữ an toàn. Chỉ dùng để kết nối với Zalo API.
                </p>
              </div>

              {/* Connect Button */}
              <Button
                className="w-full gap-2 h-11 text-sm font-semibold"
                disabled={!canConnect || connecting}
                onClick={handleConnect}
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang kết nối...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Kết nối Zalo OA
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              {!canConnect && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Nhập App ID và Secret Key để kích hoạt nút kết nối
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
