import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MessageCircle, ExternalLink, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Loader2, Save, AlertTriangle, Copy, ArrowRight, Shield, Users, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ZaloOASetupWizardProps {
  formData: any;
  handleChange: (field: string, value: any) => void;
  tenantId: string | null;
  onSave?: () => void;
}

function StepNumber({ step, completed, active }: { step: number; completed: boolean; active: boolean }) {
  if (completed) {
    return (
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-500 text-white shrink-0">
        <CheckCircle2 className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 text-sm font-bold transition-colors ${
      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
    }`}>
      {step}
    </div>
  );
}

function StepConnector({ completed }: { completed: boolean }) {
  return (
    <div className={`w-0.5 h-4 ml-[15px] transition-colors ${completed ? 'bg-green-500' : 'bg-border'}`} />
  );
}

export function ZaloOASetupWizard({ formData, handleChange, tenantId, onSave }: ZaloOASetupWizardProps) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const hasOAId = !!formData.zalo_oa_id?.trim();
  const hasToken = !!formData.zalo_access_token?.trim();
  const isConfigured = hasOAId && hasToken;

  const toggleStep = (step: number) => {
    setExpandedStep(prev => prev === step ? null : step);
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
      if (error) {
        const errMsg = data?.details || data?.error || error.message;
        throw new Error(errMsg);
      }
      if (data?.error) {
        throw new Error(data.details || data.error);
      }
      toast.success('✅ Đã gửi tin nhắn Zalo test thành công!');
    } catch (err: any) {
      toast.error('Lỗi gửi Zalo: ' + (err.message || 'Không xác định'));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSave) onSave();
      toast.success('✅ Đã lưu cài đặt Zalo OA!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Zalo OA - Gửi tin nhắn tự động</Label>
            <p className="text-[11px] text-muted-foreground">Tự động gửi tin cho khách khi có đơn hàng mới</p>
          </div>
        </div>
        <Switch
          checked={formData.zalo_enabled ?? false}
          onCheckedChange={(checked) => handleChange('zalo_enabled', checked)}
        />
      </div>

      {formData.zalo_enabled && (
        <div className="space-y-1">
          {/* Status Banner */}
          {isConfigured ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-xs font-medium text-green-700">Đã kết nối Zalo OA thành công</span>
              <Badge variant="outline" className="ml-auto text-[10px] border-green-500/30 text-green-600">Hoạt động</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-xs font-medium text-amber-700">Chưa hoàn tất cấu hình — Làm theo 3 bước bên dưới</span>
            </div>
          )}

          {/* Step 1: Create Zalo App */}
          <div className="pt-2">
            <button
              onClick={() => toggleStep(1)}
              className="flex items-center gap-3 w-full text-left py-2 group"
            >
              <StepNumber step={1} completed={hasOAId} active={expandedStep === 1} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium group-hover:text-primary transition-colors">Tạo ứng dụng trên Zalo Developers</p>
                <p className="text-[11px] text-muted-foreground">Đăng ký ứng dụng và liên kết OA</p>
              </div>
              {expandedStep === 1 ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {expandedStep === 1 && (
              <div className="ml-11 space-y-3 pb-2">
                <div className="rounded-lg bg-muted/50 p-3 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">1</span>
                    </div>
                    <p>Truy cập <a href="https://developers.zalo.me" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2 inline-flex items-center gap-1">developers.zalo.me <ExternalLink className="h-3 w-3" /></a> và đăng nhập bằng tài khoản Zalo</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">2</span>
                    </div>
                    <p>Nhấn <strong>"Tạo ứng dụng mới"</strong> → Chọn loại <strong>"Official Account API"</strong></p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">3</span>
                    </div>
                    <p>Vào mục <strong>"Official Account"</strong> → Liên kết OA của bạn → Copy <strong>OA ID</strong></p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Zalo OA ID</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.zalo_oa_id || ''}
                      onChange={e => handleChange('zalo_oa_id', e.target.value)}
                      placeholder="Dán OA ID tại đây, VD: 4318038921XXXXXX"
                      className="text-sm"
                    />
                  </div>
                  {hasOAId && (
                    <p className="text-[11px] text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Đã nhập OA ID
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <StepConnector completed={hasOAId} />

          {/* Step 2: Get Access Token */}
          <div>
            <button
              onClick={() => toggleStep(2)}
              className="flex items-center gap-3 w-full text-left py-2 group"
            >
              <StepNumber step={2} completed={hasToken} active={expandedStep === 2} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium group-hover:text-primary transition-colors">Lấy Access Token</p>
                <p className="text-[11px] text-muted-foreground">Cấp quyền gửi tin nhắn cho ứng dụng</p>
              </div>
              {expandedStep === 2 ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {expandedStep === 2 && (
              <div className="ml-11 space-y-3 pb-2">
                <div className="rounded-lg bg-muted/50 p-3 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">1</span>
                    </div>
                    <p>Vào <a href="https://developers.zalo.me/tools/explorer/token" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2 inline-flex items-center gap-1">Công cụ → Lấy Access Token <ExternalLink className="h-3 w-3" /></a></p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">2</span>
                    </div>
                    <p>Chọn loại: <strong>"OA Access Token"</strong></p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">3</span>
                    </div>
                    <p>Chọn đúng <strong>ứng dụng</strong> và <strong>OA</strong> đã tạo → Nhấn <strong>"Cấp quyền"</strong></p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">4</span>
                    </div>
                    <p>Copy <strong>Access Token</strong> và dán vào ô bên dưới</p>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10 p-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5">
                      <p className="font-medium">Lưu ý quan trọng:</p>
                      <p>• Token từ API Explorer có hạn <strong>ngắn</strong> (dùng để test)</p>
                      <p>• Token chính thức có hạn <strong>90 ngày</strong>, cần gia hạn định kỳ</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Access Token</Label>
                  <Input
                    value={formData.zalo_access_token || ''}
                    onChange={e => handleChange('zalo_access_token', e.target.value)}
                    placeholder="Dán Access Token tại đây..."
                    type="password"
                    className="text-sm"
                  />
                  {hasToken && (
                    <p className="text-[11px] text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Đã nhập Access Token
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <StepConnector completed={hasToken} />

          {/* Step 3: Test & Configure */}
          <div>
            <button
              onClick={() => toggleStep(3)}
              className="flex items-center gap-3 w-full text-left py-2 group"
            >
              <StepNumber step={3} completed={false} active={expandedStep === 3} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium group-hover:text-primary transition-colors">Cài đặt & Kiểm tra</p>
                <p className="text-[11px] text-muted-foreground">Chọn thời điểm gửi và test gửi thử</p>
              </div>
              {expandedStep === 3 ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {expandedStep === 3 && (
              <div className="ml-11 space-y-3 pb-2">
                {/* Send conditions */}
                <div className="space-y-2.5">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    Tự động gửi tin nhắn khi:
                  </p>
                  <div className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <Label className="text-xs">Khách đặt hàng trên website</Label>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">Luôn bật</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
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
                </div>

                {/* Important note about followers */}
                <div className="rounded-lg border border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10 p-2.5">
                  <div className="flex items-start gap-2">
                    <Users className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-blue-700 dark:text-blue-400 space-y-0.5">
                      <p className="font-medium">Điều kiện gửi tin:</p>
                      <p>Khách hàng phải <strong>Quan tâm (Follow)</strong> Zalo OA của bạn thì mới nhận được tin nhắn.</p>
                      <p>Để test: Bạn hãy dùng <strong>Zalo cá nhân</strong> follow OA trước.</p>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 gap-1.5"
                    disabled={!isConfigured || saving}
                    onClick={handleSave}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Lưu cài đặt
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    disabled={!isConfigured || testing}
                    onClick={handleTest}
                  >
                    {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                    Test gửi Zalo
                  </Button>
                </div>

                {!isConfigured && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Hoàn tất Bước 1 & 2 để kích hoạt các nút bên trên
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
