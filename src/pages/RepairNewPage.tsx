
import React, { useState, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { BarcodeDialog } from '@/components/products/BarcodeDialog';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AutoEmailToggle } from '@/components/shared/AutoEmailToggle';
import { PriceInput } from '@/components/ui/price-input';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { CustomerSearchCombobox } from '@/components/export/CustomerSearchCombobox';
import { useUpsertCustomer } from '@/hooks/useCustomers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Wrench, QrCode, Printer, Plus, Trash2, Search, UserPlus, Camera, ChevronDown, ChevronUp, Mail, Loader2, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformUser } from '@/hooks/useTenant';
import { useBranches } from '@/hooks/useBranches';
import { useCreateRepairOrder, useRepairRequestTypes, useCreateRepairRequestType, useDeleteRepairRequestType, REPAIR_STATUS_MAP, RepairStatus } from '@/hooks/useRepairOrders';
import { useStaffList } from '@/hooks/useCRM';
import { supabase } from '@/integrations/supabase/client';
import { formatNumber } from '@/lib/formatNumber';
import { useNavigate } from 'react-router-dom';

export default function RepairNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const displayName = profile?.display_name || '';
  const { data: platformUser } = usePlatformUser();
  const { data: branches } = useBranches();
  const { data: requestTypes } = useRepairRequestTypes();
  const createOrder = useCreateRepairOrder();
  const createRequestType = useCreateRepairRequestType();
  const deleteRequestType = useDeleteRepairRequestType();
  const { data: staffList } = useStaffList();
  const upsertCustomer = useUpsertCustomer();
  
  const tenantId = platformUser?.tenant_id || '';
  const defaultBranch = branches?.find(b => b.is_default);

  // Form state
  const [deviceName, setDeviceName] = useState('');
  const [deviceImei, setDeviceImei] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [devicePassword, setDevicePassword] = useState('');
  const [deviceCondition, setDeviceCondition] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [dueDate, setDueDate] = useState('');
  const [requestTypeId, setRequestTypeId] = useState('');
  const [requestTypeName, setRequestTypeName] = useState('Sửa chữa');
  const [status, setStatus] = useState<RepairStatus>('received');
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [note, setNote] = useState('');
  const [ticketPasswordEnabled, setTicketPasswordEnabled] = useState(false);
  const [ticketPassword, setTicketPassword] = useState('');
  const [branchId, setBranchId] = useState(defaultBranch?.id || '');

  // Customer (using CustomerSearchCombobox like sales page)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerSource, setCustomerSource] = useState('');
  const [customerBirthday, setCustomerBirthday] = useState<Date | undefined>();

  // Product search  
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Request type management
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // QR dialog
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [autoEmailEnabled, setAutoEmailEnabled] = useState(true);
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [barcodeProducts, setBarcodeProducts] = useState<{ id: string; name: string; sku: string; imei?: string; importPrice: number; salePrice?: number }[]>([]);

  // Device images
  const [deviceImages, setDeviceImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [receivedById, setReceivedById] = useState<string | null>(user?.id || null);
  const [receivedByName, setReceivedByName] = useState<string>(displayName || '');

  // Set defaults
  React.useEffect(() => {
    if (defaultBranch?.id && !branchId) setBranchId(defaultBranch.id);
  }, [defaultBranch]);

  React.useEffect(() => {
    if (user?.id && !receivedById) {
      setReceivedById(user.id);
      setReceivedByName(displayName || '');
    }
  }, [user?.id, displayName]);

  // Search products for device suggestion
  const searchProducts = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setProductResults([]); return; }
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, imei')
      .or(`name.ilike.%${term}%,imei.ilike.%${term}%,sku.ilike.%${term}%`)
      .in('status', ['in_stock', 'sold'])
      .limit(20);
    setProductResults(data || []);
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => searchProducts(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const selectProduct = (p: any) => {
    setDeviceName(p.name);
    if (p.imei) setDeviceImei(p.imei);
    setProductSearch('');
    setShowProductSearch(false);
  };

  // Handle device image upload (convert to base64 data URLs for simplicity)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ảnh quá lớn (tối đa 5MB)');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setDeviceImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!deviceName.trim()) {
      toast.error('Vui lòng nhập tên thiết bị');
      return;
    }
    if (!deviceImei.trim()) {
      toast.error('Vui lòng nhập IMEI / Serial');
      return;
    }

    // Upsert customer if we have name+phone
    let finalCustomerId = selectedCustomer?.id || null;
    if (!finalCustomerId && customerName.trim() && customerPhone.trim()) {
      try {
        const customer = await upsertCustomer.mutateAsync({
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim() || undefined,
          email: customerEmail.trim() || undefined,
          source: customerSource || undefined,
          birthday: customerBirthday ? customerBirthday.toISOString().split('T')[0] : undefined,
        } as any);
        finalCustomerId = customer?.id || null;
      } catch { /* ignore */ }
    }

    const order = await createOrder.mutateAsync({
      tenant_id: tenantId,
      branch_id: branchId || null,
      customer_id: finalCustomerId,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      device_name: deviceName,
      device_imei: deviceImei,
      device_model: deviceModel || null,
      device_password: devicePassword || null,
      device_condition: deviceCondition || null,
      device_images: deviceImages,
      quantity,
      request_type_id: requestTypeId || null,
      request_type_name: requestTypeName,
      status,
      estimated_price: estimatedPrice,
      due_date: dueDate || null,
      received_by: receivedById || user?.id || null,
      received_by_name: receivedByName || displayName || null,
      note: note || null,
      ticket_password_enabled: ticketPasswordEnabled,
      ticket_password: ticketPasswordEnabled ? ticketPassword : null,
    } as any);

    // Generate QR code
    try {
      const qrUrl = await QRCode.toDataURL(order.code, { width: 150, margin: 1 });
      setQrDataUrl(qrUrl);
    } catch { setQrDataUrl(''); }

    setCreatedOrder(order);
    setShowQRDialog(true);

    // Auto send email if enabled
    const email = customerEmail?.trim() || selectedCustomer?.email;
    if (autoEmailEnabled && email) {
      supabase.functions.invoke('send-export-email', {
        body: {
          tenant_id: tenantId,
          customer_name: customerName || selectedCustomer?.name || 'Khách lẻ',
          customer_email: email,
          customer_phone: customerPhone || selectedCustomer?.phone || '',
          items: [{
            product_name: `[Sửa chữa] ${order.device_name}`,
            imei: order.device_imei,
            sale_price: order.estimated_price,
            quantity: 1,
            warranty: '',
          }],
          total_amount: order.estimated_price,
          receipt_code: order.code,
          branch_id: order.branch_id,
          export_date: new Date().toISOString(),
          sales_staff_id: user?.id,
        },
      }).then(({ error }) => {
        if (error) console.warn('Auto repair email failed:', error.message);
      }).catch(() => {});
    }
  };

  const handleSendRepairEmail = async () => {
    if (!createdOrder) return;
    const email = customerEmail?.trim() || selectedCustomer?.email;
    if (!email) {
      toast.error('Khách hàng chưa có email');
      return;
    }
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke('send-export-email', {
        body: {
          tenant_id: tenantId,
          order_id: createdOrder.id,
          customer_name: createdOrder.customer_name || 'Khách lẻ',
          customer_email: email,
          customer_phone: createdOrder.customer_phone || '',
          items: [{
            product_name: `[Sửa chữa] ${createdOrder.device_name}`,
            imei: createdOrder.device_imei,
            sale_price: createdOrder.estimated_price,
            quantity: 1,
            warranty: '',
          }],
          total_amount: createdOrder.estimated_price,
          receipt_code: createdOrder.code,
          branch_id: createdOrder.branch_id,
          export_date: createdOrder.created_at,
          sales_staff_id: user?.id,
        },
      });
      if (error) throw error;
      toast.success(`Đã gửi email biên nhận đến ${email}`);
    } catch (err: any) {
      toast.error('Gửi email thất bại: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePrintReceipt = (includeQR = false) => {
    if (!createdOrder) return;
    const qrSection = includeQR && qrDataUrl ? `<div style="text-align:center;margin:10px 0"><img src="${qrDataUrl}" style="width:120px;height:120px" /><p style="font-size:10px;color:#999;margin-top:4px">Quét để tra cứu</p></div>` : '';
    const printContent = `
      <html><head><title>Phiếu sửa chữa ${createdOrder.code}</title>
      <style>body{font-family:Arial;padding:20px;max-width:300px;margin:0 auto}
      h2{text-align:center;margin-bottom:5px}
      .line{border-top:1px dashed #000;margin:8px 0}
      .row{display:flex;justify-content:space-between;font-size:13px;margin:3px 0}
      .label{color:#666}
      </style></head><body>
      <h2>PHIẾU SỬA CHỮA</h2>
      <p style="text-align:center;font-size:12px;color:#666">${createdOrder.code}</p>
      ${qrSection}
      <div class="line"></div>
      <div class="row"><span class="label">Thiết bị:</span><span>${createdOrder.device_name}</span></div>
      <div class="row"><span class="label">IMEI/Serial:</span><span>${createdOrder.device_imei || '-'}</span></div>
      <div class="row"><span class="label">Tình trạng:</span><span>${createdOrder.device_condition || '-'}</span></div>
      <div class="row"><span class="label">Khách hàng:</span><span>${createdOrder.customer_name || '-'}</span></div>
      <div class="row"><span class="label">SĐT:</span><span>${createdOrder.customer_phone || '-'}</span></div>
      <div class="line"></div>
      <div class="row"><span class="label">Ngày nhận:</span><span>${new Date(createdOrder.created_at).toLocaleDateString('vi')}</span></div>
      <div class="row"><span class="label">Hẹn trả:</span><span>${createdOrder.due_date ? new Date(createdOrder.due_date).toLocaleDateString('vi') : '-'}</span></div>
      <div class="row"><span class="label">Giá dự kiến:</span><span>${formatNumber(createdOrder.estimated_price)}đ</span></div>
      <div class="row"><span class="label">NV tiếp nhận:</span><span>${createdOrder.received_by_name || '-'}</span></div>
      ${createdOrder.note ? `<div class="row"><span class="label">Ghi chú:</span><span>${createdOrder.note}</span></div>` : ''}
      <div class="line"></div>
      <p style="text-align:center;font-size:11px;color:#999">Vui lòng giữ phiếu này để nhận máy</p>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(printContent);
      w.document.close();
      w.print();
    }
  };

  const resetForm = () => {
    setDeviceName('');
    setDeviceImei('');
    setDeviceModel('');
    setDevicePassword('');
    setDeviceCondition('');
    setQuantity(1);
    setDueDate('');
    setRequestTypeId('');
    setRequestTypeName('Sửa chữa');
    setStatus('received');
    setEstimatedPrice(0);
    setNote('');
    setTicketPasswordEnabled(false);
    setTicketPassword('');
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerEmail('');
    setCustomerSource('');
    setCustomerBirthday(undefined);
    setDeviceImages([]);
    setProductSearch('');
    setProductResults([]);
    setShowProductSearch(false);
    setShowDeviceForm(false);
  };

  const handleQRDialogClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setShowQRDialog(open);
  };

  const goToList = () => {
    navigate('/repair/list');
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Tạo phiếu sửa chữa" 
        description="Tiếp nhận thiết bị sửa chữa / bảo hành"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Device Info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Thông tin máy
                </h3>
                {showDeviceForm && (
                  <Button variant="ghost" size="sm" onClick={() => setShowDeviceForm(false)}>
                    <ChevronUp className="h-4 w-4 mr-1" /> Thu gọn
                  </Button>
                )}
              </div>

              {/* Product search - like sales page */}
              <div className="relative">
                <Label>Tìm sản phẩm / lịch sử sửa</Label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 relative">
                    <SearchInput
                      value={productSearch}
                      onChange={(v) => { setProductSearch(v); setShowProductSearch(true); }}
                      placeholder="Nhập IMEI/Serial hoặc tên sản phẩm..."
                    />
                    {showProductSearch && productResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                        {productResults.map(p => (
                          <button key={p.id} onClick={() => { selectProduct(p); setShowDeviceForm(true); }}
                            className="w-full text-left px-4 py-2 hover:bg-accent text-sm">
                            <div className="font-medium">{p.name}</div>
                            {p.imei && <div className="text-muted-foreground text-xs">IMEI: {p.imei}</div>}
                            {p.sku && !p.imei && <div className="text-muted-foreground text-xs">SKU: {p.sku}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={() => { setShowDeviceForm(true); setProductSearch(''); setShowProductSearch(false); }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Thêm mới
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Nhập IMEI hoặc tên sản phẩm để tìm nhanh. Nếu máy mới, bấm "Thêm mới".
                </p>
              </div>

              {/* Collapsible device form */}
              {showDeviceForm && (
                <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Tên thiết bị <span className="text-destructive">*</span></Label>
                  <Input value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="VD: iPhone 11 64GB Đen" />
                </div>
                <div>
                  <Label>IMEI / Serial <span className="text-destructive">*</span></Label>
                  <Input value={deviceImei} onChange={e => setDeviceImei(e.target.value)} placeholder="Nhập IMEI hoặc Serial" />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input value={deviceModel} onChange={e => setDeviceModel(e.target.value)} placeholder="VD: A2221" />
                </div>
                <div>
                  <Label>Số lượng</Label>
                  <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Ngày hẹn trả</Label>
                  <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div>
                  <Label>Chi nhánh</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
                    <SelectContent>
                      {branches?.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Request type + status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Loại yêu cầu</Label>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowTypeDialog(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Quản lý
                    </Button>
                  </div>
                  <Select value={requestTypeId || '_default'} onValueChange={v => {
                    if (v === '_default') {
                      setRequestTypeId('');
                      setRequestTypeName('Sửa chữa');
                    } else {
                      setRequestTypeId(v);
                      const found = requestTypes?.find(t => t.id === v);
                      setRequestTypeName(found?.name || 'Sửa chữa');
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_default">Sửa chữa</SelectItem>
                      <SelectItem value="_warranty">Bảo hành</SelectItem>
                      {requestTypes?.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trạng thái</Label>
                  <Select value={status} onValueChange={v => setStatus(v as RepairStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(REPAIR_STATUS_MAP).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Giá dự kiến</Label>
                <PriceInput value={estimatedPrice} onChange={setEstimatedPrice} placeholder="Nhập giá báo khách" />
              </div>

              <div>
                <Label>Tình trạng máy</Label>
                <Textarea value={deviceCondition} onChange={e => setDeviceCondition(e.target.value)} placeholder="Mô tả tình trạng: xước, vỡ kính, không lên nguồn..." rows={2} />
              </div>

              <div>
                <Label>Mật khẩu máy</Label>
                <Input value={devicePassword} onChange={e => setDevicePassword(e.target.value)} placeholder="Mật khẩu mở khóa (nếu có)" />
              </div>

              <div>
                <Label>Ghi chú phiếu</Label>
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." rows={2} />
              </div>

              {/* Ticket password */}
              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Mật khẩu phiếu</Label>
                  <p className="text-xs text-muted-foreground">Kỹ thuật viên phải nhập đúng mật khẩu mới mở được phiếu</p>
                </div>
                <Switch checked={ticketPasswordEnabled} onCheckedChange={setTicketPasswordEnabled} />
              </div>
              {ticketPasswordEnabled && (
                <div>
                  <Label>Nhập mật khẩu phiếu</Label>
                  <Input
                    type="text"
                    value={ticketPassword}
                    onChange={e => setTicketPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                  />
                </div>
              )}

              {/* Device images upload */}
              <div>
                <Label>Hình ảnh máy</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="flex flex-wrap gap-2 mt-1">
                  {deviceImages.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded border overflow-hidden group">
                      <img src={img} alt={`Device ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setDeviceImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl text-xs w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >×</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px]">Thêm</span>
                  </button>
                </div>
              </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Customer + Actions */}
        <div className="space-y-4">
           <Card>
            <CardContent className="pt-4 space-y-3">
              <CustomerSearchCombobox
                selectedCustomer={selectedCustomer}
                onSelect={setSelectedCustomer}
                onCustomerInfoChange={() => {}}
                customerName={customerName}
                customerPhone={customerPhone}
                customerAddress={customerAddress}
                customerEmail={customerEmail}
                customerSource={customerSource}
                customerBirthday={customerBirthday}
                setCustomerName={setCustomerName}
                setCustomerPhone={setCustomerPhone}
                setCustomerAddress={setCustomerAddress}
                setCustomerEmail={setCustomerEmail}
                setCustomerSource={setCustomerSource}
                setCustomerBirthday={setCustomerBirthday}
              />

              <div>
                <Label className="text-xs">NV tiếp nhận</Label>
                <Select
                  value={receivedById || '_none_'}
                  onValueChange={(v) => {
                    if (v === '_none_') {
                      setReceivedById(null);
                      setReceivedByName('');
                    } else {
                      setReceivedById(v);
                      const staff = staffList?.find(s => s.user_id === v);
                      setReceivedByName(staff?.display_name || '');
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Chọn nhân viên..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList?.map((staff) => (
                      <SelectItem key={staff.user_id} value={staff.user_id}>
                        {staff.display_name || 'Nhân viên'}
                        {staff.user_role === 'super_admin' && ' (Admin)'}
                        {staff.user_role === 'branch_admin' && ' (QL)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto email toggle */}
              <AutoEmailToggle
                id="auto-email-repair-create"
                checked={autoEmailEnabled}
                onCheckedChange={setAutoEmailEnabled}
                hasCustomerEmail={!!(customerEmail?.trim() || selectedCustomer?.email)}
              />
            </CardContent>
          </Card>

          <Button onClick={handleSubmit} className="w-full" size="lg" disabled={createOrder.isPending}>
            <Wrench className="h-4 w-4 mr-2" />
            {createOrder.isPending ? 'Đang tạo...' : 'Tạo yêu cầu sửa chữa'}
          </Button>
        </div>
      </div>

      {/* QR + Print Dialog */}
      <Dialog open={showQRDialog} onOpenChange={handleQRDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phiếu sửa chữa đã tạo</DialogTitle>
          </DialogHeader>
          {createdOrder && (
            <div className="space-y-3 text-sm">
              <div className="text-center">
                <Badge variant="outline" className="text-lg px-4 py-1">{createdOrder.code}</Badge>
              </div>
              {qrDataUrl && (
                <div className="text-center">
                  <img src={qrDataUrl} alt="QR Code" className="mx-auto w-28 h-28" />
                  <p className="text-xs text-muted-foreground mt-1">Dán mã này lên máy</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Thiết bị:</span> {createdOrder.device_name}</div>
                <div><span className="text-muted-foreground">IMEI:</span> {createdOrder.device_imei || '-'}</div>
                <div><span className="text-muted-foreground">Khách:</span> {createdOrder.customer_name || '-'}</div>
                <div><span className="text-muted-foreground">Giá DK:</span> {formatNumber(createdOrder.estimated_price)}đ</div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => handlePrintReceipt(false)}>
              <Printer className="h-4 w-4 mr-2" /> In phiếu
            </Button>
            <Button variant="outline" onClick={() => {
              if (!createdOrder) return;
              setBarcodeProducts([{
                id: createdOrder.id,
                name: createdOrder.device_name,
                sku: createdOrder.code,
                imei: createdOrder.device_imei || undefined,
                importPrice: 0,
                salePrice: createdOrder.estimated_price,
              }]);
              setBarcodeDialogOpen(true);
            }}>
              <QrCode className="h-4 w-4 mr-2" /> In QR
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSendRepairEmail}
              disabled={sendingEmail || !(customerEmail?.trim() || selectedCustomer?.email)}
            >
              {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Gửi mail
            </Button>
            <Button onClick={goToList}>
              Xem danh sách
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Type Management Dialog */}
      <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quản lý loại yêu cầu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="Tên loại mới..." className="flex-1" />
              <Button size="sm" onClick={async () => {
                if (!newTypeName.trim()) return;
                await createRequestType.mutateAsync({ name: newTypeName, tenant_id: tenantId });
                setNewTypeName('');
              }} disabled={createRequestType.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground px-2 py-1">Mặc định:</div>
              <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded">
                <span className="text-sm">Sửa chữa</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded">
                <span className="text-sm">Bảo hành</span>
              </div>
              {requestTypes?.map(t => (
                <div key={t.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                  <span className="text-sm">{t.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRequestType.mutate(t.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode/QR Print Dialog */}
      <BarcodeDialog
        open={barcodeDialogOpen}
        onClose={() => {
          setBarcodeDialogOpen(false);
          setBarcodeProducts([]);
        }}
        products={barcodeProducts}
      />
    </MainLayout>
  );
}
