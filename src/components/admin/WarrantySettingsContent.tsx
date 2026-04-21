import { useNavigate } from 'react-router-dom';
import { useVoucherTemplates } from '@/hooks/useVouchers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Phone, Users, Plus, FileText } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

interface WarrantySettingsContentProps {
  formData: Record<string, any>;
  onChange: (field: string, value: unknown) => void;
  /** Compact mode for website editor (smaller text) */
  compact?: boolean;
}

export function WarrantySettingsContent({ formData, onChange, compact }: WarrantySettingsContentProps) {
  const navigate = useNavigate();
  const { data: voucherTemplates } = useVoucherTemplates();
  const activeTemplates = (voucherTemplates || []).filter(t => t.is_active);

  const labelClass = compact ? 'text-xs' : '';
  const descClass = compact ? 'text-[10px] text-muted-foreground' : 'text-xs text-muted-foreground';
  const titleClass = compact ? 'text-xs font-medium' : 'font-medium text-sm';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className={labelClass}>Cho phép tra cứu bảo hành</Label>
          <p className={descClass}>
            Khách hàng có thể nhập IMEI hoặc SĐT để kiểm tra bảo hành
          </p>
        </div>
        <Switch
          checked={formData.show_warranty_lookup}
          onCheckedChange={(checked) => onChange('show_warranty_lookup', checked)}
        />
      </div>

      {/* Voucher */}
      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <p className={titleClass}>Tặng Voucher cho khách</p>
          <p className={descClass}>Khách điền thông tin trên website để nhận voucher</p>
        </div>
        <Switch
          checked={formData.voucher_enabled}
          onCheckedChange={(checked) => onChange('voucher_enabled', checked)}
        />
      </div>
      {formData.voucher_enabled && (
        <div className="space-y-2 pl-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Chọn mẫu Voucher tặng khách</Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 gap-1"
              onClick={() => navigate('/customers?tab=list&openSettings=voucher')}
            >
              <Plus className="h-3 w-3" />
              Thêm mẫu voucher
            </Button>
          </div>
          {activeTemplates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-center space-y-1">
              <p className="text-xs text-muted-foreground">Chưa có mẫu voucher nào.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => navigate('/customers?tab=list&openSettings=voucher')}
              >
                <Plus className="h-3 w-3" />
                Tạo mẫu voucher
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Menu → Khách hàng & CRM → ⚙️ Cài đặt → Voucher
              </p>
            </div>
          ) : (
            <Select
              value={formData.voucher_template_id || ''}
              onValueChange={(val) => onChange('voucher_template_id', val)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Chọn mẫu voucher" />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — {t.discount_type === 'percentage' ? `${t.discount_value}%` : `${t.discount_value.toLocaleString()}đ`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-[10px] text-muted-foreground">
            💡 Quản lý mẫu voucher tại: Menu → Khách hàng & CRM → ⚙️ Cài đặt → Voucher
          </p>
        </div>
      )}

      {formData.show_warranty_lookup && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className={`flex items-center gap-2 ${labelClass}`}>
              <Phone className="h-4 w-4" />
              Hotline bảo hành
            </Label>
            <Input
              value={formData.warranty_hotline || ''}
              onChange={(e) => onChange('warranty_hotline', e.target.value)}
              placeholder="VD: 1900 xxxx hoặc 0xxx xxx xxx"
            />
            <p className={descClass}>
              Hiển thị trong kết quả tra cứu để khách hàng liên hệ bảo hành
            </p>
          </div>

          <div className="space-y-2">
            <Label className={`flex items-center gap-2 ${labelClass}`}>
              <Users className="h-4 w-4" />
              Link nhóm hỗ trợ
            </Label>
            <Input
              value={formData.support_group_url || ''}
              onChange={(e) => onChange('support_group_url', e.target.value)}
              placeholder="VD: https://zalo.me/g/xxx hoặc link Facebook group"
            />
            <p className={descClass}>
              Link nhóm Zalo/Facebook/Telegram để khách hàng tham gia nhận hỗ trợ
            </p>
          </div>

          <div className="space-y-2">
            <Label className={`flex items-center gap-2 ${labelClass}`}>
              <FileText className="h-4 w-4" />
              Mô tả / Quảng cáo bảo hành
            </Label>
            <RichTextEditor
              value={formData.warranty_description || ''}
              onChange={(v) => onChange('warranty_description', v)}
              placeholder="VD: THU LẠI MÁY CŨ GIÁ CAO BẰNG 90% GIÁ BÁN…"
              minHeight="100px"
            />
            <p className={descClass}>
              Nội dung hiển thị trên trang bảo hành, hỗ trợ in đậm, màu sắc và chèn link
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className={labelClass}>Hiện điểm tích lũy</Label>
              <p className={descClass}>Hiện điểm và số tiền giảm lần mua tiếp theo</p>
            </div>
            <Switch
              checked={formData.show_warranty_points !== false}
              onCheckedChange={(checked) => onChange('show_warranty_points', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className={labelClass}>Hiện voucher</Label>
              <p className={descClass}>Hiện voucher của khách trên trang bảo hành</p>
            </div>
            <Switch
              checked={formData.show_warranty_vouchers !== false}
              onCheckedChange={(checked) => onChange('show_warranty_vouchers', checked)}
            />
          </div>
        </>
      )}
    </div>
  );
}