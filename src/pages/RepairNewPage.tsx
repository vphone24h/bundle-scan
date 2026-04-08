
import React, { useState, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PriceInput } from '@/components/ui/price-input';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
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
import { Wrench, QrCode, Printer, Plus, Trash2, Search, UserPlus, Camera, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [branchId, setBranchId] = useState(defaultBranch?.id || '');

  // Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

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

  // Device images
  const [deviceImages, setDeviceImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [receivedById, setReceivedById] = useState<string | null>(user?.id || null);
  const [receivedByName, setReceivedByName] = useState<string>(displayName || '');

  // Set default branch
  React.useEffect(() => {
    if (defaultBranch?.id && !branchId) setBranchId(defaultBranch.id);
  }, [defaultBranch]);

  // Search customers
  const searchCustomers = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setCustomerResults([]); return; }
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, email')
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
      .limit(10);
    setCustomerResults(data || []);
  }, []);

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
    const t = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  React.useEffect(() => {
    const t = setTimeout(() => searchProducts(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const selectCustomer = (c: any) => {
    setCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerSearch('');
    setShowCustomerSearch(false);
  };

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

    const order = await createOrder.mutateAsync({
      tenant_id: tenantId,
      branch_id: branchId || null,
      customer_id: customerId,
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
    } as any);

    // Generate QR code
    try {
      const qrUrl = await QRCode.toDataURL(order.code, { width: 150, margin: 1 });
      setQrDataUrl(qrUrl);
    } catch { setQrDataUrl(''); }

    setCreatedOrder(order);
    setShowQRDialog(true);
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
              <h3 className="font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Thông tin máy
              </h3>

              {/* Product search */}
              <div className="relative">
                <Label>Tìm sản phẩm / lịch sử sửa</Label>
                <SearchInput
                  value={productSearch}
                  onChange={(v) => { setProductSearch(v); setShowProductSearch(true); }}
                  placeholder="Tìm theo tên, IMEI, SKU..."
                />
                {showProductSearch && productResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                    {productResults.map(p => (
                      <button key={p.id} onClick={() => selectProduct(p)}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm">
                        <div className="font-medium">{p.name}</div>
                        {p.imei && <span className="text-xs text-muted-foreground">IMEI: {p.imei}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
            </CardContent>
          </Card>
        </div>

        {/* Right: Customer + Actions */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <h3 className="font-semibold">Khách hàng</h3>
              <div className="relative">
                <SearchInput
                  value={customerSearch}
                  onChange={v => { setCustomerSearch(v); setShowCustomerSearch(true); }}
                  placeholder="Tìm theo tên, SĐT..."
                />
                {showCustomerSearch && customerResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-auto">
                    {customerResults.map(c => (
                      <button key={c.id} onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground ml-2">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {customerId ? (
                <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                  <div className="font-medium">{customerName}</div>
                  <div className="text-muted-foreground">{customerPhone}</div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                    setCustomerId(null); setCustomerName(''); setCustomerPhone('');
                  }}>Bỏ chọn</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <Label className="text-xs">Tên khách</Label>
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nhập tên" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">SĐT</Label>
                    <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Nhập SĐT" className="h-8 text-sm" />
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                NV tiếp nhận: <span className="font-medium text-foreground">{displayName || 'Chưa xác định'}</span>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSubmit} className="w-full" size="lg" disabled={createOrder.isPending}>
            <Wrench className="h-4 w-4 mr-2" />
            {createOrder.isPending ? 'Đang tạo...' : 'Tạo yêu cầu sửa chữa'}
          </Button>
        </div>
      </div>

      {/* QR + Print Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
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
            <Button variant="outline" onClick={() => handlePrintReceipt(true)}>
              <QrCode className="h-4 w-4 mr-2" /> In phiếu + QR
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
    </MainLayout>
  );
}
