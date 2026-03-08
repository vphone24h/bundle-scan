import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Settings, Shield, Clock, Wallet, FileText } from 'lucide-react';
import { useAffiliateSettings, useUpdateAffiliateSettings } from '@/hooks/useAffiliate';

export function AffiliateSettingsManagement() {
  const { data: settings, isLoading } = useAffiliateSettings();
  const updateSettings = useUpdateAffiliateSettings();

  const [form, setForm] = useState({
    is_enabled: false,
    min_subscription_months: 3,
    require_approval: false,
    check_same_email: true,
    check_same_phone: true,
    check_same_ip: false,
    hold_days: 7,
    min_withdrawal_amount: 500000,
    commission_description: '',
    cookie_tracking_days: 30,
    default_commission_rate: 3,
    default_commission_type: 'percentage',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        is_enabled: settings.is_enabled,
        min_subscription_months: settings.min_subscription_months,
        require_approval: settings.require_approval,
        check_same_email: settings.check_same_email,
        check_same_phone: settings.check_same_phone,
        check_same_ip: settings.check_same_ip,
        hold_days: settings.hold_days,
        min_withdrawal_amount: settings.min_withdrawal_amount,
        commission_description: (settings as any).commission_description || '',
        cookie_tracking_days: (settings as any).cookie_tracking_days ?? 30,
        default_commission_rate: (settings as any).default_commission_rate ?? 3,
        default_commission_type: (settings as any).default_commission_type ?? 'percentage',
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle bật/tắt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Bật/Tắt Affiliate
          </CardTitle>
          <CardDescription>
            Khi tắt, link giới thiệu không còn hiệu lực và không phát sinh hoa hồng mới
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Trạng thái hệ thống Affiliate</p>
              <p className="text-sm text-muted-foreground">
                {form.is_enabled ? 'Đang hoạt động' : 'Đã tắt'}
              </p>
            </div>
            <Switch
              checked={form.is_enabled}
              onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Điều kiện trở thành affiliate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Điều kiện trở thành Affiliate
          </CardTitle>
          <CardDescription>
            Cấu hình điều kiện để người dùng có thể đăng ký làm affiliate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Thời gian đăng ký tối thiểu (tháng)</Label>
              <Input
                type="number"
                min="0"
                value={form.min_subscription_months}
                onChange={(e) => setForm({ ...form, min_subscription_months: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Người dùng phải mua gói ít nhất {form.min_subscription_months} tháng mới được giới thiệu
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <p className="font-medium">Yêu cầu duyệt tay</p>
              <p className="text-sm text-muted-foreground">
                Admin phải duyệt trước khi affiliate được hoạt động
              </p>
            </div>
            <Switch
              checked={form.require_approval}
              onCheckedChange={(checked) => setForm({ ...form, require_approval: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Chống gian lận */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Chống gian lận
          </CardTitle>
          <CardDescription>
            Cấu hình các quy tắc để ngăn chặn hành vi gian lận
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Kiểm tra trùng Email</p>
              <p className="text-sm text-muted-foreground">
                Không tính hoa hồng nếu người giới thiệu và được giới thiệu cùng email
              </p>
            </div>
            <Switch
              checked={form.check_same_email}
              onCheckedChange={(checked) => setForm({ ...form, check_same_email: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Kiểm tra trùng SĐT</p>
              <p className="text-sm text-muted-foreground">
                Không tính hoa hồng nếu người giới thiệu và được giới thiệu cùng số điện thoại
              </p>
            </div>
            <Switch
              checked={form.check_same_phone}
              onCheckedChange={(checked) => setForm({ ...form, check_same_phone: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Kiểm tra trùng IP</p>
              <p className="text-sm text-muted-foreground">
                Không tính hoa hồng nếu đăng ký từ cùng địa chỉ IP (có thể gây false positive)
              </p>
            </div>
            <Switch
              checked={form.check_same_ip}
              onCheckedChange={(checked) => setForm({ ...form, check_same_ip: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mô tả hoa hồng */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Mô tả chương trình
          </CardTitle>
          <CardDescription>
            Nội dung này sẽ hiển thị cho người dùng trên trang Affiliate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Mô tả hoa hồng</Label>
            <Textarea
              placeholder="Nhập mô tả về chương trình hoa hồng affiliate..."
              value={form.commission_description}
              onChange={(e) => setForm({ ...form, commission_description: e.target.value })}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Mô tả chi tiết về cách tính hoa hồng, điều kiện nhận thưởng, v.v.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Hoa hồng mặc định */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Hoa hồng giới thiệu mặc định
          </CardTitle>
          <CardDescription>
            % hoa hồng mặc định khi CTV giới thiệu thành công
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kiểu hoa hồng</Label>
              <Select
                value={form.default_commission_type}
                onValueChange={(v) => setForm({ ...form, default_commission_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                  <SelectItem value="fixed">Số tiền cố định (₫)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{form.default_commission_type === 'percentage' ? '% Hoa hồng' : 'Số tiền hoa hồng (₫)'}</Label>
              <Input
                type="number"
                min="0"
                step={form.default_commission_type === 'percentage' ? '0.5' : '10000'}
                value={form.default_commission_rate}
                onChange={(e) => setForm({ ...form, default_commission_rate: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                {form.default_commission_type === 'percentage'
                  ? `CTV nhận ${form.default_commission_rate}% trên mỗi đơn hàng`
                  : `CTV nhận ${Number(form.default_commission_rate).toLocaleString('vi-VN')}₫ trên mỗi đơn hàng`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cookie tracking & Thanh toán */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Cookie tracking & Thanh toán
          </CardTitle>
          <CardDescription>
            Cấu hình thời gian cookie, treo thưởng và điều kiện rút tiền
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Thời gian cookie tracking (ngày)</Label>
              <Input
                type="number"
                min="1"
                value={form.cookie_tracking_days}
                onChange={(e) => setForm({ ...form, cookie_tracking_days: parseInt(e.target.value) || 30 })}
              />
              <p className="text-xs text-muted-foreground">
                Cookie ref được lưu trong {form.cookie_tracking_days} ngày
              </p>
            </div>

            <div className="space-y-2">
              <Label>Thời gian treo thưởng (ngày)</Label>
              <Input
                type="number"
                min="0"
                value={form.hold_days}
                onChange={(e) => setForm({ ...form, hold_days: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Hoa hồng giữ {form.hold_days} ngày trước khi rút
              </p>
            </div>

            <div className="space-y-2">
              <Label>Số tiền tối thiểu rút (VND)</Label>
              <Input
                type="number"
                min="0"
                step="10000"
                value={form.min_withdrawal_amount}
                onChange={(e) => setForm({ ...form, min_withdrawal_amount: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Tối thiểu: {form.min_withdrawal_amount.toLocaleString('vi-VN')} VND
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nút lưu */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Lưu cấu hình
        </Button>
      </div>
    </div>
  );
}
