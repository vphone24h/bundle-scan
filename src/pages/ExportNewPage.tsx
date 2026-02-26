import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
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
  CreditCard,
  Banknote,
  ScanBarcode,
  Percent,
  Calculator,
  PlayCircle,
} from 'lucide-react';
import { InstallmentCalculatorDialog } from '@/components/dashboard/InstallmentCalculatorDialog';
import { useCheckProductForSale, useSearchProductsByName, useCreateExportReceipt, type ExportReceiptItem, type ExportPayment } from '@/hooks/useExportReceipts';
import { useIssueVoucher } from '@/hooks/useVouchers';
import { useUpsertCustomer } from '@/hooks/useCustomers';
import { useInvoiceTemplateByBranch } from '@/hooks/useInvoiceTemplates';
import { useBranches } from '@/hooks/useBranches';
import { usePointSettings } from '@/hooks/useCustomerPoints';
import { usePermissions } from '@/hooks/usePermissions';
import { useStaffList } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { ExportPaymentDialog } from '@/components/export/ExportPaymentDialog';
import { InvoicePrintDialog } from '@/components/export/InvoicePrintDialog';
import { BarcodeScannerInput } from '@/components/export/BarcodeScannerInput';
import { CustomerSearchCombobox } from '@/components/export/CustomerSearchCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const exportNewTourSteps: TourStep[] = [
  {
    title: '📦 Chào mừng đến trang Xuất hàng!',
    description: 'Đây là nơi bạn tạo **phiếu bán hàng**. Hãy cùng tìm hiểu các bước cơ bản.',
    isInfo: true,
    position: 'center',
  },
  {
    title: '① Quét mã vạch',
    description: 'Quét **mã vạch** sản phẩm (**IMEI/SKU**) để tự động thêm vào **giỏ hàng**. Nếu mã có chứa giá → sản phẩm được thêm ngay.',
    targetSelector: '[data-tour="export-barcode"]',
    position: 'bottom',
  },
  {
    title: '② Tìm thủ công',
    description: 'Không có mã vạch? Tìm sản phẩm theo **IMEI** hoặc **tên**, nhập **giá bán** rồi thêm vào giỏ.',
    targetSelector: '[data-tour="export-manual-search"]',
    position: 'bottom',
  },
  {
    title: '③ Giỏ hàng & Thanh toán',
    description: 'Xem danh sách sản phẩm đã chọn, nhập **thông tin khách hàng**, sau đó nhấn **"Thanh toán"** để hoàn tất.',
    targetSelector: '[data-tour="export-cart"]',
    position: 'left',
  },
  {
    title: '✓ Sẵn sàng bán hàng!',
    description: 'Bạn đã nắm được quy trình. Bắt đầu **quét mã** hoặc **tìm sản phẩm** để tạo phiếu xuất đầu tiên!',
    isInfo: true,
    position: 'center',
  },
];

export default function ExportNewPage() {
  // Onboarding tour
  const { isCompleted: exportTourDone, isLoading: exportTourLoading, completeTour: completeExportTour } = useOnboardingTour('export_new');
  const [manualTourActive, setManualTourActive] = useState(false);
  const showExportTour = manualTourActive || (!exportTourLoading && !exportTourDone);

  // Form states
  const [imeiSearch, setImeiSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [salePrice, setSalePrice] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemWarranty, setItemWarranty] = useState('');
  const [scanWarranty, setScanWarranty] = useState('6 Tháng'); // Default warranty for barcode scan

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  // Ref to track product IDs being processed (prevents race condition on fast scans)
  const pendingProductIdsRef = useRef<Set<string>>(new Set());
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

  // Sales staff
  const [salesStaffId, setSalesStaffId] = useState<string | null>(null);

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showInstallment, setShowInstallment] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks
  const { user } = useAuth();
  const checkProduct = useCheckProductForSale();
  const searchProducts = useSearchProductsByName();
  const upsertCustomer = useUpsertCustomer();
  const createReceipt = useCreateExportReceipt();
  const issueVoucher = useIssueVoucher();
  const { data: pointSettings } = usePointSettings();
  const { data: branches } = useBranches();
  const { data: permissions } = usePermissions();
  const { data: staffList } = useStaffList();
  const isSuperAdmin = permissions?.role === 'super_admin';
  
  // Get branch_id from first cart item for invoice template
  const cartBranchId = cart.find(item => item.branch_id)?.branch_id || null;
  const { data: invoiceTemplate } = useInvoiceTemplateByBranch(cartBranchId);
  const cartBranch = cartBranchId ? branches?.find(b => b.id === cartBranchId) : null;

  // Helper: check if user can export from a specific branch
  const canExportFromBranch = (productBranchId: string | null | undefined): boolean => {
    // Super Admin can export from any branch
    if (permissions?.canViewAllBranches) return true;
    // No branch info on product -> allow
    if (!productBranchId) return true;
    // User must belong to the product's branch
    return permissions?.branchId === productBranchId;
  };

  const getBlockedExportMessage = (branchName?: string | null): string => {
    const name = branchName || 'chi nhánh khác';
    return `Sản phẩm thuộc "${name}". Bạn chỉ được xuất hàng từ chi nhánh của mình. Muốn xuất sản phẩm này, vui lòng yêu cầu chuyển hàng về chi nhánh của bạn.`;
  };

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
    // Fallback to "|" delimiter (supports IMEI|Price and IMEI|Name|Price formats)
    else if (barcode.includes('|')) {
      const parts = barcode.split('|');
      searchCode = parts[0];
      // Price is always the LAST part (handles both 2-part and 3-part formats)
      const priceStr = parts[parts.length - 1];
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
        // ⛔ Block export from other branches
        if (!canExportFromBranch(matchedProduct.branch_id)) {
          toast({
            title: 'Không thể xuất hàng',
            description: getBlockedExportMessage(matchedProduct.branches?.name),
            variant: 'destructive',
          });
          return;
        }

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

    // ⛔ Block export from other branches
    if (!canExportFromBranch(result.branch_id)) {
      toast({
        title: 'Không thể xuất hàng',
        description: getBlockedExportMessage(result.branches?.name),
        variant: 'destructive',
      });
      return;
    }

    // Check if already in cart OR currently being processed (race condition guard)
    // For IMEI products: check by IMEI only (same product can have multiple IMEIs)
    // For non-IMEI products: check by product_id
    const productKey = result.imei || result.id;
    const alreadyInCart = result.imei
      ? cart.some(item => item.imei && item.imei === result.imei)
      : cart.some(item => item.product_id === result.id);
    if (
      alreadyInCart ||
      pendingProductIdsRef.current.has(productKey)
    ) {
      toast({
        title: 'Đã có trong giỏ',
        description: 'Sản phẩm này đã được thêm vào giỏ hàng',
        variant: 'destructive',
      });
      return;
    }

    // Mark as pending to prevent duplicate from concurrent scans
    pendingProductIdsRef.current.add(productKey);

    // If barcode has encoded price -> AUTO ADD TO CART with scan warranty
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
        warranty: scanWarranty || null,
      };

      setCart(prevCart => {
        const duplicate = result.imei
          ? prevCart.some(item => item.imei && item.imei === result.imei)
          : prevCart.some(item => item.product_id === result.id);
        if (duplicate) return prevCart;
        return [...prevCart, newItem];
      });
      pendingProductIdsRef.current.delete(productKey);
      
      setSelectedProduct(null);
      setSalePrice('');
      setItemNote('');
      setItemQuantity(1);
      setItemWarranty('');
      setImeiSearch('');
      
      toast({
        title: 'Đã thêm vào giỏ',
        description: `${result.name} - ${encodedPrice.toLocaleString('vi-VN')}đ (BH: ${scanWarranty})`,
      });
      return;
    }

    // No encoded price but product has sale_price in DB -> AUTO ADD TO CART with scan warranty
    if (result.sale_price && result.sale_price > 0) {
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
        sale_price: result.sale_price,
        note: null,
        quantity: 1,
        warranty: scanWarranty || null,
      };

      setCart(prevCart => {
        const duplicate = result.imei
          ? prevCart.some(item => item.imei && item.imei === result.imei)
          : prevCart.some(item => item.product_id === result.id);
        if (duplicate) return prevCart;
        return [...prevCart, newItem];
      });
      pendingProductIdsRef.current.delete(productKey);
      
      setSelectedProduct(null);
      setSalePrice('');
      setItemNote('');
      setItemQuantity(1);
      setItemWarranty('');
      setImeiSearch('');
      
      toast({
        title: 'Đã thêm vào giỏ',
        description: `${result.name} - ${result.sale_price.toLocaleString('vi-VN')}đ (BH: ${scanWarranty})`,
      });
      return;
    }

    // No price at all -> Fill form for manual entry (don't reveal import price)
    pendingProductIdsRef.current.delete(productKey);
    setSelectedProduct(result);
    setSalePrice('');
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

  // Search by IMEI (manual) - shows form with warranty input instead of auto-add
  const handleImeiSearch = async () => {
    if (!imeiSearch.trim()) return;
    const code = imeiSearch.trim();
    setImeiSearch('');
    
    const result = await checkProduct.mutateAsync(code);
    if (!result) {
      toast({ title: 'Không tìm thấy', description: `IMEI "${code}" không tồn tại`, variant: 'destructive' });
      return;
    }
    if (result.status !== 'in_stock') {
      toast({ title: 'Không thể bán', description: `Sản phẩm đang ở trạng thái "${result.status === 'sold' ? 'Đã bán' : result.status}"`, variant: 'destructive' });
      return;
    }
    if (!canExportFromBranch(result.branch_id)) {
      toast({ title: 'Không thể xuất hàng', description: getBlockedExportMessage(result.branches?.name), variant: 'destructive' });
      return;
    }
    const alreadyInCart = result.imei
      ? cart.some(item => item.imei && item.imei === result.imei)
      : cart.some(item => item.product_id === result.id);
    if (alreadyInCart) {
      toast({ title: 'Đã có trong giỏ', description: 'Sản phẩm này đã được thêm vào giỏ hàng', variant: 'destructive' });
      return;
    }
    
    // Always show form for manual IMEI search (so user can enter warranty)
    setSelectedProduct(result);
    setSalePrice(result.sale_price && result.sale_price > 0 ? result.sale_price.toString() : '');
    setItemQuantity(1);
    setItemWarranty('');
    setItemNote('');
    setNameSearch('');
    setProductSuggestions([]);
    
    toast({
      title: 'Đã tìm thấy',
      description: `${result.name} - Vui lòng nhập bảo hành và nhấn "Thêm vào giỏ"`,
    });
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
    // ⛔ Block selecting products from other branches
    if (!canExportFromBranch(product.branch_id)) {
      toast({
        title: 'Không thể xuất hàng',
        description: getBlockedExportMessage(product.branches?.name),
        variant: 'destructive',
      });
      return;
    }

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

    if (salePrice === '' || salePrice === null || salePrice === undefined || parseFloat(salePrice) < 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập giá bán hợp lệ',
        variant: 'destructive',
      });
      return;
    }

    if (!itemWarranty.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập thời gian bảo hành',
        variant: 'destructive',
      });
      return;
    }

    // ⛔ Safety check: block export from other branches
    if (!canExportFromBranch(selectedProduct.branch_id)) {
      toast({
        title: 'Không thể xuất hàng',
        description: getBlockedExportMessage(selectedProduct.branches?.name),
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

    // Super Admin must select sales staff
    if (isSuperAdmin && !salesStaffId) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng chọn nhân viên bán hàng',
        variant: 'destructive',
      });
      return;
    }

    setShowPaymentDialog(true);
  };

  // Handle payment completion
  const handlePaymentComplete = async (payments: ExportPayment[], pointsRedeemed: number, pointsDiscount: number, giftVoucherTemplateId?: string, skipCashBook?: boolean) => {
    if (isSubmitting) return; // Chống double-submit
    setIsSubmitting(true);

    // Prepare optimistic receipt data for invoice display immediately
    const optimisticCustomer = {
      id: selectedCustomer?.id || '',
      name: customerName,
      phone: customerPhone,
      address: customerAddress || null,
      email: customerEmail || null,
    };

    const optimisticReceipt = {
      code: `EX-${Date.now()}`,
      customer: optimisticCustomer,
      items: [...cart],
      payments,
      subtotal_amount: subtotalAmount,
      tax_rate: taxEnabled ? effectiveTaxRate : 0,
      tax_amount: taxEnabled ? taxAmount : 0,
      total_amount: totalAmount,
      points_redeemed: pointsRedeemed,
      points_discount: pointsDiscount,
      sale_date: new Date().toISOString(),
    };

    // Show invoice dialog IMMEDIATELY
    setCreatedReceipt(optimisticReceipt);
    setShowInvoiceDialog(true);

    // Reset form immediately
    const savedCart = [...cart];
    const savedCustomerName = customerName;
    const savedCustomerPhone = customerPhone;
    const savedCustomerAddress = customerAddress;
    const savedCustomerEmail = customerEmail;
    const savedCustomerSource = customerSource;
    const savedCustomerBirthday = customerBirthday;
    const savedTaxEnabled = taxEnabled;
    const savedEffectiveTaxRate = effectiveTaxRate;
    const savedTaxAmount = taxAmount;
    const savedSubtotalAmount = subtotalAmount;
    const savedSalesStaffId = isSuperAdmin ? salesStaffId : user?.id || null;

    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerEmail('');
    setCustomerSource('');
    setCustomerBirthday(undefined);
    setSelectedCustomer(null);
    setSalesStaffId(null);
    setTaxEnabled(false);
    setTaxRate(null);
    setCustomTaxRate('');

    // Process in background
    try {
      const customer = await upsertCustomer.mutateAsync({
        name: savedCustomerName,
        phone: savedCustomerPhone,
        address: savedCustomerAddress || null,
        email: savedCustomerEmail || null,
        birthday: savedCustomerBirthday ? format(savedCustomerBirthday, 'yyyy-MM-dd') : null,
        source: savedCustomerSource || null,
      });

      const branchId = savedCart.find(item => item.branch_id)?.branch_id || null;

      const receipt = await createReceipt.mutateAsync({
        customerId: customer.id,
        items: savedCart.map(({ tempId, categoryName, branchName, ...item }) => item),
        payments,
        pointsRedeemed,
        pointsDiscount,
        branchId,
        vatRate: savedEffectiveTaxRate,
        vatAmount: savedTaxAmount,
        salesStaffId: savedSalesStaffId,
        skipCashBook,
      });

      // Update receipt with real data (code from server)
      setCreatedReceipt(prev => ({
        ...prev,
        ...receipt,
        customer,
        items: savedCart,
        payments,
        subtotal_amount: savedSubtotalAmount,
        tax_rate: savedTaxEnabled ? savedEffectiveTaxRate : 0,
        tax_amount: savedTaxEnabled ? savedTaxAmount : 0,
      }));

      let successMessage = `Phiếu xuất ${receipt.code} đã được tạo`;
      if (receipt.points_earned > 0) {
        successMessage += receipt.points_pending 
          ? `. Khách được ${receipt.points_earned} điểm (treo - chờ thanh toán đủ)`
          : `. Khách được cộng ${receipt.points_earned} điểm`;
      }

      // Issue voucher if selected
      if (giftVoucherTemplateId && customer.id) {
        try {
          await issueVoucher.mutateAsync({
            customer_id: customer.id,
            customer_name: savedCustomerName,
            customer_phone: savedCustomerPhone,
            customer_email: savedCustomerEmail || undefined,
            voucher_template_id: giftVoucherTemplateId,
            branch_id: branchId || undefined,
            source: 'export',
          });
          successMessage += '. Đã tặng voucher cho khách';
        } catch {
          // Non-critical, don't block
          successMessage += '. Lỗi tặng voucher';
        }
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Tạo phiếu xuất hàng"
        description="Xuất hàng và ghi nhận bán hàng"
        helpText="Tạo phiếu xuất (bán hàng) bằng cách quét mã vạch hoặc tìm sản phẩm. Chọn khách hàng, áp dụng chiết khấu, sau đó thanh toán và in hóa đơn."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={manualTourActive ? "default" : "outline"}
              size="sm"
              onClick={() => setManualTourActive(v => !v)}
              className="h-8 text-xs sm:text-sm"
            >
              <PlayCircle className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{manualTourActive ? 'Tắt hướng dẫn' : 'Xem hướng dẫn'}</span>
              <span className="sm:hidden">{manualTourActive ? 'Tắt HD' : 'Xem HD'}</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowInstallment(true)}
              className="h-8 text-xs sm:text-sm"
            >
              <Calculator className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Tính trả góp</span>
              <span className="sm:hidden">Trả góp</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search product */}
          <Card data-tour="export-barcode">
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
                continuousCamera
              />
              
              <p className="text-xs text-muted-foreground">
                Quét mã vạch có giá → tự động thêm vào giỏ kèm bảo hành bên dưới.
              </p>

              {/* Warranty preset for barcode scan */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Bảo hành khi quét</Label>
                <div className="flex flex-wrap gap-2">
                  {['Không BH', '30 Ngày', '3 Tháng', '6 Tháng', '12 Tháng'].map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      size="sm"
                      variant={scanWarranty === opt ? 'default' : 'outline'}
                      onClick={() => setScanWarranty(opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="Hoặc nhập tùy chỉnh..."
                  value={!['Không BH', '30 Ngày', '3 Tháng', '6 Tháng', '12 Tháng'].includes(scanWarranty) ? scanWarranty : ''}
                  onChange={(e) => setScanWarranty(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Manual Search - Combined */}
          <Card data-tour="export-manual-search">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Tìm sản phẩm
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Nhập IMEI/Serial hoặc tên sản phẩm..."
                    value={imeiSearch || nameSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      // If input looks like IMEI/Serial (digits, no spaces, >= 6 chars), use imeiSearch
                      // Otherwise treat as name search for suggestions
                      if (/^\d{6,}$/.test(val.trim())) {
                        setImeiSearch(val);
                        setNameSearch('');
                      } else {
                        setNameSearch(val);
                        setImeiSearch('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (imeiSearch || nameSearch).trim();
                        if (val) {
                          setImeiSearch(val);
                          setNameSearch('');
                          handleImeiSearch();
                        }
                      }
                    }}
                    className="search-input-highlight"
                  />
                  {productSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto top-full left-0">
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
                <Button 
                  onClick={() => {
                    const val = (imeiSearch || nameSearch).trim();
                    if (val) {
                      setImeiSearch(val);
                      setNameSearch('');
                      handleImeiSearch();
                    }
                  }}
                  disabled={checkProduct.isPending}
                >
                  Tìm
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>IMEI/Serial:</strong> Nhập đúng mã → Enter → sản phẩm tự xuất hiện &nbsp;|&nbsp; 
                <strong>Tên:</strong> Nhập 2-3 chữ đầu → hiện gợi ý để chọn
              </p>

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
                      <Label>Bảo hành <span className="text-destructive">*</span></Label>
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
          <Card data-tour="export-cart">
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

               {/* Sales Staff Selector - only for Super Admin */}
               {isSuperAdmin && (
                 <div className="space-y-2 pt-2 border-t">
                   <Label className="flex items-center gap-2">
                     <User className="h-4 w-4" />
                     Nhân viên bán hàng <span className="text-destructive">*</span>
                   </Label>
                   <Select
                     value={salesStaffId || ''}
                     onValueChange={(v) => setSalesStaffId(v || null)}
                   >
                     <SelectTrigger>
                       <SelectValue placeholder="Chọn nhân viên bán..." />
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
                   <p className="text-xs text-muted-foreground">
                     Doanh số đơn hàng sẽ được tính cho nhân viên này
                   </p>
                 </div>
               )}
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
        isLoading={isSubmitting || createReceipt.isPending || upsertCustomer.isPending}
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
        hasCustomer={!!customerPhone}
      />

      {/* Invoice Print Dialog */}
      <InvoicePrintDialog
        open={showInvoiceDialog}
        onOpenChange={setShowInvoiceDialog}
        receipt={createdReceipt}
        template={invoiceTemplate}
        branchInfo={cartBranch}
      />

      {/* Installment Calculator */}
      <InstallmentCalculatorDialog open={showInstallment} onOpenChange={setShowInstallment} />
      <OnboardingTourOverlay
        steps={exportNewTourSteps}
        isActive={showExportTour}
        onComplete={() => { completeExportTour(); setManualTourActive(false); }}
        onSkip={() => { completeExportTour(); setManualTourActive(false); }}
        tourKey="export_new"
      />
    </MainLayout>
  );
}
