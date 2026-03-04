import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';
import { useTranslation } from 'react-i18next';
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
import { Switch } from '@/components/ui/switch';
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
  Mail,
  MessageCircle,
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
import { useTenantLandingSettings } from '@/hooks/useTenantLanding';
import { supabase } from '@/integrations/supabase/client';
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

function useExportNewTourSteps(): TourStep[] {
  const { t } = useTranslation();
  return [
    { title: t('tours.exportNew.tourTitle1'), description: t('tours.exportNew.tourDesc1'), isInfo: true, position: 'center' as const },
    { title: t('tours.exportNew.tourTitle2'), description: t('tours.exportNew.tourDesc2'), targetSelector: '[data-tour="export-barcode"]', position: 'bottom' as const },
    { title: t('tours.exportNew.tourTitle3'), description: t('tours.exportNew.tourDesc3'), targetSelector: '[data-tour="export-manual-search"]', position: 'bottom' as const },
    { title: t('tours.exportNew.tourTitle4'), description: t('tours.exportNew.tourDesc4'), targetSelector: '[data-tour="export-cart"]', position: 'left' as const },
    { title: t('tours.exportNew.tourTitle5'), description: t('tours.exportNew.tourDesc5'), isInfo: true, position: 'center' as const },
  ];
}

export default function ExportNewPage() {
  const { t } = useTranslation();
  const exportNewTourSteps = useExportNewTourSteps();
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
  const [scanWarranty, setScanWarranty] = useState('6 Tháng');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

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

  // Auto email toggle
  const [autoEmailEnabled, setAutoEmailEnabled] = useState(true);
  // Auto Zalo toggle
  const [autoZaloEnabled, setAutoZaloEnabled] = useState(true);

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
  const { data: landingSettings } = useTenantLandingSettings();
  const isSuperAdmin = permissions?.role === 'super_admin';

  // Sync auto email toggle with landing settings
  useEffect(() => {
    if (landingSettings?.order_email_on_export) {
      setAutoEmailEnabled(true);
    }
  }, [landingSettings?.order_email_on_export]);
  
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
    const name = branchName || t('pages.exportNew.cannotExport');
    return t('pages.exportNew.cannotExport') + `: ${name}`;
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
            title: t('pages.exportNew.cannotExport'),
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
            title: t('pages.exportNew.quantityIncreased'),
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
            title: t('pages.exportNew.addedToCart'),
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
          title: t('pages.exportNew.notFound'),
          description: `"${nonImeiProductName}" ${t('pages.exportNew.productNotInStock')}`,
          variant: 'destructive',
        });
      }
      return;
    }

    const result = await checkProduct.mutateAsync(searchCode);
    
    if (!result) {
      toast({
        title: t('pages.exportNew.notFound'),
        description: t('pages.exportNew.codeNotFound', { code: searchCode }),
        variant: 'destructive',
      });
      return;
    }

    if (result.status !== 'in_stock') {
      toast({
        title: t('pages.exportNew.cannotSell'),
        description: t('pages.exportNew.statusNotAvailable', { status: result.status === 'sold' ? t('common.sold') : t('common.returned') }),
        variant: 'destructive',
      });
      return;
    }

    // ⛔ Block export from other branches
    if (!canExportFromBranch(result.branch_id)) {
      toast({
        title: t('pages.exportNew.cannotExport'),
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
        title: t('pages.exportNew.alreadyInCart'),
        description: t('pages.exportNew.alreadyInCartDesc'),
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
        title: t('pages.exportNew.addedToCart'),
        description: `${result.name} - ${encodedPrice.toLocaleString('vi-VN')}đ (${t('pages.exportNew.warrantyShort')}: ${scanWarranty})`,
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
        title: t('pages.exportNew.addedToCart'),
        description: `${result.name} - ${result.sale_price.toLocaleString('vi-VN')}đ (${t('pages.exportNew.warrantyShort')}: ${scanWarranty})`,
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
      title: t('pages.exportNew.scannedSuccess'),
      description: `${result.name} - ${t('pages.exportNew.enterSalePriceHint')}`,
    });
  };

  // Search by IMEI (manual) - shows form with warranty input instead of auto-add
  const handleImeiSearch = async () => {
    if (!imeiSearch.trim()) return;
    const code = imeiSearch.trim();
    setImeiSearch('');
    
    const result = await checkProduct.mutateAsync(code);
    if (!result) {
      toast({ title: t('pages.exportNew.notFound'), description: t('pages.exportNew.codeNotFound', { code }), variant: 'destructive' });
      return;
    }
    if (result.status !== 'in_stock') {
      toast({ title: t('pages.exportNew.cannotSell'), description: t('pages.exportNew.statusNotAvailable', { status: result.status === 'sold' ? t('common.sold') : result.status }), variant: 'destructive' });
      return;
    }
    if (!canExportFromBranch(result.branch_id)) {
      toast({ title: t('pages.exportNew.cannotExport'), description: getBlockedExportMessage(result.branches?.name), variant: 'destructive' });
      return;
    }
    const alreadyInCart = result.imei
      ? cart.some(item => item.imei && item.imei === result.imei)
      : cart.some(item => item.product_id === result.id);
    if (alreadyInCart) {
      toast({ title: t('pages.exportNew.alreadyInCart'), description: t('pages.exportNew.alreadyInCartDesc'), variant: 'destructive' });
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
      title: t('pages.exportNew.foundProduct'),
      description: `${result.name} - ${t('pages.exportNew.enterWarrantyHint')}`,
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
        title: t('pages.exportNew.cannotExport'),
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
        title: t('pages.exportNew.error'),
        description: t('pages.exportNew.errorSelectProduct'),
        variant: 'destructive',
      });
      return;
    }

    if (salePrice === '' || salePrice === null || salePrice === undefined || parseFloat(salePrice) < 0) {
      toast({
        title: t('pages.exportNew.error'),
        description: t('pages.exportNew.errorValidPrice'),
        variant: 'destructive',
      });
      return;
    }

    if (!itemWarranty.trim()) {
      toast({
        title: t('pages.exportNew.error'),
        description: t('pages.exportNew.errorEnterWarranty'),
        variant: 'destructive',
      });
      return;
    }

    // ⛔ Safety check: block export from other branches
    if (!canExportFromBranch(selectedProduct.branch_id)) {
      toast({
        title: t('pages.exportNew.cannotExport'),
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
      title: t('pages.exportNew.addedToCart'),
      description: `${newItem.product_name}`,
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
        title: t('pages.exportNew.emptyCartError'),
        description: t('pages.exportNew.emptyCartErrorDesc'),
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
        title: t('pages.exportNew.multiBranchError'),
        description: t('pages.exportNew.multiBranchErrorDesc', { branches: branchNames.map(b => b.name).join(', ') }),
        variant: 'destructive',
      });
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: t('pages.exportNew.missingInfo'),
        description: t('pages.exportNew.missingCustomerInfo'),
        variant: 'destructive',
      });
      return;
    }

    // Super Admin must select sales staff
    if (isSuperAdmin && !salesStaffId) {
      toast({
        title: t('pages.exportNew.missingInfo'),
        description: t('pages.exportNew.missingSalesStaff'),
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

      let successMessage = t('pages.exportNew.receiptCreated', { code: receipt.code });
      if (receipt.points_earned > 0) {
        successMessage += receipt.points_pending 
          ? `. ${t('pages.exportNew.pointsPending', { points: receipt.points_earned })}`
          : `. ${t('pages.exportNew.pointsEarned', { points: receipt.points_earned })}`;
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
          successMessage += `. ${t('pages.exportNew.voucherIssued')}`;
        } catch {
          // Non-critical, don't block
          successMessage += `. ${t('pages.exportNew.voucherError')}`;
        }
      }

      // Send auto email if enabled
      if (autoEmailEnabled && savedCustomerEmail) {
        supabase.functions.invoke('send-export-email', {
          body: {
            tenant_id: landingSettings?.tenant_id,
            customer_name: savedCustomerName,
            customer_email: savedCustomerEmail,
            customer_phone: savedCustomerPhone,
            items: savedCart.map(item => ({
              product_name: item.product_name,
              imei: item.imei,
              sale_price: item.sale_price,
              quantity: item.quantity,
              warranty: item.warranty,
            })),
            total_amount: totalAmount,
            receipt_code: receipt.code,
            branch_id: branchId,
            export_date: new Date().toISOString(),
          },
        }).then(({ error }) => {
          if (error) console.warn('Export email failed:', error.message);
        }).catch(() => {});
        successMessage += '. Email đã được gửi cho khách hàng';
      }

      // Send auto Zalo if enabled
      if (autoZaloEnabled && savedCustomerPhone) {
        supabase.functions.invoke('send-zalo-message', {
          body: {
            tenant_id: landingSettings?.tenant_id,
            customer_name: savedCustomerName,
            customer_phone: savedCustomerPhone,
            message_type: 'export_confirmation',
            items: savedCart.map(item => ({
              product_name: item.product_name,
              imei: item.imei,
              sale_price: item.sale_price,
              warranty: item.warranty,
            })),
            total_amount: totalAmount,
            receipt_code: receipt.code,
            branch_id: branchId,
          },
        }).then(({ error }) => {
          if (error) console.warn('Zalo message failed:', error.message);
        }).catch(() => {});
        successMessage += '. Zalo đã được gửi cho khách hàng';
      }

      toast({
        title: t('pages.exportNew.exportSuccess'),
        description: successMessage,
      });
    } catch (error: any) {
      toast({
        title: t('pages.exportNew.error'),
        description: error.message || t('pages.exportNew.cannotCreateReceipt'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title={t('tours.exportNew.pageTitle')}
        description={t('tours.exportNew.pageDesc')}
        helpText={t('tours.exportNew.pageHelp')}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={manualTourActive ? "default" : "outline"}
              size="sm"
              onClick={() => setManualTourActive(v => !v)}
              className="h-8 text-xs sm:text-sm"
            >
              <PlayCircle className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{manualTourActive ? t('tours.importNew.turnOffGuide') : t('tours.importNew.viewGuide')}</span>
              <span className="sm:hidden">{manualTourActive ? t('tours.importNew.turnOffGuideShort') : t('tours.importNew.viewGuideShort')}</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowInstallment(true)}
              className="h-8 text-xs sm:text-sm"
            >
              <Calculator className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{t('pages.exportNew.installmentCalc')}</span>
              <span className="sm:hidden">{t('pages.exportNew.installmentShort')}</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product form */}
        <div className="lg:col-span-2 space-y-6">

          {/* Manual Search - Combined */}
          <Card data-tour="export-manual-search">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                {t('tours.exportNew.searchProduct')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={t('tours.exportNew.searchPlaceholder')}
                    value={imeiSearch || nameSearch}
                    onChange={(e) => {
                      const val = e.target.value;
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
                            SKU: {product.sku} | {product.categories?.name || t('pages.exportNew.notCategorized')}
                            {product.imei && <span className="ml-1 text-foreground/70">| IMEI: {product.imei}</span>}
                            {product.branches?.name && <span className="ml-1 text-primary/80">| CN: {product.branches.name}</span>}
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
                  {t('tours.exportNew.findBtn')}
                </Button>
                <Button
                  variant={showBarcodeScanner ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setShowBarcodeScanner(v => !v)}
                  title={t('pages.exportNew.scanBarcode')}
                  data-tour="export-barcode"
                >
                  <ScanBarcode className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('pages.exportNew.searchHint')}
              </p>

              {/* Collapsible Barcode Scanner */}
              {showBarcodeScanner && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3 animate-fade-in">
                  <BarcodeScannerInput
                    onScan={handleBarcodeScan}
                    placeholder={t('pages.exportNew.scanBarcodePlaceholder')}
                    disabled={checkProduct.isPending}
                    continuousCamera
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('pages.exportNew.scanBarcodeHint')}
                  </p>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('pages.exportNew.warrantyOnScan')}</Label>
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
                      placeholder={t('pages.exportNew.customWarranty')}
                      value={!['Không BH', '30 Ngày', '3 Tháng', '6 Tháng', '12 Tháng'].includes(scanWarranty) ? scanWarranty : ''}
                      onChange={(e) => setScanWarranty(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                </div>
              )}

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
                        {t('pages.exportNew.categoryLabel')}: {selectedProduct.categories?.name || t('pages.exportNew.notCategorized')}
                      </p>
                      {selectedProduct.branches?.name && (
                        <p className="text-sm text-primary">
                          Chi nhánh: {selectedProduct.branches.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {selectedProduct.status === 'in_stock' ? t('pages.exportNew.inStockBadge') : selectedProduct.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setSelectedProduct(null);
                          setSalePrice('');
                          setItemNote('');
                          setItemQuantity(1);
                        }}
                        title="Xóa sản phẩm đã chọn"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('pages.exportNew.salePrice')}</Label>
                      <PriceInput
                        placeholder={t('pages.exportNew.enterSalePrice')}
                        value={salePrice}
                        onChange={(val) => setSalePrice(val.toString())}
                      />
                    </div>
                    {!selectedProduct.imei && (
                      <div>
                        <Label>{t('pages.exportNew.quantity')}</Label>
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
                      <Label>{t('pages.exportNew.warranty')} <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder={t('pages.exportNew.warrantyExample')}
                        value={itemWarranty}
                        onChange={(e) => setItemWarranty(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t('common.note')}</Label>
                      <Input
                        placeholder={t('pages.exportNew.noteOptional')}
                        value={itemNote}
                        onChange={(e) => setItemNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button onClick={handleAddToCart} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('pages.exportNew.addToCart')}
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
                {t('tours.exportNew.cart')} ({cart.length} {t('pages.exportNew.cartProducts', { count: cart.length })})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('tours.exportNew.emptyCart')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tours.exportNew.productCol')}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('tours.exportNew.imeiSkuCol')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('tours.exportNew.categoryCol')}</TableHead>
                      <TableHead className="text-center w-20">{t('tours.exportNew.qtyCol')}</TableHead>
                      <TableHead className="text-right">{t('tours.exportNew.unitPriceCol')}</TableHead>
                      <TableHead className="w-28">{t('tours.exportNew.warrantyCol')}</TableHead>
                      <TableHead className="text-right">{t('tours.exportNew.subtotalCol')}</TableHead>
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
                        <TableCell>
                          <Input
                            value={item.warranty || ''}
                            onChange={(e) => setCart(prev => prev.map(c => c.tempId === item.tempId ? { ...c, warranty: e.target.value } : c))}
                            placeholder={t('pages.exportNew.warrantyExample')}
                            className="w-24 h-8 text-xs"
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
                        {t('tours.exportNew.vatTax')}
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
                            placeholder={t('tours.exportNew.otherRate')}
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
                      <span>{t('tours.exportNew.subtotal')}:</span>
                      <span className="font-medium">{subtotalAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                    {taxEnabled && effectiveTaxRate > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{t('tours.exportNew.vatLabel', { rate: effectiveTaxRate })}:</span>
                        <span>{taxAmount.toLocaleString('vi-VN')}đ</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t">
                      <span className="font-medium">{t('tours.exportNew.totalAmount')}:</span>
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
                {t('tours.exportNew.customerInfo')}
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
                      {t('tours.exportNew.salesStaff')} <span className="text-destructive">*</span>
                   </Label>
                   <Select
                     value={salesStaffId || ''}
                     onValueChange={(v) => setSalesStaffId(v || null)}
                   >
                     <SelectTrigger>
                       <SelectValue placeholder={t('tours.exportNew.selectSalesStaff')} />
                     </SelectTrigger>
                     <SelectContent>
                       {staffList?.map((staff) => (
                         <SelectItem key={staff.user_id} value={staff.user_id}>
                            {staff.display_name || t('tours.exportNew.staffLabel')}
                            {staff.user_role === 'super_admin' && ` ${t('tours.exportNew.adminLabel')}`}
                            {staff.user_role === 'branch_admin' && ` ${t('tours.exportNew.managerLabel')}`}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                   <p className="text-xs text-muted-foreground">
                     {t('tours.exportNew.salesStaffNote')}
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
                {t('tours.exportNew.payment')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('tours.exportNew.productCount')}:</span>
                  <span className="font-medium">{cart.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('tours.exportNew.subtotal')}:</span>
                  <span className="font-medium">{subtotalAmount.toLocaleString('vi-VN')}đ</span>
                </div>
                {taxEnabled && effectiveTaxRate > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t('tours.exportNew.vatLabel', { rate: effectiveTaxRate })}:</span>
                    <span>{taxAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t">
                  <span className="font-medium">{t('tours.exportNew.totalPayment')}:</span>
                  <span className="text-xl font-bold text-primary">
                    {totalAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
               </div>

              {/* Auto email toggle */}
              {landingSettings?.order_email_enabled && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <Label htmlFor="auto-email-export" className="flex items-center gap-2 cursor-pointer text-sm">
                    <Mail className="h-4 w-4 text-primary" />
                    Tự động gửi email cho khách
                  </Label>
                  <Switch
                    id="auto-email-export"
                    checked={autoEmailEnabled}
                    onCheckedChange={setAutoEmailEnabled}
                  />
                </div>
              )}
              {autoEmailEnabled && !customerEmail && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Khách chưa có email — sẽ không gửi được
                </p>
              )}

              {/* Auto Zalo toggle */}
              {(landingSettings as any)?.zalo_enabled && (landingSettings as any)?.zalo_on_export && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <Label htmlFor="auto-zalo-export" className="flex items-center gap-2 cursor-pointer text-sm">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Tự động gửi Zalo cho khách
                  </Label>
                  <Switch
                    id="auto-zalo-export"
                    checked={autoZaloEnabled}
                    onCheckedChange={setAutoZaloEnabled}
                  />
                </div>
              )}

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleProceedToPayment}
                disabled={cart.length === 0 || createReceipt.isPending}
              >
                <Banknote className="h-4 w-4 mr-2" />
                {t('tours.exportNew.proceedPayment')}
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
