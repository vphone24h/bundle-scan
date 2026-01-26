import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImportCart } from '@/components/import/ImportCart';
import { PaymentDialog } from '@/components/import/PaymentDialog';
import { useCategories, useCreateCategory } from '@/hooks/useCategories';
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers';
import { useProducts, useCheckIMEI } from '@/hooks/useProducts';
import { useCreateImportReceipt } from '@/hooks/useImportReceipts';
import { useBranches } from '@/hooks/useBranches';
import { useUserGuideUrl } from '@/hooks/useAppConfig';
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
import { FileSpreadsheet, Download, Plus, ShoppingCart, Loader2, Building2, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function ImportNewPage() {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const { data: branches } = useBranches();
  const userGuideUrl = useUserGuideUrl();
  const createCategory = useCreateCategory();
  const createSupplier = useCreateSupplier();
  const createImportReceipt = useCreateImportReceipt();
  const checkIMEI = useCheckIMEI();

  // Branch state - default to first branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Set default branch
  useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      const defaultBranch = branches.find(b => b.is_default) || branches[0];
      setSelectedBranchId(defaultBranch.id);
    }
  }, [branches, selectedBranchId]);

  const [cart, setCart] = useState<ImportReceiptItem[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
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

  const handleProductNameChange = (value: string) => {
    setForm({ ...form, productName: value });
    if (value.length >= 1 && products) {
      const matches = products.filter((p) =>
        p.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(matches.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (product: any) => {
    setForm({
      ...form,
      productName: product.name,
      sku: product.sku,
      categoryId: product.category_id || '',
    });
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
          toast({
            title: 'IMEI đã tồn tại trong kho',
            description: `Sản phẩm "${existingProduct.name}" đang có IMEI "${form.imei}" với trạng thái "${existingProduct.status}". Không thể nhập trùng.`,
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

    const newItem: ImportReceiptItem = {
      id: String(Date.now()),
      productName: form.productName,
      sku: form.sku,
      imei: form.imei || undefined,
      categoryId: form.categoryId,
      categoryName: category?.name,
      importPrice: Number(form.importPrice),
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
      quantity: '1',
      note: '',
    });
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
    try {
      await createImportReceipt.mutateAsync({
        products: cart.map(item => ({
          name: item.productName,
          sku: item.sku,
          imei: item.imei || null,
          category_id: item.categoryId || null,
          import_price: item.importPrice,
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
    }
  };

  const handleExportTemplate = () => {
    toast({
      title: 'Tải file mẫu',
      description: 'File Excel mẫu đang được tải xuống...',
    });
  };

  const handleAddNewSupplier = async () => {
    if (!newSupplierForm.name.trim()) return;
    try {
      await createSupplier.mutateAsync({
        name: newSupplierForm.name.trim(),
        phone: newSupplierForm.phone.trim() || null,
        address: newSupplierForm.address.trim() || null,
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
        actions={
          <div className="flex gap-2 flex-wrap">
            {userGuideUrl && (
              <Button variant="secondary" asChild>
                <a href={userGuideUrl} target="_blank" rel="noopener noreferrer">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Hướng dẫn sử dụng
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={handleExportTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Tải file mẫu
            </Button>
            <Button variant="outline">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Nhập từ Excel
            </Button>
          </div>
        }
      />

      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Thông tin phiếu nhập
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Branch Selection */}
                <div className="form-field">
                  <Label>Chi nhánh nhập hàng *</Label>
                  <Select
                    value={selectedBranchId}
                    onValueChange={setSelectedBranchId}
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

            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Thông tin sản phẩm</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Product Name */}
                <div className="form-field md:col-span-2 relative">
                  <Label htmlFor="productName">Tên sản phẩm *</Label>
                  <Input
                    id="productName"
                    value={form.productName}
                    onChange={(e) => handleProductNameChange(e.target.value)}
                    placeholder="Nhập tên sản phẩm"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleSelectSuggestion(s)}
                          className="w-full px-4 py-2 text-left hover:bg-muted text-sm"
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground ml-2">({s.sku})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* SKU */}
                <div className="form-field">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="Mã sản phẩm"
                  />
                </div>

                {/* IMEI */}
                <div className="form-field">
                  <Label htmlFor="imei">IMEI (nếu có)</Label>
                  <Input
                    id="imei"
                    value={form.imei}
                    onChange={(e) => setForm({ ...form, imei: e.target.value })}
                    placeholder="Số IMEI"
                  />
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
                    onChange={(val) => setForm({ ...form, importPrice: val.toString() })}
                    placeholder="VD: 28 000 000"
                  />
                </div>

                {/* Quantity - only show for non-IMEI products */}
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
                  {!form.imei && form.importPrice && form.quantity && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Thành tiền: {(Number(form.importPrice) * Number(form.quantity)).toLocaleString('vi-VN')} VND
                    </p>
                  )}
                </div>

                {/* Note */}
                <div className="form-field md:col-span-2">
                  <Label htmlFor="note">Ghi chú</Label>
                  <Textarea
                    id="note"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Ghi chú (tuỳ chọn)"
                    rows={2}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleAddToCart} disabled={isCheckingIMEI}>
                  {isCheckingIMEI ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="mr-2 h-4 w-4" />
                  )}
                  {isCheckingIMEI ? 'Đang kiểm tra IMEI...' : 'Thêm vào giỏ'}
                </Button>
              </div>
            </div>
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
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
        onClose={() => setPaymentOpen(false)}
        totalAmount={totalAmount}
        onConfirm={handlePaymentConfirm}
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
    </MainLayout>
  );
}
