import { useState, useRef } from 'react';
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
  MoveHorizontal
} from 'lucide-react';
import { useDefaultInvoiceTemplate, useUpdateInvoiceTemplate, type InvoiceTemplate } from '@/hooks/useInvoiceTemplates';

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

export default function InvoiceTemplatePage() {
  const { data: template, isLoading } = useDefaultInvoiceTemplate();
  const updateTemplate = useUpdateInvoiceTemplate();

  // Local state
  const [settings, setSettings] = useState<Partial<InvoiceTemplate>>({});

  // Merge template with local changes
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

  return (
    <MainLayout>
      <PageHeader
        title="Thiết lập mẫu in hóa đơn"
        description="Cấu hình nội dung và giao diện hóa đơn bán hàng"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-6">
          {/* Paper size & font */}
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
                      <SelectItem value="K80">K80 (Giấy cuộn nhiệt)</SelectItem>
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
              <div>
                <Label>Căn lề</Label>
                <Select
                  value={currentSettings.text_align || 'left'}
                  onValueChange={(v) => updateSetting('text_align', v as 'left' | 'center' | 'right')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="left">Trái</SelectItem>
                    <SelectItem value="center">Giữa</SelectItem>
                    <SelectItem value="right">Phải</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MoveHorizontal className="h-4 w-4" />
                  <span>Lề giấy (mm) - chỉnh để chữ không bị xuống dòng</span>
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

          {/* Store info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Store className="h-5 w-5" />
                Thông tin cửa hàng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  placeholder="Nhập địa chỉ cửa hàng"
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
                  placeholder="Nhập SĐT cửa hàng"
                  value={currentSettings.store_phone || ''}
                  onChange={(e) => updateSetting('store_phone', e.target.value)}
                />
              </SettingItem>
            </CardContent>
          </Card>

          {/* Content settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Nội dung hiển thị
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingItem
                icon={<FileText className="h-4 w-4" />}
                label="Mã phiếu xuất"
                checked={currentSettings.show_receipt_code ?? true}
                onCheckedChange={(v) => updateSetting('show_receipt_code', v)}
              />

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

              <Separator />

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

              <Separator />

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
            </CardContent>
          </Card>

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
                Xem trước
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
                  const paperWidth = currentSettings.paper_size === 'K80' ? '80mm' : '210mm';
                  
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>In mẫu hóa đơn</title>
                      <style>
                        @page {
                          size: ${paperWidth} auto;
                          margin: 0;
                        }
                        body {
                          font-family: Arial, sans-serif;
                          margin: 0;
                          padding: 5mm ${marginRight}mm 5mm ${marginLeft}mm;
                          -webkit-print-color-adjust: exact;
                          print-color-adjust: exact;
                        }
                        .invoice-content {
                          width: 100%;
                        }
                      </style>
                    </head>
                    <body>
                      <div class="invoice-content">${previewContent.innerHTML}</div>
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
                  textAlign: currentSettings.text_align || 'left',
                  maxWidth: currentSettings.paper_size === 'K80' ? '80mm' : '100%',
                  paddingLeft: `${(currentSettings.margin_left ?? 0)}mm`,
                  paddingRight: `${(currentSettings.margin_right ?? 0)}mm`,
                }}
              >
                {/* Store info */}
                {currentSettings.show_store_name && (
                  <div className="text-center mb-3">
                    <div className="text-xl font-bold">{currentSettings.store_name || 'Tên cửa hàng'}</div>
                    {currentSettings.show_store_address && (
                      <div className="text-sm">{currentSettings.store_address || 'Địa chỉ cửa hàng'}</div>
                    )}
                    {currentSettings.show_store_phone && (
                      <div className="text-sm">ĐT: {currentSettings.store_phone || '0123456789'}</div>
                    )}
                  </div>
                )}

                {/* Receipt code */}
                {currentSettings.show_receipt_code && (
                  <div className="text-center font-bold my-2">
                    HÓA ĐƠN BÁN HÀNG
                    <div className="text-sm">Mã: XH20260126143000</div>
                  </div>
                )}

                {/* Date */}
                {currentSettings.show_sale_date && (
                  <div className="text-sm mb-2">
                    Ngày: 26/01/2026 14:30
                  </div>
                )}

                {/* Customer */}
                {currentSettings.show_customer_info && (
                  <div className="mb-3 text-sm">
                    <div>Khách hàng: Nguyễn Văn A</div>
                    <div>SĐT: 0987654321</div>
                  </div>
                )}

                {/* Items */}
                <table className="w-full text-sm mb-3">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000' }}>
                      {currentSettings.show_product_name && <th className="py-1 text-left">SP</th>}
                      {currentSettings.show_sale_price && <th className="py-1 text-right">Giá</th>}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px dashed #999' }}>
                      <td className="py-1">
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

                {/* Totals */}
                <div className="space-y-1 text-sm">
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
                  <div className="mt-3 text-sm" style={{ color: '#666' }}>
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
