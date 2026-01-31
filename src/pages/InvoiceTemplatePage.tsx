import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { 
  Settings, 
  Save, 
  Eye,
  FileText,
  Store,
  Phone,
  MapPin,
  User,
  Calendar,
  Package,
  DollarSign,
  CreditCard,
  MessageSquare,
  Heart,
  Printer,
  MoveHorizontal,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import { useDefaultInvoiceTemplate, useUpdateInvoiceTemplate, type InvoiceTemplate, type TextAlign } from '@/hooks/useInvoiceTemplates';

interface SettingItemProps {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
}

function SettingItem({ icon, label, checked, onCheckedChange, children }: SettingItemProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <Label>{label}</Label>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {checked && children && (
        <div className="ml-8">
          {children}
        </div>
      )}
    </div>
  );
}

interface AlignmentSelectProps {
  value: TextAlign;
  onChange: (value: TextAlign) => void;
}

function AlignmentSelect({ value, onChange }: AlignmentSelectProps) {
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant={value === 'left' ? 'default' : 'outline'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onChange('left')}
      >
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={value === 'center' ? 'default' : 'outline'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onChange('center')}
      >
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={value === 'right' ? 'default' : 'outline'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onChange('right')}
      >
        <AlignRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface SectionCardProps {
  title: string;
  description: string;
  align: TextAlign;
  onAlignChange: (value: TextAlign) => void;
  children: React.ReactNode;
}

function SectionCard({ title, description, align, onAlignChange, children }: SectionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <AlignmentSelect value={align} onChange={onAlignChange} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
      </CardContent>
    </Card>
  );
}

const getAlignClass = (align: TextAlign | undefined) => {
  switch (align) {
    case 'center': return 'text-center';
    case 'right': return 'text-right';
    default: return 'text-left';
  }
};

export default function InvoiceTemplatePage() {
  const { data: template, isLoading } = useDefaultInvoiceTemplate();
  const updateTemplate = useUpdateInvoiceTemplate();

  const [settings, setSettings] = useState<Partial<InvoiceTemplate>>({});

  const currentSettings = { ...template, ...settings };

  const updateSetting = <K extends keyof InvoiceTemplate>(key: K, value: InvoiceTemplate[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    if (!template?.id) return;

    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        ...settings,
      });

      setSettings({});
      toast({
        title: 'Đã lưu',
        description: 'Cấu hình mẫu in đã được cập nhật',
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu cấu hình',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageHeader title="Thiết lập mẫu in" description="Đang tải..." />
        <div className="flex items-center justify-center py-12">
          Đang tải...
        </div>
      </MainLayout>
    );
  }

  const s1Align = (currentSettings.section1_align || 'center') as TextAlign;
  const s2Align = (currentSettings.section2_align || 'center') as TextAlign;
  const s3Align = (currentSettings.section3_align || 'left') as TextAlign;
  const s4Align = (currentSettings.section4_align || 'left') as TextAlign;
  const s5Align = (currentSettings.section5_align || 'left') as TextAlign;

  return (
    <MainLayout>
      <PageHeader
        title="Thiết lập mẫu in hóa đơn K80"
        description="Cấu hình bố cục 5 phần với căn lề riêng cho mỗi phần"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-4">
          {/* General settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Cài đặt chung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Khổ giấy</Label>
                  <Select
                    value={currentSettings.paper_size || 'K80'}
                    onValueChange={(v) => updateSetting('paper_size', v as 'K80' | 'A4')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="K80">K80 (80mm)</SelectItem>
                      <SelectItem value="A4">A4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cỡ chữ</Label>
                  <Select
                    value={currentSettings.font_size || 'medium'}
                    onValueChange={(v) => updateSetting('font_size', v as 'small' | 'medium' | 'large')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="small">Nhỏ</SelectItem>
                      <SelectItem value="medium">Vừa</SelectItem>
                      <SelectItem value="large">Lớn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MoveHorizontal className="h-4 w-4" />
                  <span>Lề giấy (mm)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lề trái</Label>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={currentSettings.margin_left ?? 0}
                      onChange={(e) => updateSetting('margin_left', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Lề phải</Label>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={currentSettings.margin_right ?? 0}
                      onChange={(e) => updateSetting('margin_right', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 1: Store info */}
          <SectionCard
            title="Phần 1: Thông tin cửa hàng"
            description="Tên, địa chỉ, số điện thoại"
            align={s1Align}
            onAlignChange={(v) => updateSetting('section1_align', v)}
          >
            <SettingItem
              icon={<Store className="h-4 w-4" />}
              label="Tên cửa hàng"
              checked={currentSettings.show_store_name ?? true}
              onCheckedChange={(v) => updateSetting('show_store_name', v)}
            >
              <Input
                placeholder="Nhập tên cửa hàng"
                value={currentSettings.store_name || ''}
                onChange={(e) => updateSetting('store_name', e.target.value)}
              />
            </SettingItem>

            <SettingItem
              icon={<MapPin className="h-4 w-4" />}
              label="Địa chỉ"
              checked={currentSettings.show_store_address ?? true}
              onCheckedChange={(v) => updateSetting('show_store_address', v)}
            >
              <Input
                placeholder="Nhập địa chỉ"
                value={currentSettings.store_address || ''}
                onChange={(e) => updateSetting('store_address', e.target.value)}
              />
            </SettingItem>

            <SettingItem
              icon={<Phone className="h-4 w-4" />}
              label="Số điện thoại"
              checked={currentSettings.show_store_phone ?? true}
              onCheckedChange={(v) => updateSetting('show_store_phone', v)}
            >
              <Input
                placeholder="Nhập SĐT"
                value={currentSettings.store_phone || ''}
                onChange={(e) => updateSetting('store_phone', e.target.value)}
              />
            </SettingItem>
          </SectionCard>

          {/* Section 2: Invoice title */}
          <SectionCard
            title="Phần 2: Tiêu đề hóa đơn"
            description="Tên hóa đơn bán hàng"
            align={s2Align}
            onAlignChange={(v) => updateSetting('section2_align', v)}
          >
            <SettingItem
              icon={<FileText className="h-4 w-4" />}
              label="Hiển thị tiêu đề"
              checked={currentSettings.show_receipt_code ?? true}
              onCheckedChange={(v) => updateSetting('show_receipt_code', v)}
            />
          </SectionCard>

          {/* Section 3: Details */}
          <SectionCard
            title="Phần 3: Thông tin đơn hàng"
            description="Mã, ngày, khách hàng"
            align={s3Align}
            onAlignChange={(v) => updateSetting('section3_align', v)}
          >
            <SettingItem
              icon={<Calendar className="h-4 w-4" />}
              label="Ngày bán"
              checked={currentSettings.show_sale_date ?? true}
              onCheckedChange={(v) => updateSetting('show_sale_date', v)}
            />

            <SettingItem
              icon={<User className="h-4 w-4" />}
              label="Thông tin khách hàng"
              checked={currentSettings.show_customer_info ?? true}
              onCheckedChange={(v) => updateSetting('show_customer_info', v)}
            />
          </SectionCard>

          {/* Section 4: Products */}
          <SectionCard
            title="Phần 4: Sản phẩm"
            description="Danh sách sản phẩm đã bán"
            align={s4Align}
            onAlignChange={(v) => updateSetting('section4_align', v)}
          >
            <SettingItem
              icon={<Package className="h-4 w-4" />}
              label="Tên sản phẩm"
              checked={currentSettings.show_product_name ?? true}
              onCheckedChange={(v) => updateSetting('show_product_name', v)}
            />

            <SettingItem
              icon={<Package className="h-4 w-4" />}
              label="SKU"
              checked={currentSettings.show_sku ?? true}
              onCheckedChange={(v) => updateSetting('show_sku', v)}
            />

            <SettingItem
              icon={<Package className="h-4 w-4" />}
              label="IMEI"
              checked={currentSettings.show_imei ?? true}
              onCheckedChange={(v) => updateSetting('show_imei', v)}
            />

            <SettingItem
              icon={<DollarSign className="h-4 w-4" />}
              label="Giá bán"
              checked={currentSettings.show_sale_price ?? true}
              onCheckedChange={(v) => updateSetting('show_sale_price', v)}
            />
          </SectionCard>

          {/* Section 5: Totals */}
          <SectionCard
            title="Phần 5: Thanh toán"
            description="Tổng tiền, công nợ, lời cảm ơn"
            align={s5Align}
            onAlignChange={(v) => updateSetting('section5_align', v)}
          >
            <SettingItem
              icon={<DollarSign className="h-4 w-4" />}
              label="Tổng tiền"
              checked={currentSettings.show_total ?? true}
              onCheckedChange={(v) => updateSetting('show_total', v)}
            />

            <SettingItem
              icon={<CreditCard className="h-4 w-4" />}
              label="Đã thanh toán"
              checked={currentSettings.show_paid_amount ?? true}
              onCheckedChange={(v) => updateSetting('show_paid_amount', v)}
            />

            <SettingItem
              icon={<CreditCard className="h-4 w-4" />}
              label="Công nợ"
              checked={currentSettings.show_debt ?? true}
              onCheckedChange={(v) => updateSetting('show_debt', v)}
            />

            <SettingItem
              icon={<MessageSquare className="h-4 w-4" />}
              label="Ghi chú"
              checked={currentSettings.show_note ?? true}
              onCheckedChange={(v) => updateSetting('show_note', v)}
            />

            <SettingItem
              icon={<Heart className="h-4 w-4" />}
              label="Lời cảm ơn"
              checked={currentSettings.show_thank_you ?? true}
              onCheckedChange={(v) => updateSetting('show_thank_you', v)}
            >
              <Input
                placeholder="Nhập lời cảm ơn"
                value={currentSettings.thank_you_text || ''}
                onChange={(e) => updateSetting('thank_you_text', e.target.value)}
              />
            </SettingItem>
          </SectionCard>

          {/* Save button */}
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleSave}
            disabled={updateTemplate.isPending || Object.keys(settings).length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateTemplate.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
          </Button>
        </div>

        {/* Preview */}
        <div>
          <Card className="sticky top-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Xem trước mẫu K80
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const previewContent = document.getElementById('invoice-preview');
                  if (!previewContent) return;
                  
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) {
                    toast({
                      title: 'Lỗi',
                      description: 'Không thể mở cửa sổ in. Vui lòng cho phép popup.',
                      variant: 'destructive',
                    });
                    return;
                  }

                  const marginLeft = currentSettings.margin_left ?? 0;
                  const marginRight = currentSettings.margin_right ?? 0;
                  const fontSize = currentSettings.font_size === 'small' ? '12px' : currentSettings.font_size === 'large' ? '16px' : '14px';
                  
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>In mẫu hóa đơn</title>
                      <style>
                        @page {
                          size: 80mm auto;
                          margin: 0;
                        }
                        body {
                          font-family: Arial, sans-serif;
                          font-size: ${fontSize};
                          margin: 0;
                          padding: 5mm ${marginRight}mm 5mm ${marginLeft}mm;
                          width: 80mm;
                          box-sizing: border-box;
                        }
                        .section { margin-bottom: 8px; }
                        .text-center { text-align: center !important; }
                        .text-left { text-align: left !important; }
                        .text-right { text-align: right !important; }
                        .text-xl { font-size: 1.25rem; }
                        .text-lg { font-size: 1.125rem; }
                        .text-sm { font-size: 0.875rem; }
                        .text-xs { font-size: 0.75rem; }
                        .font-bold { font-weight: bold; }
                        .mb-1 { margin-bottom: 0.25rem; }
                        .mt-4 { margin-top: 1rem; }
                        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
                        .italic { font-style: italic; }
                        .flex { display: flex; }
                        .justify-between { justify-content: space-between; }
                        .w-full { width: 100%; }
                        .text-red { color: #dc2626; }
                        .text-gray { color: #666; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 4px 2px; border-bottom: 1px dashed #999; }
                        th { font-weight: bold; }
                        .separator { border-top: 1px dashed #333; margin: 8px 0; }
                      </style>
                    </head>
                    <body>
                      ${previewContent.innerHTML}
                      <script>
                        window.onload = function() {
                          window.print();
                          setTimeout(function() { window.close(); }, 500);
                        };
                      </script>
                    </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                In mẫu
              </Button>
            </CardHeader>
            <CardContent>
              <div 
                id="invoice-preview"
                className="p-4 border rounded-lg bg-white text-black min-h-[400px]"
                style={{ 
                  fontFamily: 'Arial, sans-serif',
                  fontSize: currentSettings.font_size === 'small' ? '12px' : currentSettings.font_size === 'large' ? '16px' : '14px',
                  maxWidth: '80mm',
                  paddingLeft: `${(currentSettings.margin_left ?? 0)}mm`,
                  paddingRight: `${(currentSettings.margin_right ?? 0)}mm`,
                }}
              >
                {/* Section 1: Store info */}
                <div className={`section ${getAlignClass(s1Align)}`}>
                  {currentSettings.show_store_name && (
                    <div className="text-xl font-bold">{currentSettings.store_name || 'Tên cửa hàng'}</div>
                  )}
                  {currentSettings.show_store_address && (
                    <div className="text-sm">{currentSettings.store_address || 'Địa chỉ cửa hàng'}</div>
                  )}
                  {currentSettings.show_store_phone && (
                    <div className="text-sm">ĐT: {currentSettings.store_phone || '0123456789'}</div>
                  )}
                </div>

                {/* Separator */}
                <div className="separator" style={{ borderTop: '1px dashed #333', margin: '8px 0' }}></div>

                {/* Section 2: Invoice title */}
                {currentSettings.show_receipt_code && (
                  <div className={`section ${getAlignClass(s2Align)}`}>
                    <div className="text-lg font-bold">HÓA ĐƠN BÁN HÀNG</div>
                  </div>
                )}

                {/* Section 3: Details */}
                <div className={`section ${getAlignClass(s3Align)}`}>
                  {currentSettings.show_receipt_code && (
                    <div className="text-sm mb-1">Mã: XH20260131143000</div>
                  )}
                  {currentSettings.show_sale_date && (
                    <div className="text-sm mb-1">Ngày: 31/01/2026 14:30</div>
                  )}
                  {currentSettings.show_customer_info && (
                    <>
                      <div className="text-sm">KH: Nguyễn Văn A</div>
                      <div className="text-sm">SĐT: 0987654321</div>
                    </>
                  )}
                </div>

                {/* Separator */}
                <div className="separator" style={{ borderTop: '1px dashed #333', margin: '8px 0' }}></div>

                {/* Section 4: Items */}
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333' }}>
                      {currentSettings.show_product_name && <th className="py-1" style={{ textAlign: s4Align }}>SP</th>}
                      {currentSettings.show_sale_price && <th className="py-1 text-right">Giá</th>}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px dashed #999' }}>
                      <td className="py-1" style={{ textAlign: s4Align }}>
                        {currentSettings.show_product_name && <div>iPhone 15 Pro Max 256GB</div>}
                        {currentSettings.show_sku && <div className="text-xs" style={{ color: '#666' }}>SKU: IP15PM256</div>}
                        {currentSettings.show_imei && <div className="text-xs" style={{ color: '#666' }}>IMEI: 123456789012345</div>}
                      </td>
                      {currentSettings.show_sale_price && (
                        <td className="py-1 text-right">32,000,000đ</td>
                      )}
                    </tr>
                  </tbody>
                </table>

                {/* Separator */}
                <div className="separator" style={{ borderTop: '1px dashed #333', margin: '8px 0' }}></div>

                {/* Section 5: Totals */}
                <div className={`section ${getAlignClass(s5Align)}`}>
                  {currentSettings.show_total && (
                    <div className="flex justify-between font-bold">
                      <span>Tổng tiền:</span>
                      <span>32,000,000đ</span>
                    </div>
                  )}
                  {currentSettings.show_paid_amount && (
                    <div className="flex justify-between">
                      <span>Đã thanh toán:</span>
                      <span>30,000,000đ</span>
                    </div>
                  )}
                  {currentSettings.show_debt && (
                    <div className="flex justify-between" style={{ color: '#dc2626' }}>
                      <span>Công nợ:</span>
                      <span>2,000,000đ</span>
                    </div>
                  )}
                </div>

                {/* Note */}
                {currentSettings.show_note && (
                  <div className="mt-2 text-sm" style={{ color: '#666' }}>
                    Ghi chú: Khách hẹn thanh toán sau 7 ngày
                  </div>
                )}

                {/* Thank you */}
                {currentSettings.show_thank_you && (
                  <div className="mt-4 text-center italic">
                    {currentSettings.thank_you_text || 'Cảm ơn quý khách!'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}