import { useState, useMemo, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImportCart } from '@/components/import/ImportCart';
import { PaymentDialog } from '@/components/import/PaymentDialog';
import { ExcelImportDialog } from '@/components/import/ExcelImportDialog';
import { ProductNamingTip } from '@/components/import/ProductNamingTip';
import { useCategories, useCreateCategory } from '@/hooks/useCategories';
import { useSuppliersByBranch, useCreateSupplier } from '@/hooks/useSuppliers';
import { useProducts, useCheckIMEI, useBatchCheckIMEI } from '@/hooks/useProducts';
import { usePermissions } from '@/hooks/usePermissions';
import { useCreateImportReceipt } from '@/hooks/useImportReceipts';
import { useBranches } from '@/hooks/useBranches';
import { useImportGuideUrl } from '@/hooks/useAppConfig';
import { supabase } from '@/integrations/supabase/client';
import { ImportReceiptItem, PaymentSource } from '@/types/warehouse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PriceInput } from '@/components/ui/price-input';
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
import { FileSpreadsheet, Download, Plus, ShoppingCart, Loader2, Building2, BookOpen, PlayCircle, Search, Package, ArrowLeft, QrCode, X } from 'lucide-react';
import { BarcodeDialog } from '@/components/products/BarcodeDialog';
import { ImportQRScanner, parseVKHOQR, type VKHOQRData } from '@/components/import/ImportQRScanner';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { downloadImportTemplate } from '@/lib/excelTemplates';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';
import { useTranslation } from 'react-i18next';

function useImportNewTourSteps(): TourStep[] {
  const { t } = useTranslation();
  return [
    {
      title: t('tours.importNew.tourTitle1'),
      description: t('tours.importNew.tourDesc1'),
      isInfo: true,
    },
    {
      title: t('tours.importNew.tourTitle2'),
      description: t('tours.importNew.tourDesc2'),
      targetSelector: '[data-tour="import-receipt-info"]',
      position: 'bottom' as const,
    },
    {
      title: t('tours.importNew.tourTitle3'),
      description: t('tours.importNew.tourDesc3'),
      targetSelector: '[data-tour="import-product-form"]',
      position: 'center' as const,
    },
    {
      title: t('tours.importNew.tourTitle4'),
      description: t('tours.importNew.tourDesc4'),
      targetSelector: '[data-tour="import-add-to-cart"]',
      position: 'top' as const,
    },
    {
      title: t('tours.importNew.tourTitle5'),
      description: t('tours.importNew.tourDesc5'),
      targetSelector: '[data-tour="import-cart"]',
      position: 'center' as const,
    },
  ];
}

export default function ImportNewPage() {
  const { isCompleted: tourCompleted, completeTour } = useOnboardingTour('import_new');
  const { t } = useTranslation();
  const IMPORT_NEW_TOUR_STEPS = useImportNewTourSteps();
  const [tourDismissed, setTourDismissed] = useState(false);
  const [manualTourActive, setManualTourActive] = useState(false);
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: products } = useProducts();
  const { data: branches } = useBranches();
  const importGuideUrl = useImportGuideUrl();
  const { data: permissions } = usePermissions();
  const isSuperAdmin = permissions?.canViewAllBranches === true;
  const createCategory = useCreateCategory();
  const createSupplier = useCreateSupplier();
  const createImportReceipt = useCreateImportReceipt();
  const checkIMEI = useCheckIMEI();
  const batchCheckIMEI = useBatchCheckIMEI();

  // Branch state - default to first branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Suppliers filtered by selected branch
  const { data: suppliers } = useSuppliersByBranch(selectedBranchId || undefined);

  // Set default branch - non-Super Admin: lock to their branch
  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setSelectedBranchId(permissions.branchId);
    } else if (isSuperAdmin && branches && branches.length > 0 && !selectedBranchId) {
      const defaultBranch = branches.find(b => b.is_default) || branches[0];
      setSelectedBranchId(defaultBranch.id);
    }
  }, [branches, selectedBranchId, isSuperAdmin, permissions?.branchId]);

  const [cart, setCart] = useState<ImportReceiptItem[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printQRPromptOpen, setPrintQRPromptOpen] = useState(false);
  const [printQRProducts, setPrintQRProducts] = useState<{ id: string; name: string; sku: string; imei?: string; importPrice: number; salePrice?: number }[]>([]);
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  // 'search' = only product name visible, 'form' = full fields visible
  const [productFormMode, setProductFormMode] = useState<'search' | 'form'>('search');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // Receipt-level supplier (applies to entire receipt)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Form state (product-level only)
  const [form, setForm] = useState({
    productName: '',
    sku: '',
    imei: '',
    categoryId: '',
    importPrice: '',
    salePrice: '',
    quantity: '1',
    note: '',
  });

  // New supplier/category form
  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', phone: '', address: '' });
  const [newCategoryName, setNewCategoryName] = useState('');

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.importPrice * item.quantity, 0),
    [cart]
  );

  // Debounced server-side product search for suggestions
  const searchProductsFromDB = useCallback(async (searchValue: string) => {
    if (searchValue.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    try {
      const s = searchValue.trim();
      const { data, error } = await supabase.rpc('search_product_suggestions' as any, {
        p_search: s,
        p_limit: 20,
      });

      if (error) throw error;
      setSuggestions(((data as any[]) || []).map((r: any) => ({
        name: r.product_name,
        sku: r.product_sku,
        category_id: r.category_id,
        import_price: r.latest_import_price,
        sale_price: r.latest_sale_price,
        totalQty: r.in_stock_qty,
      })));
    } catch (err) {
      console.error('Product search error:', err);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleProductNameChange = (value: string) => {
    setForm({ ...form, productName: value });
    // Debounce the DB search
    if ((window as any).__productSearchTimer) clearTimeout((window as any).__productSearchTimer);
    (window as any).__productSearchTimer = setTimeout(() => {
      searchProductsFromDB(value);
    }, 300);
  };

  const handleSelectSuggestion = (product: any) => {
    setForm({
      ...form,
      productName: product.name,
      sku: product.sku,
      categoryId: '', // Always require re-selecting category
      importPrice: product.import_price ? String(product.import_price) : '',
      salePrice: product.sale_price ? String(product.sale_price) : '',
    });
    setSuggestions([]);
    setProductFormMode('form');
  };

  const handleAddNewProduct = () => {
    // Keep current productName, switch to full form
    setProductFormMode('form');
    setSuggestions([]);
  };

  const [isCheckingIMEI, setIsCheckingIMEI] = useState(false);

  const handleAddToCart = async () => {
    const errors: Record<string, string> = {};
    if (!form.productName.trim()) errors.productName = t('tours.importNew.enterProductName');
    if (!form.sku.trim()) errors.sku = t('tours.importNew.enterSku');
    if (!form.categoryId) errors.categoryId = t('tours.importNew.selectCategoryError');
    if (!form.importPrice) errors.importPrice = t('tours.importNew.enterImportPrice');

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Scroll to first error
      const firstErrorField = document.querySelector('[data-error="true"]');
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFieldErrors({});

    // Check IMEI uniqueness
    if (form.imei && form.imei.trim()) {
      // Check in cart first (local)
      const inCart = cart.find(item => item.imei === form.imei.trim());
      if (inCart) {
        toast({
          title: t('tours.importNew.imeiDuplicateCart'),
          description: t('tours.importNew.imeiDuplicateCartDesc', { imei: form.imei }),
          variant: 'destructive',
        });
        return;
      }

      // Check in database
      try {
        setIsCheckingIMEI(true);
        const existingProduct = await checkIMEI.mutateAsync(form.imei.trim());
        if (existingProduct) {
          const statusText = existingProduct.status === 'in_stock' ? t('tours.importNew.inStockStatus') : t('tours.importNew.warrantyStatus');
          toast({
            title: t('tours.importNew.imeiExistsInStock'),
            description: `${existingProduct.name} (${existingProduct.sku}) - IMEI "${form.imei}" - ${statusText}`,
            variant: 'destructive',
          });
          setIsCheckingIMEI(false);
          return;
        }
      } catch (error: any) {
        console.error('Error checking IMEI:', error);
        toast({
            title: t('tours.importNew.imeiCheckError'),
            description: error.message || t('tours.importNew.cannotCheckImei'),
            variant: 'destructive',
          });
        setIsCheckingIMEI(false);
        return;
      }
      setIsCheckingIMEI(false);
    }

    const category = categories?.find((c) => c.id === form.categoryId);
    
    // For IMEI products, quantity is always 1
    const quantity = form.imei ? 1 : Math.max(1, parseInt(form.quantity) || 1);

    const importPrice = Number(form.importPrice);
    // Auto-calculate sale price if not manually set
    let salePrice = form.salePrice ? Number(form.salePrice) : undefined;
    if (!salePrice || salePrice <= 0) {
      salePrice = form.imei ? importPrice + 2000000 : importPrice * 2;
    }

    const newItem: ImportReceiptItem = {
      id: String(Date.now()),
      productName: form.productName,
      sku: form.sku,
      imei: form.imei || undefined,
      categoryId: form.categoryId,
      categoryName: category?.name,
      importPrice,
      salePrice,
      quantity,
      supplierId: '', // Will use receipt-level supplier
      supplierName: '',
      note: form.note || undefined,
    };

    setCart([...cart, newItem]);
    setForm({
      productName: '',
      sku: '',
      imei: '',
      categoryId: '',
      importPrice: '',
      salePrice: '',
      quantity: '1',
      note: '',
    });
    setProductFormMode('search');
    toast({
      title: t('tours.importNew.addedToCart'),
      description: t('tours.importNew.addedToCartDesc', { name: newItem.productName, qty: quantity }),
    });
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: t('tours.importNew.emptyCart'),
        description: t('tours.importNew.addProductsFirst'),
        variant: 'destructive',
      });
      return;
    }
    if (!selectedSupplierId) {
      setFieldErrors(prev => ({ ...prev, supplier: t('tours.importNew.selectSupplierError') }));
      document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFieldErrors(prev => { const { supplier, ...rest } = prev; return rest; });
    setPaymentOpen(true);
  };

  const handlePaymentConfirm = (payments: PaymentSource[], skipCashBook?: boolean) => {
    // Prevent double submission
    if (isSubmitting) return;
    
    const cartSnapshot = [...cart];
    const totalSnapshot = totalAmount;

    // Close payment dialog & clear cart
    setPaymentOpen(false);
    setCart([]);

    // Save cart items for QR print prompt
    const qrProducts = cartSnapshot.map((item, idx) => ({
      id: item.id || String(Date.now() + idx),
      name: item.productName,
      sku: item.sku,
      imei: item.imei || undefined,
      importPrice: item.importPrice,
      salePrice: item.salePrice,
    }));
    setPrintQRProducts(qrProducts);
    const hidePrompt = localStorage.getItem('hide_qr_print_prompt') === 'true';
    if (hidePrompt) {
      // Don't show prompt, go directly to history
    } else {
      setPrintQRPromptOpen(true);
    }

    toast({
      title: t('tours.importNew.processingImport'),
      description: t('tours.importNew.processingImportDesc', { count: cartSnapshot.length }),
    });

    // Process in background
    createImportReceipt.mutateAsync({
      products: cartSnapshot.map(item => ({
        name: item.productName,
        sku: item.sku,
        imei: item.imei || null,
        category_id: item.categoryId || null,
        import_price: item.importPrice,
        sale_price: item.salePrice || null,
        quantity: item.quantity,
        supplier_id: selectedSupplierId || null,
        note: item.note || null,
      })),
      payments: payments.map(p => ({
        type: p.type as 'cash' | 'bank_card' | 'e_wallet' | 'debt',
        amount: p.amount,
      })),
      supplierId: selectedSupplierId || null,
      branchId: selectedBranchId || null,
      skipCashBook,
    }).then(() => {
      toast({
        title: t('tours.importNew.importSuccess'),
        description: t('tours.importNew.importSuccessDesc', { count: cartSnapshot.length, total: totalSnapshot.toLocaleString('vi-VN') }),
      });
    }).catch((error: any) => {
      toast({
        title: t('tours.importNew.importError'),
        description: error.message,
        variant: 'destructive',
      });
    });
  };

  const handlePrintQR = () => {
    setPrintQRPromptOpen(false);
    setBarcodeDialogOpen(true);
  };

  const handleSkipPrintQR = () => {
    setPrintQRPromptOpen(false);
    setPrintQRProducts([]);
    navigate('/import/history');
  };

  const handleNeverShowQR = () => {
    localStorage.setItem('hide_qr_print_prompt', 'true');
    setPrintQRPromptOpen(false);
    setPrintQRProducts([]);
    navigate('/import/history');
  };

  const handleExportTemplate = () => {
    downloadImportTemplate();
    toast({
      title: t('tours.importNew.templateDownloaded'),
      description: t('tours.importNew.templateDownloadedDesc'),
    });
  };

  const handleExcelImportMultiple = async (groups: { items: ImportReceiptItem[]; supplierName: string; branchName?: string; isNewSupplier: boolean }[]) => {
    // Collect new supplier names
    const newSupplierNames = groups.filter(g => g.isNewSupplier).map(g => g.supplierName);
    
    // Auto-create new suppliers first
    if (newSupplierNames.length > 0) {
      try {
        for (const name of newSupplierNames) {
          await createSupplier.mutateAsync({ name, branch_id: selectedBranchId || null });
        }
        toast({
          title: t('tours.importNew.createdNewSuppliers'),
          description: t('tours.importNew.autoCreatedSuppliers', { count: newSupplierNames.length, names: newSupplierNames.join(', ') }),
        });
      } catch (error: any) {
        console.error('Error creating suppliers:', error);
        toast({
          title: t('tours.importNew.createSupplierError'),
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
    }
    
    // If only one group, add to cart normally
    if (groups.length === 1) {
      setCart(prev => [...prev, ...groups[0].items]);
      
      // Auto-select supplier
      if (groups[0].supplierName && groups[0].supplierName !== 'Không có NCC') {
        setTimeout(() => {
          const matchedSupplier = suppliers?.find(
            s => s.name.toLowerCase() === groups[0].supplierName.toLowerCase()
          );
          if (matchedSupplier) {
            setSelectedSupplierId(matchedSupplier.id);
          }
        }, 500);
      }
      
      // Auto-select branch
      if (groups[0].branchName && branches) {
        const matchedBranch = branches.find(
          b => b.name.toLowerCase() === groups[0].branchName!.toLowerCase()
        );
        if (matchedBranch) {
          setSelectedBranchId(matchedBranch.id);
        }
      }
      return;
    }
    
    // Multiple groups - create receipts directly
    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    // Wait for suppliers to be available after creation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    for (const group of groups) {
      try {
        // Find supplier ID (either existing or newly created)
        let supplierId: string | null = null;
      if (group.supplierName && group.supplierName !== t('tours.importNew.noSupplierNCC')) {
          // Re-query suppliers to get fresh data
          const { data: freshSuppliers } = await supabase
            .from('suppliers')
            .select('id, name')
            .ilike('name', group.supplierName);
          
          const matchedSupplier = freshSuppliers?.find(
            s => s.name.toLowerCase() === group.supplierName.toLowerCase()
          );
          supplierId = matchedSupplier?.id || null;
        }
        
        // Find branch ID
        let branchId = selectedBranchId;
        if (group.branchName && branches) {
          const matchedBranch = branches.find(
            b => b.name.toLowerCase() === group.branchName!.toLowerCase()
          );
          if (matchedBranch) {
            branchId = matchedBranch.id;
          }
        }
        
        // Create receipt with all items paid in full
        await createImportReceipt.mutateAsync({
          products: group.items.map(item => ({
            name: item.productName,
            sku: item.sku,
            imei: item.imei || null,
            category_id: item.categoryId || null,
            import_price: item.importPrice,
            sale_price: item.salePrice || null,
            quantity: item.quantity,
            supplier_id: supplierId,
            note: item.note || null,
          })),
          payments: [{
            type: 'cash',
            amount: group.items.reduce((sum, item) => sum + item.importPrice * item.quantity, 0),
          }],
          supplierId,
          branchId: branchId || null,
        });
        
        successCount++;
      } catch (error: any) {
        console.error(`Error creating receipt for ${group.supplierName}:`, error);
        failCount++;
      }
    }
    
    setIsSubmitting(false);
    
    if (successCount > 0) {
      toast({
        title: t('tours.importNew.importedSuccessMulti'),
        description: failCount > 0 
          ? t('tours.importNew.importedSuccessMultiWithError', { success: successCount, fail: failCount })
          : t('tours.importNew.importedSuccessMultiDesc', { success: successCount }),
      });
      navigate('/import/history');
    } else {
      toast({
        title: t('tours.importNew.importError'),
        description: t('tours.importNew.importErrorRetry'),
        variant: 'destructive',
      });
    }
  };

  const handleAddNewSupplier = async () => {
    if (!newSupplierForm.name.trim()) return;
    try {
      // Auto-assign to current selected branch
      const newSupplier = await createSupplier.mutateAsync({
        name: newSupplierForm.name.trim(),
        phone: newSupplierForm.phone.trim() || null,
        address: newSupplierForm.address.trim() || null,
        branch_id: selectedBranchId || null,
      });
      // Auto-select the newly created supplier
      if (newSupplier?.id) {
        setSelectedSupplierId(newSupplier.id);
      }
      toast({ title: t('tours.importNew.addedSupplier'), description: newSupplierForm.name });
      setSupplierDialogOpen(false);
      setNewSupplierForm({ name: '', phone: '', address: '' });
    } catch (error: any) {
      toast({ title: t('pages.importNew.error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const newCat = await createCategory.mutateAsync({ name: newCategoryName.trim() });
      // Auto-select the newly created category
      if (newCat?.id) {
        setForm(prev => ({ ...prev, categoryId: newCat.id }));
      }
      toast({ title: t('tours.importNew.addedCategory'), description: newCategoryName });
      setCategoryDialogOpen(false);
      setNewCategoryName('');
    } catch (error: any) {
      toast({ title: t('pages.importNew.error'), description: error.message, variant: 'destructive' });
    }
  };

  // Handle QR scan from ImportQRScanner
  const handleQRScanResult = useCallback((data: VKHOQRData, continuous: boolean) => {
    if (continuous) {
      // Continuous mode: auto-add to cart directly
      // Try to find existing product in stock
      const matchedProduct = data.imei
        ? products?.find(p => p.imei === data.imei && p.status === 'in_stock')
        : data.productName
          ? products?.filter(p => p.status === 'in_stock').find(p => p.name.toLowerCase() === data.productName!.toLowerCase())
          : null;

      // Check if already in cart (by IMEI or name+sku)
      if (data.imei) {
        const inCart = cart.find(item => item.imei === data.imei);
        if (inCart) {
          toast({ title: t('tours.importNew.inCartAlready'), description: t('tours.importNew.inCartAlreadyDesc', { imei: data.imei }) });
          return;
        }
      } else if (data.productName) {
        // Non-IMEI: increase quantity if already in cart
        const existingCartItem = cart.find(
          item => !item.imei && item.productName.toLowerCase() === data.productName!.toLowerCase()
        );
        if (existingCartItem) {
          setCart(prev => prev.map(item =>
            item.id === existingCartItem.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ));
          toast({ title: t('tours.importNew.quantityIncreased'), description: `${data.productName}: +1` });
          return;
        }
      }

      const productName = data.productName || matchedProduct?.name || data.imei || t('tours.importNew.qrProduct');
      const sku = data.sku || (matchedProduct && 'sku' in matchedProduct ? matchedProduct.sku : '') || productName;
      // QR price = giá kho cũ → không dùng, để trống cả importPrice và salePrice
      const salePrice = 0;

      const newItem: ImportReceiptItem = {
        id: String(Date.now()),
        productName,
        sku,
        imei: data.imei || undefined,
        categoryId: (matchedProduct && 'category_id' in matchedProduct ? matchedProduct.category_id : '') || '',
        importPrice: 0, // User sẽ tự nhập giá nhập mới
        salePrice: salePrice || undefined,
        quantity: 1,
        supplierId: '',
        supplierName: '',
        note: data.note || undefined,
      };

      setCart(prev => [...prev, newItem]);
      toast({ title: t('tours.importNew.addedToCart'), description: `${productName}${data.imei ? ` (${data.imei})` : ''} - ${t('tours.importNew.needImportPrice')}` });
    } else {
      // Single scan mode: fill form
      if (data.productName) {
        // Try to find and select existing product
        const match = products?.filter(p => p.status === 'in_stock').find(
          p => p.name.toLowerCase() === data.productName!.toLowerCase()
        );
        if (match) {
          handleSelectSuggestion(match);
        } else {
          setForm(prev => ({ ...prev, productName: data.productName || prev.productName }));
          setProductFormMode('form');
        }
      }
      setForm(prev => ({
        ...prev,
        productName: data.productName || prev.productName,
        sku: data.sku || prev.sku || data.productName || prev.productName,
        imei: data.imei || prev.imei,
        importPrice: '', // Để trống - user tự nhập giá mua vào
        salePrice: '',   // Để trống - không lấy giá kho cũ (tránh lộ giá)
        note: data.note || prev.note,
      }));
      setProductFormMode('form');
      setSuggestions([]);
    }
  }, [products, cart, handleSelectSuggestion]);

  return (
    <MainLayout>
      <PageHeader
        title={t('tours.importNew.pageTitle')}
        description={t('tours.importNew.pageDesc')}
        helpText={t('tours.importNew.pageHelp')}
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
            {importGuideUrl && (
              <Button 
                variant="default" 
                asChild 
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md animate-pulse hover:animate-none"
              >
                <a href={importGuideUrl} target="_blank" rel="noopener noreferrer">
                  <BookOpen className="mr-1.5 h-4 w-4" />
                  {t('tours.importNew.guideBtn')}
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href="/templates/Bang_ke_thu_mua_iPhone_cu.xlsx" download="Bang_ke_thu_mua_iPhone_cu.xlsx">
                <Download className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">{t('tours.importNew.purchaseTemplate')}</span>
                <span className="sm:hidden">{t('tours.importNew.purchaseTemplateShort')}</span>
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportTemplate}>
              <Download className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{t('tours.importNew.downloadTemplate')}</span>
              <span className="sm:hidden">{t('tours.importNew.downloadTemplateShort')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExcelImportOpen(true)}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{t('tours.importNew.importFromExcel')}</span>
              <span className="sm:hidden">{t('tours.importNew.importFromExcelShort')}</span>
            </Button>
          </div>
        }
      />

      <div className="p-3 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            <div className="bg-card border rounded-xl p-4 sm:p-6" data-tour="import-receipt-info">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t('tours.importNew.receiptInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Branch Selection */}
                <div className="form-field">
                  <Label>{t('tours.importNew.importBranch')}</Label>
                  {isSuperAdmin ? (
                    <Select
                      value={selectedBranchId}
                      onValueChange={(val) => {
                        setSelectedBranchId(val);
                        // Reset supplier when branch changes
                        setSelectedSupplierId('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('tours.importNew.selectBranch')} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name} {branch.is_default && t('tours.importNew.defaultBranch')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={branches?.find(b => b.id === selectedBranchId)?.name || t('tours.importNew.loadingBranch')}
                      disabled
                      className="bg-muted"
                    />
                  )}
                </div>

                {/* Supplier Selection */}
                <div className="form-field" data-error={!!fieldErrors.supplier || undefined}>
                  <Label>{t('tours.importNew.supplierLabel')}</Label>
                  <div className="flex gap-2">
                    <SupplierSearchCombobox
                      suppliers={suppliers || []}
                      value={selectedSupplierId}
                      onChange={(val) => {
                        setSelectedSupplierId(val);
                        setFieldErrors(prev => { const { supplier, ...rest } = prev; return rest; });
                      }}
                      hasError={!!fieldErrors.supplier}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setSupplierDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {fieldErrors.supplier && <p className="text-xs text-destructive mt-1">{fieldErrors.supplier}</p>}
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-xl p-4 sm:p-6" data-tour="import-product-form">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="font-semibold">{t('tours.importNew.productInfo')}</h3>
                {productFormMode === 'form' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProductFormMode('search');
                      setForm({ productName: '', sku: '', imei: '', categoryId: '', importPrice: '', salePrice: '', quantity: '1', note: '' });
                      setSuggestions([]);
                      setFieldErrors({});
                    }}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    {t('tours.importNew.searchOther')}
                  </Button>
                )}
              </div>

              {/* Product Name - always visible */}
              <div className="form-field relative mb-4">
                <Label htmlFor="productName">{t('tours.importNew.productName')}</Label>
                {productFormMode === 'search' ? (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="productName"
                          value={form.productName}
                          onChange={(e) => handleProductNameChange(e.target.value)}
                          placeholder={t('tours.importNew.searchOrAddProduct')}
                          className="pl-9"
                          autoComplete="off"
                        />
                      </div>
                      <ImportQRScanner onScanResult={handleQRScanResult} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('tours.importNew.searchHint')}
                    </p>

                    {/* Search Results Dropdown */}
                    {form.productName.length >= 2 && (
                      <div className="mt-2 bg-popover border rounded-lg shadow-lg overflow-hidden">
                        {suggestions.length > 0 && (
                          <div className="max-h-64 overflow-y-auto divide-y divide-border">
                            {suggestions.map((s, idx) => (
                              <button
                                key={`${s.name}-${s.sku}-${idx}`}
                                onClick={() => handleSelectSuggestion(s)}
                                className="w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate">{s.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      SKU: {s.sku} | {t('tours.importNew.stockQty')}<span className="font-medium text-foreground">{s.totalQty}</span>
                                    </p>
                                  </div>
                                  <Package className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {suggestions.length === 0 && !isSearching && (
                          <div className="px-4 py-3 text-sm text-muted-foreground">
                            {t('tours.importNew.noMatchingProducts')}
                          </div>
                        )}
                        <button
                          onClick={handleAddNewProduct}
                          className="w-full px-4 py-3 text-left hover:bg-muted border-t border-border transition-colors flex items-center gap-2 text-primary font-medium text-sm"
                        >
                          <Plus className="h-4 w-4" />
                          {t('tours.importNew.addNewProduct')}{form.productName.trim() ? `: "${form.productName.trim()}"` : ''}
                        </button>
                      </div>
                    )}

                    {/* Always-visible Add New Product button */}
                    <Button
                      variant="outline"
                      className="w-full mt-3 border-dashed border-primary/50 text-primary hover:bg-primary/5"
                      onClick={handleAddNewProduct}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('tours.importNew.addNewProduct')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      id="productName"
                      value={form.productName}
                      onChange={(e) => {
                        handleProductNameChange(e.target.value);
                        if (fieldErrors.productName) setFieldErrors(prev => { const { productName, ...rest } = prev; return rest; });
                      }}
                      placeholder={t('pages.importNew.enterProductName')}
                      autoComplete="off"
                      className={fieldErrors.productName ? 'border-destructive ring-destructive/30 ring-2' : ''}
                      data-error={!!fieldErrors.productName || undefined}
                    />
                    {fieldErrors.productName && <p className="text-xs text-destructive mt-1">{fieldErrors.productName}</p>}
                    {/* Old-style simple suggestions in form mode */}
                    {suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {suggestions.map((s, idx) => (
                          <button
                            key={`${s.name}-${s.sku}-${idx}`}
                            onClick={() => {
                              setForm({ ...form, productName: s.name, sku: s.sku });
                              setSuggestions([]);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-muted text-sm"
                          >
                            <span className="font-medium">{s.name}</span>
                            <span className="text-muted-foreground ml-2">({s.sku})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Naming Tips - only in form mode */}
              {productFormMode === 'form' && <ProductNamingTip />}

              {/* Full form fields - only visible in form mode */}
              {productFormMode === 'form' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {/* SKU */}
                    <div className="form-field" data-error={!!fieldErrors.sku || undefined}>
                      <Label htmlFor="sku">{t('pages.importNew.sku')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="sku"
                          value={form.sku}
                          onChange={(e) => {
                            setForm({ ...form, sku: e.target.value });
                            if (fieldErrors.sku) setFieldErrors(prev => { const { sku, ...rest } = prev; return rest; });
                          }}
                          placeholder={t('pages.importNew.skuPlaceholder')}
                          className={`flex-1 ${fieldErrors.sku ? 'border-destructive ring-destructive/30 ring-2' : ''}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title={t('pages.importNew.copySku')}
                          onClick={() => {
                            if (form.productName.trim()) {
                              setForm({ ...form, sku: form.productName.trim() });
                              if (fieldErrors.sku) setFieldErrors(prev => { const { sku, ...rest } = prev; return rest; });
                            }
                          }}
                          disabled={!form.productName.trim()}
                        >
                          <span className="text-xs font-medium">A→</span>
                        </Button>
                      </div>
                      {fieldErrors.sku ? (
                        <p className="text-xs text-destructive mt-1">{fieldErrors.sku}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('pages.importNew.skuHint')}
                        </p>
                      )}
                    </div>

                    {/* IMEI / Serial */}
                    <div className="form-field">
                      <Label htmlFor="imei">{t('pages.importNew.imeiSerial')}</Label>
                      <Input
                        id="imei"
                        value={form.imei}
                        onChange={(e) => setForm({ ...form, imei: e.target.value })}
                        placeholder={t('pages.importNew.imeiPlaceholder')}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('pages.importNew.imeiHint')}
                      </p>
                    </div>

                    {/* Category */}
                    <div className="form-field" data-error={!!fieldErrors.categoryId || undefined}>
                      <Label>{t('pages.importNew.category')}</Label>
                      <div className="flex gap-2">
                        <Select
                          value={form.categoryId}
                          onValueChange={(v) => {
                            setForm({ ...form, categoryId: v });
                            if (fieldErrors.categoryId) setFieldErrors(prev => { const { categoryId, ...rest } = prev; return rest; });
                          }}
                        >
                          <SelectTrigger className={`flex-1 ${fieldErrors.categoryId ? 'border-destructive ring-destructive/30 ring-2' : ''}`}>
                            <SelectValue placeholder={t('pages.importNew.selectCategory')} />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.parent_id ? `— ${cat.name}` : cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setCategoryDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {fieldErrors.categoryId && <p className="text-xs text-destructive mt-1">{fieldErrors.categoryId}</p>}
                    </div>

                    {/* Import Price */}
                    <div className="form-field" data-error={!!fieldErrors.importPrice || undefined}>
                      <Label htmlFor="importPrice">{t('pages.importNew.importPrice')}</Label>
                      <PriceInput
                        id="importPrice"
                        value={form.importPrice}
                        onChange={(val) => {
                          const newImportPrice = val.toString();
                          const numVal = Number(newImportPrice);
                          let autoSalePrice = '';
                          if (numVal > 0) {
                            autoSalePrice = form.imei 
                              ? String(numVal + 2000000) 
                              : String(numVal * 2);
                          }
                          setForm({ ...form, importPrice: newImportPrice, salePrice: autoSalePrice });
                          if (fieldErrors.importPrice) setFieldErrors(prev => { const { importPrice, ...rest } = prev; return rest; });
                        }}
                        placeholder={t('pages.importNew.importPricePlaceholder')}
                        className={fieldErrors.importPrice ? 'border-destructive ring-destructive/30 ring-2' : ''}
                      />
                      {fieldErrors.importPrice && <p className="text-xs text-destructive mt-1">{fieldErrors.importPrice}</p>}
                    </div>

                    {/* Sale Price */}
                    <div className="form-field">
                      <Label htmlFor="salePrice">{t('pages.importNew.salePrice')}</Label>
                      <PriceInput
                        id="salePrice"
                        value={form.salePrice}
                        onChange={(val) => setForm({ ...form, salePrice: val.toString() })}
                        placeholder={form.imei ? t('pages.importNew.salePriceImei') : t('pages.importNew.salePriceNonImei')}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {form.imei ? t('pages.importNew.salePriceHintImei') : t('pages.importNew.salePriceHintNonImei')}{t('pages.importNew.salePriceEditable')}
                      </p>
                    </div>

                    {/* Quantity */}
                    <div className="form-field">
                      <Label htmlFor="quantity">
                        {t('pages.importNew.quantityLabel')} {form.imei ? t('pages.importNew.quantityImei') : '*'}
                      </Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={form.imei ? '1' : form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        placeholder="1"
                        disabled={!!form.imei}
                        className={form.imei ? 'opacity-50' : ''}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {form.imei ? (
                          <>{t('pages.importNew.quantityImeiHint')}</>
                        ) : form.importPrice && form.quantity ? (
                          <>{t('pages.importNew.quantityBatchHint')}
                            <br />{t('pages.importNew.quantitySubtotal', { amount: (Number(form.importPrice) * Number(form.quantity)).toLocaleString('vi-VN') })}
                          </>
                        ) : (
                          <>{t('pages.importNew.quantityBatchHint')}</>
                        )}
                      </p>
                    </div>

                    {/* Note */}
                    <div className="form-field md:col-span-2">
                      <Label htmlFor="note">{t('pages.importNew.note')}</Label>
                      <Textarea
                        id="note"
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        placeholder={t('pages.importNew.notePlaceholder')}
                        rows={1}
                        className="min-h-[2.5rem] resize-y"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('pages.importNew.noteHint')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 flex justify-end">
                    <Button onClick={handleAddToCart} disabled={isCheckingIMEI} className="w-full sm:w-auto" data-tour="import-add-to-cart">
                      {isCheckingIMEI ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="mr-2 h-4 w-4" />
                      )}
                      {isCheckingIMEI ? t('pages.importNew.checkingImei') : t('pages.importNew.addToCart')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="lg:col-span-1" data-tour="import-cart">
            <ImportCart
              items={cart}
              onRemove={handleRemoveFromCart}
              onCheckout={handleCheckout}
            />
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentOpen}
        onClose={() => !isSubmitting && setPaymentOpen(false)}
        totalAmount={totalAmount}
        onConfirm={handlePaymentConfirm}
        isSubmitting={isSubmitting}
      />

      {/* Excel Import Dialog */}
      <ExcelImportDialog
        open={excelImportOpen}
        onOpenChange={setExcelImportOpen}
        categories={categories?.map(c => ({ id: c.id, name: c.name })) || []}
        suppliers={suppliers?.map(s => ({ id: s.id, name: s.name })) || []}
        branches={branches?.map(b => ({ id: b.id, name: b.name })) || []}
        onImportMultiple={handleExcelImportMultiple}
        checkIMEI={async (imei: string) => {
          try {
            return await checkIMEI.mutateAsync(imei);
          } catch {
            return null;
          }
        }}
        batchCheckIMEI={async (imeis: string[]) => {
          try {
            return await batchCheckIMEI.mutateAsync(imeis);
          } catch {
            return new Set();
          }
        }}
      />

      {/* Add Supplier Dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.importNew.addSupplierTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="form-field">
              <Label>{t('pages.importNew.supplierName')}</Label>
              <Input
                value={newSupplierForm.name}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                placeholder={t('pages.importNew.enterSupplierName')}
              />
            </div>
            <div className="form-field">
              <Label>{t('pages.importNew.phone')}</Label>
              <Input
                value={newSupplierForm.phone}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                placeholder={t('pages.importNew.phonePlaceholder')}
              />
            </div>
            <div className="form-field">
              <Label>{t('pages.importNew.address')}</Label>
              <Input
                value={newSupplierForm.address}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, address: e.target.value })}
                placeholder={t('pages.importNew.enterAddress')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>
              {t('pages.importNew.cancel')}
            </Button>
            <Button
              onClick={handleAddNewSupplier}
              disabled={!newSupplierForm.name.trim() || createSupplier.isPending}
            >
              {createSupplier.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('pages.importNew.addNew')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.importNew.addCategoryTitle')}</DialogTitle>
          </DialogHeader>
          <div className="form-field">
            <Label>{t('pages.importNew.categoryName')}</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t('pages.importNew.enterCategoryName')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              {t('pages.importNew.cancel')}
            </Button>
            <Button
              onClick={handleAddNewCategory}
              disabled={!newCategoryName.trim() || createCategory.isPending}
            >
              {createCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('pages.importNew.addNew')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print QR Prompt after payment */}
      <Dialog open={printQRPromptOpen} onOpenChange={(open) => { if (!open) handleSkipPrintQR(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              In tem QR / mã vạch?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Nhập hàng thành công! Bạn có muốn in tem QR cho {printQRProducts.length} sản phẩm vừa nhập không?
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={handleNeverShowQR} className="text-muted-foreground text-xs sm:mr-auto">
              Không hiện nữa
            </Button>
            <Button variant="outline" onClick={handleSkipPrintQR}>
              <X className="h-4 w-4 mr-2" />
              Đóng
            </Button>
            <Button onClick={handlePrintQR}>
              <QrCode className="h-4 w-4 mr-2" />
              In QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode/QR Print Dialog */}
      <BarcodeDialog
        open={barcodeDialogOpen}
        onClose={() => {
          setBarcodeDialogOpen(false);
          setPrintQRProducts([]);
          navigate('/import/history');
        }}
        products={printQRProducts}
      />
      <OnboardingTourOverlay
        steps={IMPORT_NEW_TOUR_STEPS}
        isActive={manualTourActive || (!tourCompleted && !tourDismissed)}
        onComplete={() => { completeTour(); setManualTourActive(false); }}
        onSkip={() => { completeTour(); setTourDismissed(true); setManualTourActive(false); }}
        tourKey="import_new"
      />
    </MainLayout>
  );
}
