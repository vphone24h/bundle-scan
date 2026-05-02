import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';
import { useTranslation } from 'react-i18next';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { useDraftCart } from '@/hooks/useDraftCart';
import { ResumeDraftDialog } from '@/components/import/ResumeDraftDialog';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  Calendar,
  FileText,
  Wrench,
} from 'lucide-react';
import { InstallmentCalculatorDialog } from '@/components/dashboard/InstallmentCalculatorDialog';
import { useCheckProductForSale, useSearchProductsByName, useCreateExportReceipt, type ExportReceiptItem, type ExportPayment } from '@/hooks/useExportReceipts';
import { useIssueVoucher, useCustomerVouchersById, useMarkVoucherUsed } from '@/hooks/useVouchers';
import { useUpsertCustomer } from '@/hooks/useCustomers';
import { useInvoiceTemplateByBranch } from '@/hooks/useInvoiceTemplates';
import { useBranches } from '@/hooks/useBranches';
import { usePointSettings } from '@/hooks/useCustomerPoints';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentUserBranchAccess } from '@/hooks/useUserBranchAccess';
import { useStaffList } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { useTenantLandingSettings } from '@/hooks/useTenantLanding';
import { supabase } from '@/integrations/supabase/client';
import { ExportPaymentDialog } from '@/components/export/ExportPaymentDialog';
import { OrderLimitDialog } from '@/components/export/OrderLimitDialog';
import { useOrderLimitCheck } from '@/hooks/useOrderLimitCheck';
import { InvoicePrintDialog } from '@/components/export/InvoicePrintDialog';
import { BarcodeScannerInput } from '@/components/export/BarcodeScannerInput';
import { CustomerSearchCombobox } from '@/components/export/CustomerSearchCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
import { useDepositMap, useCancelProductDeposit, useApplyProductDeposits } from '@/hooks/useProductDeposits';
import { BadgeDollarSign, AlertTriangle as AlertTriangleIcon } from 'lucide-react';
import { PriceInput } from '@/components/ui/price-input';
import { cn } from '@/lib/utils';
import { normalizeLooseSearchValue } from '@/lib/normalizeSearch';
import { AutoEmailToggle } from '@/components/shared/AutoEmailToggle';

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
  unit: string;
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
  const navigate = useNavigate();
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
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number | string>(1);
  const [itemWarranty, setItemWarranty] = useState('');
  const [scanWarranty, setScanWarranty] = useState('6 Tháng');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Cart
  const exportDraft = useDraftCart<CartItem>('export_draft_cart');
  const [cart, setCart] = useState<CartItem[]>([]);
  // Deposits map for cart products
  const { map: depositMap, byProduct: depositsByProduct, totalQtyByProduct } = useDepositMap();
  const cancelDeposit = useCancelProductDeposit();
  const applyDeposits = useApplyProductDeposits();
  // Ref to track product IDs being processed (prevents race condition on fast scans)
  const pendingProductIdsRef = useRef<Set<string>>(new Set());

  // Fetch stock for non-IMEI products in cart that have active deposits.
  // Used to decide whether to show the "đã có người cọc" warning:
  // only show when totalDeposited >= stock (else stock is enough for everyone).
  const nonImeiDepositedProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of cart) {
      if (!item.imei && depositsByProduct.has(item.product_id)) {
        ids.add(item.product_id);
      }
    }
    return Array.from(ids);
  }, [cart, depositsByProduct]);

  const { data: productStockMap = new Map<string, number>() } = useQuery({
    queryKey: ['products-stock-for-deposit', nonImeiDepositedProductIds.sort().join(',')],
    queryFn: async () => {
      const m = new Map<string, number>();
      if (nonImeiDepositedProductIds.length === 0) return m;
      const { data, error } = await supabase
        .from('products')
        .select('id, quantity')
        .in('id', nonImeiDepositedProductIds);
      if (error) return m;
      for (const p of data || []) m.set((p as any).id, Number((p as any).quantity || 0));
      return m;
    },
    enabled: nonImeiDepositedProductIds.length > 0,
    staleTime: 30 * 1000,
  });
  // Tax state
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState<number | null>(null);
  const [customTaxRate, setCustomTaxRate] = useState('');
  // Export date (default = now)
   const [exportDate, setExportDate] = useState('');
  const [receiptNote, setReceiptNote] = useState('');

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
  // "Đơn này khách của nhân viên" — cộng hoa hồng tự bán
  const [isSelfSold, setIsSelfSold] = useState<boolean>(false);

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showInstallment, setShowInstallment] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOrderLimitDialog, setShowOrderLimitDialog] = useState(false);

  // Auto email toggle
  const [autoEmailEnabled, setAutoEmailEnabled] = useState(true);
  const [autoZaloEnabled, setAutoZaloEnabled] = useState(false);

  // Hooks
  const { user } = useAuth();
  const checkProduct = useCheckProductForSale();
  const searchProducts = useSearchProductsByName();
  const upsertCustomer = useUpsertCustomer();
  const createReceipt = useCreateExportReceipt();
  const issueVoucher = useIssueVoucher();
  const markVoucherUsed = useMarkVoucherUsed();
  const { data: customerVouchers = [] } = useCustomerVouchersById(selectedCustomer?.id || null);
  const { data: pointSettings } = usePointSettings();
  const { data: branches } = useBranches();
  const { data: permissions } = usePermissions();
  const { data: extraBranchIds } = useCurrentUserBranchAccess();
  const { data: staffList } = useStaffList();
  const { data: landingSettings } = useTenantLandingSettings();
  const { isLimitReached, orderCount, freeOrderLimit } = useOrderLimitCheck();
  const isSuperAdmin = permissions?.role === 'super_admin';

  // Sync auto email toggle with landing settings
  useEffect(() => {
    if (landingSettings?.order_email_on_export) {
      setAutoEmailEnabled(true);
    }
  }, [landingSettings?.order_email_on_export]);

  // Prefill from landing order (sessionStorage)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('export_prefill');
      if (!raw) return;
      sessionStorage.removeItem('export_prefill');
      const prefill = JSON.parse(raw);
      
      // Prefill customer - try to auto-select existing customer by phone
      if (prefill.customer) {
        const phone = prefill.customer.phone || '';
        const name = prefill.customer.name || '';
        const email = prefill.customer.email || '';
        const address = prefill.customer.address || '';
        
        setCustomerName(name);
        setCustomerPhone(phone);
        setCustomerEmail(email);
        setCustomerAddress(address);

        // Auto-lookup customer by phone to select them
        if (phone) {
          supabase
            .from('customers')
            .select('id, name, phone, address, email, source, current_points, pending_points, total_spent, membership_tier, status, birthday')
            .eq('phone', phone)
            .limit(1)
            .then(({ data }) => {
              if (data && data.length > 0) {
                const c = data[0];
                setSelectedCustomer({
                  id: c.id,
                  name: c.name,
                  phone: c.phone,
                  address: c.address,
                  email: c.email,
                  source: c.source,
                  current_points: c.current_points ?? 0,
                  pending_points: c.pending_points ?? 0,
                  total_spent: c.total_spent ?? 0,
                  membership_tier: (c.membership_tier as SelectedCustomer['membership_tier']) || 'regular',
                  status: (c.status as SelectedCustomer['status']) || 'active',
                  birthday: c.birthday,
                });
                setCustomerName(c.name);
                setCustomerPhone(c.phone);
                setCustomerEmail(c.email || email);
                setCustomerAddress(c.address || address);
              }
            });
        }
      }

      // Prefill product into cart
      if (prefill.product) {
        const p = prefill.product;
        const newItem: CartItem = {
          tempId: `prefill-${Date.now()}`,
          product_id: p.id,
          product_name: p.name,
          sku: p.sku || '',
          imei: p.imei || null,
          sale_price: p.sale_price || 0,
          category_id: p.category_id || null,
          branch_id: p.branch_id || null,
          note: null,
          categoryName: p.categoryName,
          branchName: p.branchName,
          quantity: 1,
          unit: p.unit || 'cái',
          warranty: '',
        };
        setCart([newItem]);
        setSalePrice(String(p.sale_price || 0));
      }
    } catch (e) {
      console.warn('Failed to parse export_prefill:', e);
    }
  }, []);
  
  // Get branch_id from first cart item for invoice template
  const cartBranchId = cart.find(item => item.branch_id)?.branch_id || null;
  const { data: invoiceTemplate } = useInvoiceTemplateByBranch(cartBranchId);
  const cartBranch = cartBranchId ? branches?.find(b => b.id === cartBranchId) : null;

  // Helper: check if user can export from a specific branch
  // ⚠️ Quyền "Xem tồn kho chi nhánh khác" (view_other_branches) CHỈ cho phép XEM,
  // KHÔNG cho phép xuất hàng từ chi nhánh khác.
  // User chỉ được xuất hàng từ: chi nhánh chính + các chi nhánh được gán thêm (user_branch_access).
  const canExportFromBranch = (productBranchId: string | null | undefined): boolean => {
    // Only Super Admin can export from any branch
    if (permissions?.role === 'super_admin') return true;
    // No branch info on product -> allow
    if (!productBranchId) return true;
    // User's primary branch
    if (permissions?.branchId === productBranchId) return true;
    // Extra assigned branches
    if (extraBranchIds && extraBranchIds.includes(productBranchId)) return true;
    return false;
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
            unit: matchedProduct.unit || 'cái',
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
        setAvailableStock(null);
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
        unit: result.unit || 'cái',
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
      setAvailableStock(null);
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
        unit: result.unit || 'cái',
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
      setAvailableStock(null);
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
    fetchAvailableStock(result);
    setProductSuggestions([]);
    
    toast({
      title: t('pages.exportNew.scannedSuccess'),
      description: `${result.name} - ${t('pages.exportNew.enterSalePriceHint')}`,
    });
  };

  // Search by IMEI (manual) - shows form with warranty input instead of auto-add
  const handleImeiSearch = async (searchValue?: string) => {
    const code = (searchValue ?? imeiSearch).trim();
    if (!code) return;
    setImeiSearch('');
    setNameSearch('');
    
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
    fetchAvailableStock(result);
    
    toast({
      title: t('pages.exportNew.foundProduct'),
      description: `${result.name} - ${t('pages.exportNew.enterWarrantyHint')}`,
    });
  };

  const filterProductResults = (results: any[]) => {
    const cartImeis = new Set(cart.filter(c => c.imei).map(c => c.imei));
    const cartProductIds = new Set(cart.filter(c => c.imei).map(c => c.product_id));

    return (results || []).filter((p: any) => {
      // Branch permission filter: if user can't view other branches, only show products from allowed branches
      if (!permissions?.canViewAllBranches && p.branch_id) {
        const allowedBranches = new Set<string>();
        if (permissions?.branchId) allowedBranches.add(permissions.branchId);
        if (extraBranchIds) extraBranchIds.forEach((id: string) => allowedBranches.add(id));
        if (!allowedBranches.has(p.branch_id)) return false;
      }
      if (p.imei) {
        return !cartImeis.has(p.imei) && !cartProductIds.has(p.id);
      }
      return true;
    });
  };

  const findBestProductMatch = (searchTerm: string, results: any[]) => {
    const normalizedTerm = normalizeLooseSearchValue(searchTerm);

    return results.find((product: any) => {
      const candidates = [product.name, product.sku, product.imei].filter(Boolean);
      return candidates.some((value) => normalizeLooseSearchValue(String(value)) === normalizedTerm);
    }) || null;
  };

  const runProductNameSearch = async (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term) {
      setProductSuggestions([]);
      return [];
    }

    const results = await searchProducts.mutateAsync(term);
    const filtered = filterProductResults(results || []);
    setProductSuggestions(filtered);
    return filtered;
  };

  const handleManualSearch = async () => {
    const rawValue = (imeiSearch || nameSearch).trim();
    if (!rawValue) return;

    if (/^\d{6,}$/.test(rawValue)) {
      await handleImeiSearch(rawValue);
      return;
    }

    const results = await runProductNameSearch(rawValue);
    if (results.length === 0) {
      toast({
        title: t('pages.exportNew.notFound'),
        description: `"${rawValue}" ${t('pages.exportNew.productNotInStock')}`,
        variant: 'destructive',
      });
      return;
    }

    const bestMatch = findBestProductMatch(rawValue, results);
    if (bestMatch) {
      handleSelectProduct(bestMatch);
      return;
    }

    if (results.length === 1) {
      handleSelectProduct(results[0]);
    }
  };

  // Search by name (debounced)
  useEffect(() => {
    if (nameSearch.trim().length >= 1) {
      const timer = setTimeout(async () => {
        await runProductNameSearch(nameSearch);
      }, 120);
      return () => clearTimeout(timer);
    } else {
      setProductSuggestions([]);
    }
  }, [nameSearch, cart]);

  // Fetch available stock for non-IMEI product
  const fetchAvailableStock = async (product: any) => {
    if (product.imei) { setAvailableStock(null); return; }
    const { data } = await supabase
      .from('products')
      .select('quantity')
      .eq('name', product.name)
      .eq('sku', product.sku)
      .eq('status', 'in_stock')
      .eq('branch_id', product.branch_id);
    const total = (data || []).reduce((s: number, r: any) => s + (r.quantity || 0), 0);
    // Subtract items already in cart for same product+branch
    const inCart = cart
      .filter(c => !c.imei && c.product_name === product.name && c.sku === product.sku && c.branch_id === product.branch_id)
      .reduce((s, c) => s + c.quantity, 0);
    setAvailableStock(Math.max(0, total - inCart));
  };

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
    setItemQuantity(1); // Default to 1
    setNameSearch('');
    setProductSuggestions([]);
    fetchAvailableStock(product);
  };

  // Auto-save export cart to localStorage for draft persistence
  useEffect(() => {
    exportDraft.saveDraft(cart);
  }, [cart]);

  // Handle resume export draft
  const handleResumeExportDraft = useCallback(() => {
    if (exportDraft.pendingDraft) {
      setCart(exportDraft.pendingDraft.items);
    }
    exportDraft.acceptDraft();
  }, [exportDraft.pendingDraft]);

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

    // Bảo hành bắt buộc cho sản phẩm có IMEI
    if (selectedProduct.imei && !itemWarranty.trim()) {
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

    const productUnit = selectedProduct.unit || 'cái';
    const isDecimalUnit = ['kg', 'lít', 'mét'].includes(productUnit);
    const numQuantity = typeof itemQuantity === 'string' ? parseFloat(itemQuantity) || 0 : itemQuantity;
    const maxQty = availableStock ?? Infinity;
    const clampedQty = Math.min(numQuantity, maxQty);
    const quantity = selectedProduct.imei ? 1 : (isDecimalUnit ? Math.max(0.001, clampedQty) : Math.max(1, Math.round(clampedQty)));
    
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
      unit: productUnit,
      warranty: itemWarranty || null,
    };

    setCart([...cart, newItem]);
    setSelectedProduct(null);
    setAvailableStock(null);
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
    const item = cart.find(i => i.tempId === tempId);
    const isDecimal = item && ['kg', 'lít', 'mét'].includes(item.unit);
    const minQty = isDecimal ? 0.001 : 1;
    if (newQuantity < minQty) return;
    setCart(cart.map(i => 
      i.tempId === tempId ? { ...i, quantity: newQuantity } : i
    ));
  };

  // Calculate totals
  const subtotalAmount = cart.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0);
  const taxAmount = Math.round(subtotalAmount * effectiveTaxRate / 100);
  const totalAmount = subtotalAmount + taxAmount;

  // Tính các deposit khớp khách hàng hiện tại trong giỏ -> sẽ trừ vào số phải thanh toán
  const appliedDeposits = (() => {
    const result: { id: string; amount: number; productName: string; customerName: string }[] = [];
    const seen = new Set<string>();
    for (const item of cart) {
      const deps = depositsByProduct.get(item.product_id) || [];
      for (const dep of deps) {
        if (seen.has(dep.id)) continue;
        const matchCustomer = !!(
          (selectedCustomer?.id && dep.customer_id && selectedCustomer.id === dep.customer_id) ||
          (customerPhone && dep.customer_phone && customerPhone.replace(/\D/g, '') === dep.customer_phone.replace(/\D/g, ''))
        );
        if (matchCustomer) {
          seen.add(dep.id);
          result.push({
            id: dep.id,
            amount: Number(dep.deposit_amount) || 0,
            productName: item.product_name,
            customerName: dep.customer_name,
          });
        }
      }
    }
    return result;
  })();
  const depositDiscount = appliedDeposits.reduce((s, d) => s + d.amount, 0);
  const depositLabel = appliedDeposits.length === 1
    ? `KH ${appliedDeposits[0].customerName}`
    : appliedDeposits.length > 1
    ? `${appliedDeposits.length} sản phẩm`
    : undefined;

  // Handle proceed to payment
  const handleProceedToPayment = () => {
    // Check order limit first
    if (isLimitReached) {
      setShowOrderLimitDialog(true);
      return;
    }

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
  const handlePaymentComplete = async (payments: ExportPayment[], pointsRedeemed: number, pointsDiscount: number, giftVoucherTemplateId?: string, skipCashBook?: boolean, appliedVoucherIds?: string[], voucherDiscount?: number) => {
    if (isSubmitting) return; // Chống double-submit
    setIsSubmitting(true);

    // Prepare optimistic receipt data for invoice display immediately
    const staffMember = staffList?.find(s => s.user_id === (isSuperAdmin ? salesStaffId : user?.id));
    const optimisticCustomer = {
      id: selectedCustomer?.id || '',
      name: customerName,
      phone: customerPhone,
      address: customerAddress || null,
      email: customerEmail || null,
      code: (selectedCustomer as any)?.entity_code || '',
      group_name: (selectedCustomer as any)?.group_name || '',
      membership_tier: selectedCustomer?.membership_tier || '',
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
      voucher_discount: voucherDiscount || 0,
      sale_date: new Date().toISOString(),
      staff_name: staffMember?.display_name || '',
      note: receiptNote || '',
      branch_id: cart[0]?.branch_id || null,
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
    const savedIsSelfSold = isSelfSold;
    const savedExportDate = exportDate || null;
    const savedReceiptNote = receiptNote || null;
    const savedAppliedDepositIds = appliedDeposits.map(d => d.id);
    const savedDepositDiscount = depositDiscount;

    setCart([]);
    exportDraft.clearDraft();
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerEmail('');
    setCustomerSource('');
    setCustomerBirthday(undefined);
    setSelectedCustomer(null);
    setSalesStaffId(null);
    setIsSelfSold(false);
    setTaxEnabled(false);
    setTaxRate(null);
    setCustomTaxRate('');
    setExportDate('');
    setReceiptNote('');

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
        voucherDiscount: voucherDiscount || 0,
        branchId,
        vatRate: savedEffectiveTaxRate,
        vatAmount: savedTaxAmount,
        salesStaffId: savedSalesStaffId,
        isSelfSold: savedIsSelfSold,
        skipCashBook,
        exportDate: savedExportDate ? new Date(savedExportDate).toISOString() : undefined,
        note: savedReceiptNote || undefined,
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

      // Đánh dấu các deposit đã được áp dụng vào phiếu này
      if (savedAppliedDepositIds.length > 0 && receipt?.id) {
        try {
          await applyDeposits.mutateAsync({
            depositIds: savedAppliedDepositIds,
            receiptId: receipt.id,
          });
        } catch (err) {
          console.warn('Apply deposits failed:', err);
        }
      }

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

      // Mark applied vouchers as used
      if (appliedVoucherIds && appliedVoucherIds.length > 0) {
        for (const vId of appliedVoucherIds) {
          try {
            await markVoucherUsed.mutateAsync(vId);
          } catch {
            // Non-critical
          }
        }
        successMessage += `. Đã sử dụng ${appliedVoucherIds.length} voucher`;
      }

      if (autoEmailEnabled && savedCustomerEmail) {
        supabase.functions.invoke('send-export-email', {
          body: {
            tenant_id: landingSettings?.tenant_id,
            order_id: receipt.id,
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
            sales_staff_id: savedSalesStaffId,
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  {t('tours.exportNew.searchProduct')}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/repair/new')}
                  className="gap-1.5"
                >
                  <Wrench className="h-4 w-4" />
                  <span className="hidden sm:inline">Sửa chữa</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={t('tours.exportNew.searchPlaceholder')}
                    value={imeiSearch || nameSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Only treat as pure IMEI (exact match) if 6+ digits
                      if (/^\d{6,}$/.test(val.trim())) {
                        setImeiSearch(val);
                        setNameSearch('');
                      } else {
                        // For 3-5 digit inputs or text, use name search (which also searches partial IMEI)
                        setNameSearch(val);
                        setImeiSearch('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleManualSearch();
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
                  onClick={() => void handleManualSearch()}
                  disabled={checkProduct.isPending || searchProducts.isPending}
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
                          setAvailableStock(null);
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
                        <Label>
                          {t('pages.exportNew.quantity')} ({selectedProduct.unit || 'cái'})
                          {availableStock != null && (
                            <span className="text-muted-foreground font-normal ml-1">- Còn: {availableStock}</span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          min={['kg', 'lít', 'mét'].includes(selectedProduct.unit) ? 0.001 : 1}
                          max={availableStock ?? undefined}
                          step={['kg', 'lít', 'mét'].includes(selectedProduct.unit) ? 0.1 : 1}
                          value={itemQuantity}
                          onChange={(e) => {
                            const raw = e.target.value;
                            // Allow empty field for easy re-typing
                            if (raw === '' || raw === '0') {
                              setItemQuantity(raw);
                              return;
                            }
                            const val = parseFloat(raw);
                            if (isNaN(val)) return;
                            const maxQty = availableStock ?? Infinity;
                            if (['kg', 'lít', 'mét'].includes(selectedProduct.unit)) {
                              setItemQuantity(Math.min(val, maxQty));
                            } else {
                              setItemQuantity(Math.min(Math.max(1, Math.round(val)), maxQty));
                            }
                          }}
                          onBlur={() => {
                            // On blur, ensure valid value
                            const num = typeof itemQuantity === 'string' ? parseFloat(itemQuantity) : itemQuantity;
                            const isDecimal = ['kg', 'lít', 'mét'].includes(selectedProduct.unit);
                            const minVal = isDecimal ? 0.001 : 1;
                            const maxVal = availableStock ?? Infinity;
                            if (isNaN(num as number) || (num as number) < minVal) {
                              setItemQuantity(minVal);
                            } else if ((num as number) > maxVal) {
                              setItemQuantity(maxVal);
                            }
                          }}
                          className="text-center"
                          placeholder={availableStock != null ? `Tối đa: ${availableStock}` : ''}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('pages.exportNew.warranty')} {selectedProduct?.imei && <span className="text-destructive">*</span>}</Label>
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

          {/* Export Date card removed - moved into customer info section */}

          {/* Cart */}
          <Card data-tour="export-cart">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {t('tours.exportNew.cart')} ({t('pages.exportNew.cartProducts', { count: cart.reduce((sum, item) => sum + item.quantity, 0) })})
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
                          {(() => {
                            const dep = depositMap.get(item.product_id);
                            if (!dep) return null;
                            // Cảnh báo cọc:
                            // - Sản phẩm có IMEI: luôn cảnh báo (vì 1 IMEI = 1 sản phẩm cụ thể).
                            // - Sản phẩm không IMEI: chỉ cảnh báo khi tổng số cọc >= tồn kho
                            //   (kho còn nhiều thì bán cho khách khác không ảnh hưởng người cọc).
                            if (!item.imei) {
                              const stock = productStockMap.get(item.product_id) ?? 0;
                              const totalDeposited = totalQtyByProduct.get(item.product_id) || 0;
                              if (stock > 0 && totalDeposited < stock) return null;
                            }
                            const matchCustomer = !!(
                              (selectedCustomer?.id && dep.customer_id && selectedCustomer.id === dep.customer_id) ||
                              (customerPhone && dep.customer_phone && customerPhone.replace(/\D/g, '') === dep.customer_phone.replace(/\D/g, ''))
                            );
                            return (
                              <div className={cn(
                                "mt-1 inline-flex items-start gap-1.5 px-2 py-1 rounded text-xs font-medium",
                                matchCustomer
                                  ? "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300"
                                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                              )}>
                                <BadgeDollarSign className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div>
                                    {matchCustomer ? '✓ Khách đã cọc' : '⚠️ Đã có người cọc'}: <span className="font-semibold">{formatNumber(Number(dep.deposit_amount))}đ</span>
                                  </div>
                                  <div className="text-[11px] opacity-90">
                                    KH: {dep.customer_name}{dep.customer_phone ? ` · ${dep.customer_phone}` : ''}
                                    {dep.note ? ` · ${dep.note}` : ''}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {item.imei || item.sku}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{item.categoryName || '-'}</TableCell>
                        <TableCell className="text-center">
                          {item.imei ? (
                            <span className="text-sm font-medium">1</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={['kg', 'lít', 'mét'].includes(item.unit) ? 0.001 : 1}
                                step={['kg', 'lít', 'mét'].includes(item.unit) ? 0.1 : 1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  const isDecimal = ['kg', 'lít', 'mét'].includes(item.unit);
                                  handleUpdateCartQuantity(item.tempId, isDecimal ? Math.max(0.001, val || 0.001) : Math.max(1, Math.round(val) || 1));
                                }}
                                className="w-16 text-center h-8"
                              />
                              {item.unit !== 'cái' && (
                                <span className="text-xs text-muted-foreground">{item.unit}</span>
                              )}
                            </div>
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

                {/* Đơn này khách của nhân viên — cộng hoa hồng tự bán */}
                <div className="space-y-1.5 pt-2 border-t">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={isSelfSold}
                      onCheckedChange={(v) => setIsSelfSold(v === true)}
                      className="mt-0.5"
                    />
                    <span className="flex-1">
                      <span className="text-sm font-medium">Đơn này khách của nhân viên</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">
                        Tick để cộng thêm <b>hoa hồng tự bán</b> cho nhân viên (theo cấu hình "Tự bán" trong bảng lương).
                      </span>
                    </span>
                  </label>
                </div>

                {/* Export Date - compact, hidden picker until clicked */}
                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    Ngày giờ xuất hàng
                  </Label>
                  <div
                    className="relative"
                    onClick={() => {
                      const el = document.getElementById('export-datetime-input') as HTMLInputElement | null;
                      if (!el) return;
                      try {
                        // Open native picker immediately (no perceived delay)
                        (el as any).showPicker?.();
                        el.focus();
                      } catch {
                        el.focus();
                        el.click();
                      }
                    }}
                  >
                    <input
                      id="export-datetime-input"
                      type="datetime-local"
                      value={exportDate}
                      onChange={(e) => setExportDate(e.target.value)}
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <div className="flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent/50 transition-colors">
                      <span className={cn(!exportDate && 'text-muted-foreground')}>
                        {exportDate
                          ? new Date(exportDate).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'Mặc định: thời điểm hiện tại'}
                      </span>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {!exportDate && (
                    <p className="text-xs text-muted-foreground">Để trống = tự động lấy thời điểm hiện tại</p>
                  )}
                </div>

                {/* Receipt Note */}
                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <FileText className="h-3.5 w-3.5" />
                    Ghi chú phiếu
                  </Label>
                  <Input
                    placeholder="Ghi chú cho cả phiếu xuất (tuỳ chọn)"
                    value={receiptNote}
                    onChange={(e) => setReceiptNote(e.target.value)}
                  />
                </div>
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
                  <span className="font-medium">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
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

              {/* Auto email + zalo toggle */}
              <AutoEmailToggle
                id="auto-email-export"
                checked={autoEmailEnabled}
                onCheckedChange={setAutoEmailEnabled}
                hasCustomerEmail={!!customerEmail}
                zaloChecked={autoZaloEnabled}
                onZaloCheckedChange={setAutoZaloEnabled}
                hasCustomerPhone={!!customerPhone}
              />

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
        customerVouchers={customerVouchers}
        depositDiscount={depositDiscount}
        depositLabel={depositLabel}
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
      <ResumeDraftDialog
        open={exportDraft.showResumePrompt}
        itemCount={exportDraft.pendingDraft?.items.length ?? 0}
        onResume={handleResumeExportDraft}
        onDiscard={exportDraft.dismissPrompt}
        title="Phát hiện phiếu xuất chưa hoàn thành"
      />
      <OrderLimitDialog
        open={showOrderLimitDialog}
        onOpenChange={setShowOrderLimitDialog}
        orderCount={orderCount}
        freeOrderLimit={freeOrderLimit}
      />
    </MainLayout>
  );
}
