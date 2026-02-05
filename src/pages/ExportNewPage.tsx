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
import { Checkbox } from '@/components/ui/checkbox';
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
  Cake,
  Percent
} from 'lucide-react';
import { useCheckProductForSale, useSearchProductsByName, useCreateExportReceipt, type ExportReceiptItem, type ExportPayment } from '@/hooks/useExportReceipts';
import { useUpsertCustomer } from '@/hooks/useCustomers';
import { useInvoiceTemplateByBranch } from '@/hooks/useInvoiceTemplates';
import { useBranches } from '@/hooks/useBranches';
import { usePointSettings } from '@/hooks/useCustomerPoints';
import { ExportPaymentDialog } from '@/components/export/ExportPaymentDialog';
import { InvoicePrintDialog } from '@/components/export/InvoicePrintDialog';
import { BarcodeScannerInput } from '@/components/export/BarcodeScannerInput';
import { CustomerSearchCombobox } from '@/components/export/CustomerSearchCombobox';
import { CustomerSourceSelect } from '@/components/customers/CustomerSourceSelect';
import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
import { PriceInput } from '@/components/ui/price-input';
import { cn } from '@/lib/utils';

interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  email: string | null;
  source: string | null;
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

  // Tax state
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState<number | null>(null);
  const [customTaxRate, setCustomTaxRate] = useState('');

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerSource, setCustomerSource] = useState('');
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
  const { data: pointSettings } = usePointSettings();
  const { data: branches } = useBranches();
  
  // Get branch_id from first cart item for invoice template
  const cartBranchId = cart.find(item => item.branch_id)?.branch_id || null;
  const { data: invoiceTemplate } = useInvoiceTemplateByBranch(cartBranchId);
  const cartBranch = cartBranchId ? branches?.find(b => b.id === cartBranchId) : null;

  // Calculate tax
  const effectiveTaxRate = taxEnabled ? (taxRate !== null ? taxRate : parseFloat(customTaxRate) || 0) : 0;

  // Handle barcode scan (IMEI or SKU) - auto-add to cart if price encoded
  // Supports formats:
  // - N:NAME:PRICE (non-IMEI products, e.g., "N:iPhone 15:24000000") - auto add to cart with qty=1
  // - CODE:PRICE (IMEI products, e.g., "353902103999926:24000000") - auto add to cart
  // - CODE-P-PRICE (legacy) - auto add to cart
  // - CODE|PRICE (legacy) - auto add to cart
  // - CODE only (no price) - fill form for manual entry
  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return;

    // Parse barcode - check if it contains price info
    let searchCode = barcode.trim();
    let encodedPrice: number | null = null;
    let isNonImeiBarcode = false;
    let nonImeiProductName: string | null = null;
    
    // Check for non-IMEI format: N:NAME:PRICE
    if (barcode.startsWith('N:')) {
      isNonImeiBarcode = true;
      const parts = barcode.substring(2).split(':'); // Remove "N:" prefix
      if (parts.length >= 2) {
        // Last part is price, everything before is product name
        const priceStr = parts[parts.length - 1];
        nonImeiProductName = parts.slice(0, -1).join(':'); // Handle names with ":"
        if (priceStr && !isNaN(parseInt(priceStr))) {
          encodedPrice = parseInt(priceStr);
        }
      }
    }
    // Check for ":" delimiter (IMEI format - most compatible)
    else if (barcode.includes(':')) {
      const parts = barcode.split(':');
      searchCode = parts[0];
      const priceStr = parts[1];
      if (priceStr && !isNaN(parseInt(priceStr))) {
        encodedPrice = parseInt(priceStr);
      }
    }
    // Check for "-P-" delimiter (legacy format)
    else if (barcode.includes('-P-')) {
      const parts = barcode.split('-P-');
      searchCode = parts[0];
      const priceStr = parts[1];
      if (priceStr && !isNaN(parseInt(priceStr))) {
        encodedPrice = parseInt(priceStr);
      }
    } 
    // Fallback to "|" delimiter (legacy format)
    else if (barcode.includes('|')) {
      const parts = barcode.split('|');
      searchCode = parts[0];
      const priceStr = parts[1];
      if (priceStr && !isNaN(parseInt(priceStr))) {
        encodedPrice = parseInt(priceStr);
      }
    }

    // Handle non-IMEI product barcode: AUTO ADD to cart with qty=1
    if (isNonImeiBarcode && nonImeiProductName && encodedPrice !== null && encodedPrice > 0) {
      // Search for the product by name to get full details
      const results = await searchProducts.mutateAsync(nonImeiProductName);
      const matchedProduct = results?.find((p: any) => p.name === nonImeiProductName);
      
      if (matchedProduct) {
        // Check if already in cart - for non-IMEI, we can increase quantity
        const existingItem = cart.find(item => item.product_id === matchedProduct.id && item.sale_price === encodedPrice);
        
        if (existingItem) {
          // Increase quantity for same product with same price
          setCart(prevCart => prevCart.map(item => 
            item.tempId === existingItem.tempId 
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ));
          
          toast({
            title: 'Đã tăng số lượng',
            description: `${nonImeiProductName} x${existingItem.quantity + 1}`,
          });
        } else {
          // Add new item to cart with qty=1
          const newItem: CartItem = {
            tempId: Date.now().toString(),
            product_id: matchedProduct.id,
            product_name: matchedProduct.name,
            sku: matchedProduct.sku,
            imei: null,
            category_id: matchedProduct.category_id,
            categoryName: matchedProduct.categories?.name,
            branch_id: matchedProduct.branch_id,
            branchName: matchedProduct.branches?.name,
            sale_price: encodedPrice,
            note: null,
            quantity: 1,
            warranty: null,
          };

          setCart(prevCart => [...prevCart, newItem]);
          
          toast({
            title: 'Đã thêm vào giỏ',
            description: `${nonImeiProductName} - ${encodedPrice.toLocaleString('vi-VN')}đ`,
          });
        }
        
        // Clear form for next scan
        setSelectedProduct(null);
        setSalePrice('');
        setItemNote('');
        setItemQuantity(1);
        setItemWarranty('');
        setNameSearch('');
        setProductSuggestions([]);
      } else {
        toast({
          title: 'Không tìm thấy',
          description: `Sản phẩm "${nonImeiProductName}" không tồn tại trong kho`,
          variant: 'destructive',
        });
      }
      return;
    }

    const result = await checkProduct.mutateAsync(searchCode);
    
    if (!result) {
      toast({
        title: 'Không tìm thấy',
        description: `Mã "${searchCode}" không tồn tại trong hệ thống`,
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

    // If barcode has encoded price -> AUTO ADD TO CART (IMEI products only)
    if (encodedPrice !== null && encodedPrice > 0) {
      const newItem: CartItem = {
        tempId: Date.now().toString(),
        product_id: result.id,
        product_name: result.name,
        sku: result.sku,
        imei: result.imei,
        category_id: result.category_id,
        categoryName: result.categories?.name,
        branch_id: result.branch_id,
        branchName: result.branches?.name,
        sale_price: encodedPrice,
        note: null,
        quantity: 1,
        warranty: null,
      };

      setCart(prevCart => [...prevCart, newItem]);
      
      // Clear form for next scan
      setSelectedProduct(null);
      setSalePrice('');
      setItemNote('');
      setItemQuantity(1);
      setItemWarranty('');
      setImeiSearch('');
      
      toast({
        title: 'Đã thêm vào giỏ',
        description: `${result.name} - ${encodedPrice.toLocaleString('vi-VN')}đ`,
      });
      return;
    }

    // No price encoded -> Fill form for manual entry (don't reveal import price)
    setSelectedProduct(result);
    setSalePrice(''); // Leave empty - don't reveal import price
    setItemQuantity(result.imei ? 1 : 1);
    setItemWarranty('');
    setItemNote('');
    setNameSearch('');
    setProductSuggestions([]);
    
    toast({
      title: 'Đã quét thành công',
      description: `${result.name} - Vui lòng nhập giá bán và nhấn "Thêm vào giỏ"`,
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
    setSalePrice(''); // Leave empty - don't reveal import price
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
  const subtotalAmount = cart.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0);
  const taxAmount = Math.round(subtotalAmount * effectiveTaxRate / 100);
  const totalAmount = subtotalAmount + taxAmount;

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

    // Validate all products are from the same branch
    const branchIds = cart.map(item => item.branch_id).filter(Boolean);
    const uniqueBranches = [...new Set(branchIds)];
    if (uniqueBranches.length > 1) {
      // Get branch names for error message
      const branchNames = cart
        .filter(item => item.branchName)
        .reduce((acc, item) => {
          if (item.branch_id && !acc.find(b => b.id === item.branch_id)) {
            acc.push({ id: item.branch_id, name: item.branchName || 'N/A' });
          }
          return acc;
        }, [] as { id: string; name: string }[]);
      
      toast({
        title: 'Lỗi nhiều chi nhánh',
        description: `Phiếu xuất không thể chứa sản phẩm từ nhiều chi nhánh khác nhau: ${branchNames.map(b => b.name).join(', ')}. Vui lòng xóa bớt sản phẩm để chỉ còn 1 chi nhánh.`,
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
        source: customerSource || null,
      });

      // Get branch_id from first cart item
      const branchId = cart.find(item => item.branch_id)?.branch_id || null;

      // Create export receipt with points, branch and VAT
      const receipt = await createReceipt.mutateAsync({
        customerId: customer.id,
        items: cart.map(({ tempId, categoryName, branchName, ...item }) => item),
        payments,
        pointsRedeemed,
        pointsDiscount,
        branchId,
        vatRate: effectiveTaxRate,
        vatAmount: taxAmount,
      });

      setCreatedReceipt({
        ...receipt,
        customer,
        items: cart,
        payments,
        // Tax info for invoice
        subtotal_amount: subtotalAmount,
        tax_rate: taxEnabled ? effectiveTaxRate : 0,
        tax_amount: taxEnabled ? taxAmount : 0,
      });
      
      setShowPaymentDialog(false);
      setShowInvoiceDialog(true);

      // Reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerEmail('');
      setCustomerSource('');
      setCustomerBirthday(undefined);
      setSelectedCustomer(null);
      setTaxEnabled(false);
      setTaxRate(null);
      setCustomTaxRate('');

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
                Quét mã vạch có giá → tự động thêm vào giỏ. Quét mã không có giá → điền form để nhập giá bán.
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
                <div className="mt-4 pt-4 border-t space-y-3">
                  {/* Tax Section */}
                  <div className="p-3 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enable-tax"
                        checked={taxEnabled}
                        onCheckedChange={(checked) => {
                          setTaxEnabled(checked === true);
                          if (!checked) {
                            setTaxRate(null);
                            setCustomTaxRate('');
                          } else if (taxRate === null) {
                            setTaxRate(10); // Default to 10%
                          }
                        }}
                      />
                      <Label htmlFor="enable-tax" className="flex items-center gap-2 cursor-pointer font-medium">
                        <Percent className="h-4 w-4" />
                        Tính thuế VAT
                      </Label>
                    </div>
                    
                    {taxEnabled && (
                      <div className="flex flex-wrap gap-2 ml-6">
                        {[1.5, 8, 10].map((rate) => (
                          <Button
                            key={rate}
                            variant={taxRate === rate ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              setTaxRate(rate);
                              setCustomTaxRate('');
                            }}
                          >
                            {rate}%
                          </Button>
                        ))}
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            placeholder="Khác"
                            value={customTaxRate}
                            onChange={(e) => {
                              setCustomTaxRate(e.target.value);
                              setTaxRate(null);
                            }}
                            className="w-20 h-8 text-sm"
                            min={0}
                            max={100}
                            step={0.1}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Tiền hàng:</span>
                      <span className="font-medium">{subtotalAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                    {taxEnabled && effectiveTaxRate > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Thuế VAT ({effectiveTaxRate}%):</span>
                        <span>{taxAmount.toLocaleString('vi-VN')}đ</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t">
                      <span className="font-medium">Tổng tiền:</span>
                      <span className="text-xl font-bold text-primary">
                        {totalAmount.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>
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
                customerSource={customerSource}
                setCustomerName={setCustomerName}
                setCustomerPhone={setCustomerPhone}
                setCustomerAddress={setCustomerAddress}
                setCustomerEmail={setCustomerEmail}
                setCustomerSource={setCustomerSource}
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

              <CustomerSourceSelect
                value={customerSource}
                onChange={setCustomerSource}
              />

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
                <div className="flex justify-between text-sm">
                  <span>Tiền hàng:</span>
                  <span className="font-medium">{subtotalAmount.toLocaleString('vi-VN')}đ</span>
                </div>
                {taxEnabled && effectiveTaxRate > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Thuế VAT ({effectiveTaxRate}%):</span>
                    <span>{taxAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t">
                  <span className="font-medium">Tổng thanh toán:</span>
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
          use_max_amount_limit: pointSettings.use_max_amount_limit,
          max_redeem_amount: pointSettings.max_redeem_amount,
          use_percentage_limit: pointSettings.use_percentage_limit,
          max_redeem_percentage: pointSettings.max_redeem_percentage,
        } : null}
      />

      {/* Invoice Print Dialog */}
      <InvoicePrintDialog
        open={showInvoiceDialog}
        onOpenChange={setShowInvoiceDialog}
        receipt={createdReceipt}
        template={invoiceTemplate}
        branchInfo={cartBranch}
      />
    </MainLayout>
  );
}
