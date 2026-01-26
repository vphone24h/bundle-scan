import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Phone, 
  MapPin, 
  Mail,
  CreditCard,
  Wallet,
  Banknote,
  FileText,
  Printer
} from 'lucide-react';
import { useCheckProductForSale, useSearchProductsByName, useCreateExportReceipt, type ExportReceiptItem, type ExportPayment } from '@/hooks/useExportReceipts';
import { useSearchCustomerByPhone, useUpsertCustomer } from '@/hooks/useCustomers';
import { useDefaultInvoiceTemplate } from '@/hooks/useInvoiceTemplates';
import { ExportPaymentDialog } from '@/components/export/ExportPaymentDialog';
import { InvoicePrintDialog } from '@/components/export/InvoicePrintDialog';

interface CartItem extends ExportReceiptItem {
  tempId: string;
  categoryName?: string;
}

export default function ExportNewPage() {
  // Form states
  const [imeiSearch, setImeiSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [salePrice, setSalePrice] = useState('');
  const [itemNote, setItemNote] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<any>(null);

  // Hooks
  const checkProduct = useCheckProductForSale();
  const searchProducts = useSearchProductsByName();
  const searchCustomers = useSearchCustomerByPhone();
  const upsertCustomer = useUpsertCustomer();
  const createReceipt = useCreateExportReceipt();
  const { data: invoiceTemplate } = useDefaultInvoiceTemplate();

  // Search by IMEI
  const handleImeiSearch = async () => {
    if (!imeiSearch.trim()) return;

    const result = await checkProduct.mutateAsync(imeiSearch.trim());
    
    if (!result) {
      toast({
        title: 'Không tìm thấy',
        description: 'IMEI này không tồn tại trong hệ thống',
        variant: 'destructive',
      });
      return;
    }

    if (result.status !== 'in_stock') {
      toast({
        title: 'Không thể bán',
        description: `IMEI này đang ở trạng thái "${result.status === 'sold' ? 'Đã bán' : 'Đã trả'}" và chưa được nhập lại`,
        variant: 'destructive',
      });
      return;
    }

    // Check if already in cart
    if (cart.some(item => item.imei === result.imei)) {
      toast({
        title: 'Đã có trong giỏ',
        description: 'Sản phẩm này đã được thêm vào giỏ hàng',
        variant: 'destructive',
      });
      return;
    }

    setSelectedProduct(result);
    setSalePrice(result.import_price?.toString() || '');
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

  // Search customers by phone
  useEffect(() => {
    if (customerPhone.length >= 3) {
      const timer = setTimeout(async () => {
        const results = await searchCustomers.mutateAsync(customerPhone);
        setCustomerSuggestions(results || []);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setCustomerSuggestions([]);
    }
  }, [customerPhone]);

  // Select product from suggestions
  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setSalePrice(product.import_price?.toString() || '');
    setNameSearch('');
    setProductSuggestions([]);
  };

  // Select customer from suggestions
  const handleSelectCustomer = (customer: any) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerAddress(customer.address || '');
    setCustomerEmail(customer.email || '');
    setCustomerSuggestions([]);
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

    const newItem: CartItem = {
      tempId: Date.now().toString(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      sku: selectedProduct.sku,
      imei: selectedProduct.imei,
      category_id: selectedProduct.category_id,
      categoryName: selectedProduct.categories?.name,
      sale_price: parseFloat(salePrice),
      note: itemNote || null,
    };

    setCart([...cart, newItem]);
    setSelectedProduct(null);
    setSalePrice('');
    setItemNote('');
    
    toast({
      title: 'Đã thêm vào giỏ',
      description: `${newItem.product_name} đã được thêm vào giỏ hàng`,
    });
  };

  // Remove from cart
  const handleRemoveFromCart = (tempId: string) => {
    setCart(cart.filter(item => item.tempId !== tempId));
  };

  // Calculate totals
  const totalAmount = cart.reduce((sum, item) => sum + item.sale_price, 0);

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
  const handlePaymentComplete = async (payments: ExportPayment[]) => {
    try {
      // Create or update customer
      const customer = await upsertCustomer.mutateAsync({
        name: customerName,
        phone: customerPhone,
        address: customerAddress || null,
        email: customerEmail || null,
      });

      // Create export receipt
      const receipt = await createReceipt.mutateAsync({
        customerId: customer.id,
        items: cart.map(({ tempId, categoryName, ...item }) => item),
        payments,
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

      toast({
        title: 'Xuất hàng thành công',
        description: `Phiếu xuất ${receipt.code} đã được tạo`,
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
                <Search className="h-5 w-5" />
                Tìm sản phẩm
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
                      <Input
                        type="number"
                        placeholder="Nhập giá bán"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
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
                      <TableHead>IMEI/SKU</TableHead>
                      <TableHead>Danh mục</TableHead>
                      <TableHead className="text-right">Giá bán</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.tempId}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>
                          {item.imei || item.sku}
                        </TableCell>
                        <TableCell>{item.categoryName || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item.sale_price.toLocaleString('vi-VN')}đ
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
              <div className="relative">
                <Label className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Số điện thoại <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Nhập SĐT khách hàng"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                {customerSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-auto">
                    {customerSuggestions.map((customer) => (
                      <button
                        key={customer.id}
                        className="w-full px-4 py-2 text-left hover:bg-accent text-sm"
                        onClick={() => handleSelectCustomer(customer)}
                      >
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-muted-foreground text-xs">{customer.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Tên khách hàng <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Nhập tên khách hàng"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

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
                  placeholder="Email (tùy chọn)"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
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
