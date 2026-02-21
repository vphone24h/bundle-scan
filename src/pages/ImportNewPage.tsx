import { useState, useMemo, useEffect } from 'react';
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
import { FileSpreadsheet, Download, Plus, ShoppingCart, Loader2, Building2, BookOpen, PlayCircle, Search, Package, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { downloadImportTemplate } from '@/lib/excelTemplates';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';

const IMPORT_NEW_TOUR_STEPS: TourStep[] = [
  {
    title: 'Chào mừng đến trang Nhập hàng! 🎉',
    description: 'Đây là nơi bạn tạo **phiếu nhập hàng** mới. Hãy làm theo từng bước để nhập thử 1 sản phẩm nhé!',
    isInfo: true,
  },
  {
    title: '① Chọn nhà cung cấp',
    description: 'Kéo lên trên, chọn **chi nhánh** và **nhà cung cấp**. Nếu chưa có NCC, nhấn nút **"+"** bên cạnh để tạo mới. Sau đó nhấn "Tiếp" ở đây.',
    targetSelector: '[data-tour="import-receipt-info"]',
    position: 'bottom',
  },
  {
    title: '② Điền thông tin sản phẩm',
    description: 'Nhập: **Tên SP** → **SKU** (bấm A→ để copy tên) → **IMEI** (nếu có) → Chọn **danh mục** → **Giá nhập**. Các ô có dấu * là bắt buộc. Điền xong nhấn "Tiếp".',
    targetSelector: '[data-tour="import-product-form"]',
    position: 'center',
  },
  {
    title: '③ Nhấn "Thêm vào giỏ"',
    description: 'Kéo xuống dưới cùng và nhấn nút màu xanh **"Thêm vào giỏ"** để đưa sản phẩm vào **giỏ nhập hàng**.',
    targetSelector: '[data-tour="import-add-to-cart"]',
    position: 'top',
  },
  {
    title: '④ Thanh toán để hoàn tất',
    description: 'Sau khi thêm sản phẩm, kéo xuống phần **"Giỏ nhập hàng"** → nhấn **"Thanh toán"** để hoàn tất phiếu nhập. Chúc bạn nhập hàng thành công! 🎊',
    targetSelector: '[data-tour="import-cart"]',
    position: 'center',
  },
];

export default function ImportNewPage() {
  const { isCompleted: tourCompleted, completeTour } = useOnboardingTour('import_new');
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

  // Suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.importPrice * item.quantity, 0),
    [cart]
  );

  // Group products by name+SKU for aggregate stock display
  const groupedProducts = useMemo(() => {
    if (!products) return [];
    const groups = new Map<string, { name: string; sku: string; category_id: string | null; import_price: number; sale_price: number | null; totalQty: number }>();
    for (const p of products) {
      if (p.status !== 'in_stock') continue;
      const key = `${p.name}|||${p.sku}`;
      const existing = groups.get(key);
      if (existing) {
        existing.totalQty += p.quantity || 1;
      } else {
        groups.set(key, {
          name: p.name,
          sku: p.sku,
          category_id: p.category_id,
          import_price: p.import_price,
          sale_price: p.sale_price,
          totalQty: p.quantity || 1,
        });
      }
    }
    return Array.from(groups.values());
  }, [products]);

  const handleProductNameChange = (value: string) => {
    setForm({ ...form, productName: value });
    if (value.length >= 3 && groupedProducts.length > 0) {
      const lowerVal = value.toLowerCase();
      const matches = groupedProducts.filter((p) =>
        p.name.toLowerCase().includes(lowerVal) || p.sku.toLowerCase().includes(lowerVal)
      );
      setSuggestions(matches.slice(0, 8));
    } else {
      setSuggestions([]);
    }
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
    if (!form.productName || !form.sku || !form.categoryId || !form.importPrice) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ các trường bắt buộc (Tên, SKU, Danh mục, Giá nhập)',
        variant: 'destructive',
      });
      return;
    }

    // Check IMEI uniqueness
    if (form.imei && form.imei.trim()) {
      // Check in cart first (local)
      const inCart = cart.find(item => item.imei === form.imei.trim());
      if (inCart) {
        toast({
          title: 'IMEI trùng trong giỏ',
          description: `IMEI "${form.imei}" đã được thêm vào giỏ nhập hàng`,
          variant: 'destructive',
        });
        return;
      }

      // Check in database
      try {
        setIsCheckingIMEI(true);
        const existingProduct = await checkIMEI.mutateAsync(form.imei.trim());
        if (existingProduct) {
          const statusText = existingProduct.status === 'in_stock' ? 'tồn kho' : 
                             existingProduct.status === 'sold' ? 'đã bán' : 'đã trả hàng';
          toast({
            title: 'IMEI đã tồn tại trong kho',
            description: `Sản phẩm "${existingProduct.name}" (${existingProduct.sku}) đang có IMEI "${form.imei}" với trạng thái: ${statusText}. Không thể nhập trùng.`,
            variant: 'destructive',
          });
          setIsCheckingIMEI(false);
          return;
        }
      } catch (error: any) {
        console.error('Error checking IMEI:', error);
        toast({
          title: 'Lỗi kiểm tra IMEI',
          description: error.message || 'Không thể kiểm tra IMEI',
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
      title: 'Đã thêm vào giỏ',
      description: `${newItem.productName} x${quantity} đã được thêm vào giỏ nhập hàng`,
    });
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: 'Giỏ trống',
        description: 'Vui lòng thêm sản phẩm vào giỏ trước khi thanh toán',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedSupplierId) {
      toast({
        title: 'Chưa chọn nhà cung cấp',
        description: 'Vui lòng chọn nhà cung cấp cho phiếu nhập',
        variant: 'destructive',
      });
      return;
    }
    setPaymentOpen(true);
  };

  const handlePaymentConfirm = async (payments: PaymentSource[]) => {
    // Prevent double submission
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createImportReceipt.mutateAsync({
        products: cart.map(item => ({
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
      });

      toast({
        title: 'Nhập hàng thành công!',
        description: `Đã nhập ${cart.length} sản phẩm với tổng giá trị ${totalAmount.toLocaleString('vi-VN')} VND`,
      });
      setPaymentOpen(false);
      setCart([]);
      navigate('/import/history');
    } catch (error: any) {
      toast({
        title: 'Lỗi nhập hàng',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportTemplate = () => {
    downloadImportTemplate();
    toast({
      title: 'Tải file mẫu thành công',
      description: 'File Excel mẫu đã được tải xuống',
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
          title: 'Đã tạo nhà cung cấp mới',
          description: `Tự động tạo ${newSupplierNames.length} NCC: ${newSupplierNames.join(', ')}`,
        });
      } catch (error: any) {
        console.error('Error creating suppliers:', error);
        toast({
          title: 'Lỗi tạo NCC',
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
        if (group.supplierName && group.supplierName !== 'Không có NCC') {
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
        title: 'Nhập hàng thành công!',
        description: `Đã tạo ${successCount} phiếu nhập${failCount > 0 ? `, ${failCount} phiếu lỗi` : ''}`,
      });
      navigate('/import/history');
    } else {
      toast({
        title: 'Lỗi nhập hàng',
        description: 'Không thể tạo phiếu nhập. Vui lòng thử lại.',
        variant: 'destructive',
      });
    }
  };

  const handleAddNewSupplier = async () => {
    if (!newSupplierForm.name.trim()) return;
    try {
      // Auto-assign to current selected branch
      await createSupplier.mutateAsync({
        name: newSupplierForm.name.trim(),
        phone: newSupplierForm.phone.trim() || null,
        address: newSupplierForm.address.trim() || null,
        branch_id: selectedBranchId || null,
      });
      toast({ title: 'Đã thêm nhà cung cấp', description: newSupplierForm.name });
      setSupplierDialogOpen(false);
      setNewSupplierForm({ name: '', phone: '', address: '' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory.mutateAsync({ name: newCategoryName.trim() });
      toast({ title: 'Đã thêm danh mục', description: newCategoryName });
      setCategoryDialogOpen(false);
      setNewCategoryName('');
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Tạo phiếu nhập hàng"
        description="Nhập hàng thủ công hoặc từ file Excel"
        helpText="Tạo phiếu nhập mới bằng cách thêm sản phẩm thủ công hoặc import từ Excel. Chọn nhà cung cấp, nhập IMEI/serial cho từng sản phẩm, sau đó thanh toán để hoàn tất phiếu nhập."
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
            {importGuideUrl && (
              <Button 
                variant="default" 
                asChild 
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md animate-pulse hover:animate-none"
              >
                <a href={importGuideUrl} target="_blank" rel="noopener noreferrer">
                  <BookOpen className="mr-1.5 h-4 w-4" />
                  Hướng dẫn
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href="/templates/Bang_ke_thu_mua_iPhone_cu.xlsx" download="Bang_ke_thu_mua_iPhone_cu.xlsx">
                <Download className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Mẫu bảng kê thu mua</span>
                <span className="sm:hidden">Mẫu thu mua</span>
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportTemplate}>
              <Download className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Tải file mẫu</span>
              <span className="sm:hidden">File mẫu</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExcelImportOpen(true)}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Nhập từ Excel</span>
              <span className="sm:hidden">Excel</span>
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
                Thông tin phiếu nhập
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Branch Selection */}
                <div className="form-field">
                  <Label>Chi nhánh nhập hàng *</Label>
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
                        <SelectValue placeholder="Chọn chi nhánh" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name} {branch.is_default && '(Mặc định)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={branches?.find(b => b.id === selectedBranchId)?.name || 'Đang tải...'}
                      disabled
                      className="bg-muted"
                    />
                  )}
                </div>

                {/* Supplier Selection */}
                <div className="form-field">
                  <Label>Nhà cung cấp *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedSupplierId}
                      onValueChange={setSelectedSupplierId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Chọn nhà cung cấp" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {suppliers?.map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setSupplierDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-xl p-4 sm:p-6" data-tour="import-product-form">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="font-semibold">Thông tin sản phẩm</h3>
                {productFormMode === 'form' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProductFormMode('search');
                      setForm({ productName: '', sku: '', imei: '', categoryId: '', importPrice: '', salePrice: '', quantity: '1', note: '' });
                      setSuggestions([]);
                    }}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Tìm SP khác
                  </Button>
                )}
              </div>

              {/* Product Name - always visible */}
              <div className="form-field relative mb-4">
                <Label htmlFor="productName">Tên sản phẩm *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="productName"
                    value={form.productName}
                    onChange={(e) => handleProductNameChange(e.target.value)}
                    placeholder="Nhập tên sản phẩm để tìm hoặc thêm mới"
                    className="pl-9"
                    autoComplete="off"
                    disabled={productFormMode === 'form'}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tìm sản phẩm cũ trong kho hoặc thêm sản phẩm mới.
                </p>

                {/* Search Results Dropdown */}
                {productFormMode === 'search' && form.productName.length >= 3 && (
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
                                  SKU: {s.sku} | Tồn kho: <span className="font-medium text-foreground">{s.totalQty}</span>
                                </p>
                              </div>
                              <Package className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {suggestions.length === 0 && (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        Không tìm thấy sản phẩm nào phù hợp.
                      </div>
                    )}
                    <button
                      onClick={handleAddNewProduct}
                      className="w-full px-4 py-3 text-left hover:bg-muted border-t border-border transition-colors flex items-center gap-2 text-primary font-medium text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm sản phẩm mới{form.productName.trim() ? `: "${form.productName.trim()}"` : ''}
                    </button>
                  </div>
                )}

                {/* Always-visible Add New Product button in search mode */}
                {productFormMode === 'search' && (
                  <Button
                    variant="outline"
                    className="w-full mt-3 border-dashed border-primary/50 text-primary hover:bg-primary/5"
                    onClick={handleAddNewProduct}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm sản phẩm mới
                  </Button>
                )}
              </div>

              {/* Naming Tips - only in form mode */}
              {productFormMode === 'form' && <ProductNamingTip />}

              {/* Full form fields - only visible in form mode */}
              {productFormMode === 'form' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {/* SKU */}
                    <div className="form-field">
                      <Label htmlFor="sku">SKU *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="sku"
                          value={form.sku}
                          onChange={(e) => setForm({ ...form, sku: e.target.value })}
                          placeholder="Mã viết tắt tên sản phẩm"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Copy tên sản phẩm làm SKU"
                          onClick={() => {
                            if (form.productName.trim()) {
                              setForm({ ...form, sku: form.productName.trim() });
                            }
                          }}
                          disabled={!form.productName.trim()}
                        >
                          <span className="text-xs font-medium">A→</span>
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mã viết tắt của tên sản phẩm, để dễ nhớ và tìm kiếm.
                        <br />Bạn copy tên sản phẩm xuống luôn cũng được (bấm nút <strong>A→</strong>)
                      </p>
                    </div>

                    {/* IMEI / Serial */}
                    <div className="form-field">
                      <Label htmlFor="imei">IMEI / Serial (nếu có)</Label>
                      <Input
                        id="imei"
                        value={form.imei}
                        onChange={(e) => setForm({ ...form, imei: e.target.value })}
                        placeholder="Số IMEI / Serial"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Chỉ nhập đối với thiết bị có <strong>IMEI</strong> hoặc <strong>Serial</strong> (điện thoại, laptop, máy ảnh…).
                        <br />Nếu là phụ kiện (cáp, sạc, linh kiện, sản phẩm khác…) → <strong>không</strong> cần nhập.
                      </p>
                    </div>

                    {/* Category */}
                    <div className="form-field">
                      <Label>Danh mục *</Label>
                      <div className="flex gap-2">
                        <Select
                          value={form.categoryId}
                          onValueChange={(v) => setForm({ ...form, categoryId: v })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Chọn danh mục" />
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
                    </div>

                    {/* Import Price */}
                    <div className="form-field">
                      <Label htmlFor="importPrice">Giá nhập (đơn vị) *</Label>
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
                        }}
                        placeholder="VD: 28 000 000"
                      />
                    </div>

                    {/* Sale Price */}
                    <div className="form-field">
                      <Label htmlFor="salePrice">Giá bán (gợi ý)</Label>
                      <PriceInput
                        id="salePrice"
                        value={form.salePrice}
                        onChange={(val) => setForm({ ...form, salePrice: val.toString() })}
                        placeholder={form.imei ? 'Giá nhập + 2 triệu' : 'Giá nhập x2'}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {form.imei ? 'Mặc định: Giá nhập + 2.000.000đ' : 'Mặc định: Giá nhập x2'}. Có thể sửa.
                      </p>
                    </div>

                    {/* Quantity */}
                    <div className="form-field">
                      <Label htmlFor="quantity">
                        Số lượng {form.imei ? '(IMEI = 1)' : '*'}
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
                          <>Thiết bị có <strong>IMEI / Serial</strong> → mặc định 1 (mỗi cái 1 mã riêng).</>
                        ) : form.importPrice && form.quantity ? (
                          <>Phụ kiện <strong>không</strong> có IMEI / Serial → có thể nhập số lượng theo lô.
                            <br />Thành tiền: {(Number(form.importPrice) * Number(form.quantity)).toLocaleString('vi-VN')} VND
                          </>
                        ) : (
                          <>Phụ kiện <strong>không</strong> có IMEI / Serial → có thể nhập số lượng theo lô.</>
                        )}
                      </p>
                    </div>

                    {/* Note */}
                    <div className="form-field md:col-span-2">
                      <Label htmlFor="note">Ghi chú</Label>
                      <Textarea
                        id="note"
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        placeholder="Ghi chú (tuỳ chọn)"
                        rows={1}
                        className="min-h-[2.5rem] resize-y"
                      />
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 flex justify-end">
                    <Button onClick={handleAddToCart} disabled={isCheckingIMEI} className="w-full sm:w-auto" data-tour="import-add-to-cart">
                      {isCheckingIMEI ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="mr-2 h-4 w-4" />
                      )}
                      {isCheckingIMEI ? 'Đang kiểm tra IMEI...' : 'Thêm vào giỏ'}
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
            <DialogTitle>Thêm nhà cung cấp mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="form-field">
              <Label>Tên nhà cung cấp *</Label>
              <Input
                value={newSupplierForm.name}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                placeholder="Nhập tên"
              />
            </div>
            <div className="form-field">
              <Label>Số điện thoại</Label>
              <Input
                value={newSupplierForm.phone}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                placeholder="VD: 0901234567"
              />
            </div>
            <div className="form-field">
              <Label>Địa chỉ</Label>
              <Input
                value={newSupplierForm.address}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, address: e.target.value })}
                placeholder="Nhập địa chỉ"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={handleAddNewSupplier}
              disabled={!newSupplierForm.name.trim() || createSupplier.isPending}
            >
              {createSupplier.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Thêm mới
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm danh mục mới</DialogTitle>
          </DialogHeader>
          <div className="form-field">
            <Label>Tên danh mục *</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nhập tên danh mục"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={handleAddNewCategory}
              disabled={!newCategoryName.trim() || createCategory.isPending}
            >
              {createCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Thêm mới
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
