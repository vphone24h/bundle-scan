import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  ShoppingCart, 
  Trash2, 
  Search, 
  Plus, 
  User, 
  MapPin, 
  Mail,
  CreditCard,
  Banknote,
  ScanBarcode,
  CalendarIcon,
  Cake
} from 'lucide-react';
import { useCheckProductForSale, useSearchProductsByName, useCreateExportReceipt, type ExportReceiptItem, type ExportPayment } from '@/hooks/useExportReceipts';
import { useUpsertCustomer } from '@/hooks/useCustomers';
import { useDefaultInvoiceTemplate } from '@/hooks/useInvoiceTemplates';
import { usePointSettings } from '@/hooks/useCustomerPoints';
import { ExportPaymentDialog } from '@/components/export/ExportPaymentDialog';
import { InvoicePrintDialog } from '@/components/export/InvoicePrintDialog';
import { BarcodeScannerInput } from '@/components/export/BarcodeScannerInput';
import { CustomerSearchCombobox } from '@/components/export/CustomerSearchCombobox';
import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
import { PriceInput } from '@/components/ui/price-input';
import { cn } from '@/lib/utils';

interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  email: string | null;
  current_points: number;
  pending_points: number;
  total_spent: number;
  membership_tier: 'regular' | 'silver' | 'gold' | 'vip';
  status: 'active' | 'inactive';
  birthday: string | null;
}

interface CartItem extends ExportReceiptItem {
  tempId: string;
  categoryName?: string;
  branchName?: string;
  quantity: number;
  warranty?: string;
}

export default function ExportNewPage() {
  // Form states
  const [imeiSearch, setImeiSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [salePrice, setSalePrice] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemWarranty, setItemWarranty] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerBirthday, setCustomerBirthday] = useState<Date | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<any>(null);

  // Hooks
  const checkProduct = useCheckProductForSale();
  const searchProducts = useSearchProductsByName();
  const upsertCustomer = useUpsertCustomer();
  const createReceipt = useCreateExportReceipt();
  const { data: invoiceTemplate } = useDefaultInvoiceTemplate();
  const { data: pointSettings } = usePointSettings();

  // Handle barcode scan (IMEI or SKU) - fill form instead of auto-add to cart
  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return;

    const result = await checkProduct.mutateAsync(barcode.trim());
    
    if (!result) {
      toast({
        title: 'Không tìm thấy',
        description: `Mã "${barcode}" không tồn tại trong hệ thống`,
        variant: 'destructive',
      });
      return;
    }

    if (result.status !== 'in_stock') {
      toast({
        title: 'Không thể bán',
        description: `Sản phẩm này đang ở trạng thái "${result.status === 'sold' ? 'Đã bán' : 'Đã trả'}" và chưa được nhập lại`,
        variant: 'destructive',
      });
      return;
    }

    // Check if already in cart
    if (cart.some(item => item.imei === result.imei || item.product_id === result.id)) {
      toast({
        title: 'Đã có trong giỏ',
        description: 'Sản phẩm này đã được thêm vào giỏ hàng',
        variant: 'destructive',
      });
      return;
    }

    // Fill form with product info for user to review/edit before adding to cart
    setSelectedProduct(result);
    setSalePrice(result.import_price?.toString() || '');
    setItemQuantity(result.imei ? 1 : 1);
    setItemWarranty('');
    setItemNote('');
    setNameSearch('');
    setProductSuggestions([]);
    
    toast({
      title: 'Đã quét thành công',
      description: `${result.name} - Vui lòng kiểm tra và nhấn "Thêm vào giỏ"`,
    });
  };

  // Search by IMEI (manual)
  const handleImeiSearch = async () => {
    if (!imeiSearch.trim()) return;
    await handleBarcodeScan(imeiSearch.trim());
    setImeiSearch('');
  };

  // Search by name (debounced)
  useEffect(() => {
    if (nameSearch.length >= 1) {
      const timer = setTimeout(async () => {
        const results = await searchProducts.mutateAsync(nameSearch);
        setProductSuggestions(results || []);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setProductSuggestions([]);
    }
  }, [nameSearch]);

  // Select product from suggestions
  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setSalePrice(product.import_price?.toString() || '');
    setItemQuantity(product.imei ? 1 : 1); // Default to 1, user can change for non-IMEI
    setNameSearch('');
    setProductSuggestions([]);
  };


  // Add to cart
  const handleAddToCart = () => {
    if (!selectedProduct) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn sản phẩm',
        variant: 'destructive',
      });
      return;
    }

    if (!salePrice || parseFloat(salePrice) <= 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập giá bán hợp lệ',
        variant: 'destructive',
      });
      return;
    }

    const quantity = selectedProduct.imei ? 1 : itemQuantity;
    
    const newItem: CartItem = {
      tempId: Date.now().toString(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      sku: selectedProduct.sku,
      imei: selectedProduct.imei,
      category_id: selectedProduct.category_id,
      categoryName: selectedProduct.categories?.name,
      branch_id: selectedProduct.branch_id,
      branchName: selectedProduct.branches?.name,
      sale_price: parseFloat(salePrice),
      note: itemNote || null,
      quantity: quantity,
      warranty: itemWarranty || null,
    };

    setCart([...cart, newItem]);
    setSelectedProduct(null);
    setSalePrice('');
    setItemNote('');
    setItemQuantity(1);
    setItemWarranty('');
    
    toast({
      title: 'Đã thêm vào giỏ',
      description: `${newItem.product_name} đã được thêm vào giỏ hàng`,
    });
  };

  // Remove from cart
  const handleRemoveFromCart = (tempId: string) => {
    setCart(cart.filter(item => item.tempId !== tempId));
  };

  // Update cart item price
  const handleUpdateCartPrice = (tempId: string, newPrice: number) => {
    setCart(cart.map(item => 
      item.tempId === tempId ? { ...item, sale_price: newPrice } : item
    ));
  };

  // Update cart item quantity (for non-IMEI products)
  const handleUpdateCartQuantity = (tempId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setCart(cart.map(item => 
      item.tempId === tempId ? { ...item, quantity: newQuantity } : item
    ));
  };

  // Calculate totals
  const totalAmount = cart.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0);

  // Handle proceed to payment
  const handleProceedToPayment = () => {
    if (cart.length === 0) {
      toast({
        title: 'Giỏ hàng trống',
        description: 'Vui lòng thêm sản phẩm vào giỏ hàng',
        variant: 'destructive',
      });
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng nhập tên và số điện thoại khách hàng',
        variant: 'destructive',
      });
      return;
    }

    setShowPaymentDialog(true);
  };

  // Handle payment completion
  const handlePaymentComplete = async (payments: ExportPayment[], pointsRedeemed: number, pointsDiscount: number) => {
    try {
      // Create or update customer
      const customer = await upsertCustomer.mutateAsync({
        name: customerName,
        phone: customerPhone,
        address: customerAddress || null,
        email: customerEmail || null,
        birthday: customerBirthday ? format(customerBirthday, 'yyyy-MM-dd') : null,
      });

      // Get branch_id from first cart item
      const branchId = cart.find(item => item.branch_id)?.branch_id || null;

      // Create export receipt with points and branch
      const receipt = await createReceipt.mutateAsync({
        customerId: customer.id,
        items: cart.map(({ tempId, categoryName, branchName, ...item }) => item),
        payments,
        pointsRedeemed,
        pointsDiscount,
        branchId,
      });

      setCreatedReceipt({
        ...receipt,
        customer,
        items: cart,
        payments,
      });
      
      setShowPaymentDialog(false);
      setShowInvoiceDialog(true);

      // Reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerEmail('');
      setCustomerBirthday(undefined);
      setSelectedCustomer(null);

      // Build success message with points info
      let successMessage = `Phiếu xuất ${receipt.code} đã được tạo`;
      if (receipt.points_earned > 0) {
        successMessage += receipt.points_pending 
          ? `. Khách được ${receipt.points_earned} điểm (treo - chờ thanh toán đủ)`
          : `. Khách được cộng ${receipt.points_earned} điểm`;
      }

      toast({
        title: 'Xuất hàng thành công',
        description: successMessage,
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tạo phiếu xuất',
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Tạo phiếu xuất hàng"
        description="Xuất hàng và ghi nhận bán hàng"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search product */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ScanBarcode className="h-5 w-5" />
                Quét mã vạch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Barcode Scanner */}
              <BarcodeScannerInput
                onScan={handleBarcodeScan}
                placeholder="Quét mã vạch sản phẩm (IMEI/SKU)..."
                disabled={checkProduct.isPending}
              />
              
              <p className="text-xs text-muted-foreground">
                Sử dụng máy quét mã vạch hoặc nhập thủ công. Sản phẩm sẽ tự động được thêm vào giỏ hàng.
              </p>
            </CardContent>
          </Card>

          {/* Manual Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Tìm thủ công
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* IMEI Search */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Tìm theo IMEI</Label>
                  <Input
                    placeholder="Nhập IMEI và Enter"
                    value={imeiSearch}
                    onChange={(e) => setImeiSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleImeiSearch()}
                  />
                </div>
                <Button 
                  className="mt-6" 
                  onClick={handleImeiSearch}
                  disabled={checkProduct.isPending}
                >
                  Tìm
                </Button>
              </div>

              {/* Name Search */}
              <div className="relative">
                <Label>Hoặc tìm theo tên sản phẩm (không IMEI)</Label>
                <Input
                  placeholder="Nhập tên sản phẩm..."
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                />
                {productSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                    {productSuggestions.map((product) => (
                      <button
                        key={product.id}
                        className="w-full px-4 py-2 text-left hover:bg-accent text-sm"
                        onClick={() => handleSelectProduct(product)}
                      >
                        <div className="font-medium">{product.name}</div>
                        <div className="text-muted-foreground text-xs">
                          SKU: {product.sku} | {product.categories?.name || 'Chưa phân loại'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected product info */}
              {selectedProduct && (
                <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{selectedProduct.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        SKU: {selectedProduct.sku}
                        {selectedProduct.imei && ` | IMEI: ${selectedProduct.imei}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Danh mục: {selectedProduct.categories?.name || 'Chưa phân loại'}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {selectedProduct.status === 'in_stock' ? 'Còn hàng' : selectedProduct.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Giá bán</Label>
                      <PriceInput
                        placeholder="Nhập giá bán"
                        value={salePrice}
                        onChange={(val) => setSalePrice(val.toString())}
                      />
                    </div>
                    {!selectedProduct.imei && (
                      <div>
                        <Label>Số lượng</Label>
                        <Input
                          type="number"
                          min={1}
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="text-center"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Bảo hành</Label>
                      <Input
                        placeholder="VD: 12 tháng"
                        value={itemWarranty}
                        onChange={(e) => setItemWarranty(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Ghi chú</Label>
                      <Input
                        placeholder="Ghi chú (tùy chọn)"
                        value={itemNote}
                        onChange={(e) => setItemNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button onClick={handleAddToCart} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm vào giỏ hàng
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Giỏ hàng ({cart.length} sản phẩm)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có sản phẩm nào trong giỏ hàng
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead className="hidden md:table-cell">IMEI/SKU</TableHead>
                      <TableHead className="hidden sm:table-cell">Danh mục</TableHead>
                      <TableHead className="text-center w-20">SL</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.tempId}>
                        <TableCell className="font-medium">
                          <div>{item.product_name}</div>
                          <div className="text-xs text-muted-foreground md:hidden">
                            {item.imei || item.sku}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {item.imei || item.sku}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{item.categoryName || '-'}</TableCell>
                        <TableCell className="text-center">
                          {item.imei ? (
                            <span className="text-sm font-medium">1</span>
                          ) : (
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleUpdateCartQuantity(item.tempId, Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 text-center h-8"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <PriceInput
                            value={item.sale_price}
                            onChange={(val) => handleUpdateCartPrice(item.tempId, val)}
                            className="w-28 text-right font-medium"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatNumber(item.sale_price * item.quantity)}đ
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFromCart(item.tempId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {cart.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="font-medium">Tổng tiền:</span>
                  <span className="text-xl font-bold text-primary">
                    {totalAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Customer info & payment */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Thông tin khách hàng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Search Combobox */}
              <CustomerSearchCombobox
                selectedCustomer={selectedCustomer}
                onSelect={setSelectedCustomer}
                onCustomerInfoChange={() => {}}
                customerName={customerName}
                customerPhone={customerPhone}
                customerAddress={customerAddress}
                customerEmail={customerEmail}
                setCustomerName={setCustomerName}
                setCustomerPhone={setCustomerPhone}
                setCustomerAddress={setCustomerAddress}
                setCustomerEmail={setCustomerEmail}
              />

              {/* Additional fields - always show */}
              <div>
                <Label className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Địa chỉ
                </Label>
                <Input
                  placeholder="Địa chỉ (tùy chọn)"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
              </div>

              <div>
                <Label className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </Label>
                <Input
                  type="email"
                  placeholder="Email (tùy chọn)"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>

              <div>
                <Label className="flex items-center gap-1">
                  <Cake className="h-3 w-3" />
                  Ngày sinh
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customerBirthday && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customerBirthday ? (
                        format(customerBirthday, "dd/MM/yyyy", { locale: vi })
                      ) : (
                        <span>Chọn ngày sinh (tùy chọn)</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customerBirthday}
                      onSelect={setCustomerBirthday}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      captionLayout="dropdown-buttons"
                      fromYear={1920}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Payment summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Thanh toán
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Số lượng sản phẩm:</span>
                  <span className="font-medium">{cart.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Tổng tiền:</span>
                  <span className="text-xl font-bold text-primary">
                    {totalAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleProceedToPayment}
                disabled={cart.length === 0 || createReceipt.isPending}
              >
                <Banknote className="h-4 w-4 mr-2" />
                Tiến hành thanh toán
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Dialog */}
      <ExportPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        totalAmount={totalAmount}
        onConfirm={handlePaymentComplete}
        isLoading={createReceipt.isPending || upsertCustomer.isPending}
        customerPoints={selectedCustomer ? {
          current_points: selectedCustomer.current_points,
          pending_points: selectedCustomer.pending_points,
          membership_tier: selectedCustomer.membership_tier,
        } : null}
        pointSettings={pointSettings ? {
          is_enabled: pointSettings.is_enabled,
          redeem_points: pointSettings.redeem_points,
          redeem_value: pointSettings.redeem_value,
          max_redeem_percentage: pointSettings.max_redeem_percentage,
        } : null}
      />

      {/* Invoice Print Dialog */}
      <InvoicePrintDialog
        open={showInvoiceDialog}
        onOpenChange={setShowInvoiceDialog}
        receipt={createdReceipt}
        template={invoiceTemplate}
      />
    </MainLayout>
  );
}
