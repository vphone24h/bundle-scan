import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImportCart } from '@/components/import/ImportCart';
import { PaymentDialog } from '@/components/import/PaymentDialog';
import { useCategories, useCreateCategory } from '@/hooks/useCategories';
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers';
import { useProducts, useCheckIMEI } from '@/hooks/useProducts';
import { useCreateImportReceipt } from '@/hooks/useImportReceipts';
import { ImportReceiptItem, PaymentSource } from '@/types/warehouse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileSpreadsheet, Download, Plus, ShoppingCart, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function ImportNewPage() {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const createCategory = useCreateCategory();
  const createSupplier = useCreateSupplier();
  const createImportReceipt = useCreateImportReceipt();
  const checkIMEI = useCheckIMEI();

  const [cart, setCart] = useState<ImportReceiptItem[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // Form state
  const [form, setForm] = useState({
    productName: '',
    sku: '',
    imei: '',
    categoryId: '',
    importPrice: '',
    supplierId: '',
    note: '',
  });

  // New supplier/category form
  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', phone: '', address: '' });
  const [newCategoryName, setNewCategoryName] = useState('');

  // Suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.importPrice, 0),
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
      supplierId: product.supplier_id || '',
    });
    setSuggestions([]);
  };

  const handleAddToCart = async () => {
    if (!form.productName || !form.sku || !form.categoryId || !form.importPrice || !form.supplierId) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ các trường bắt buộc',
        variant: 'destructive',
      });
      return;
    }

    // Check IMEI uniqueness
    if (form.imei) {
      const existingProduct = await checkIMEI.mutateAsync(form.imei);
      if (existingProduct) {
        toast({
          title: 'IMEI đã tồn tại',
          description: `Sản phẩm "${existingProduct.name}" đang có IMEI này trong kho`,
          variant: 'destructive',
        });
        return;
      }

      // Also check in cart
      const inCart = cart.find(item => item.imei === form.imei);
      if (inCart) {
        toast({
          title: 'IMEI trùng trong giỏ',
          description: 'IMEI này đã được thêm vào giỏ nhập hàng',
          variant: 'destructive',
        });
        return;
      }
    }

    const category = categories?.find((c) => c.id === form.categoryId);
    const supplier = suppliers?.find((s) => s.id === form.supplierId);

    const newItem: ImportReceiptItem = {
      id: String(Date.now()),
      productName: form.productName,
      sku: form.sku,
      imei: form.imei || undefined,
      categoryId: form.categoryId,
      categoryName: category?.name,
      importPrice: Number(form.importPrice),
      supplierId: form.supplierId,
      supplierName: supplier?.name,
      note: form.note || undefined,
    };

    setCart([...cart, newItem]);
    setForm({
      productName: '',
      sku: '',
      imei: '',
      categoryId: '',
      importPrice: '',
      supplierId: '',
      note: '',
    });
    toast({
      title: 'Đã thêm vào giỏ',
      description: `${newItem.productName} đã được thêm vào giỏ nhập hàng`,
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
    setPaymentOpen(true);
  };

  const handlePaymentConfirm = async (payments: PaymentSource[]) => {
    try {
      // Get the main supplier (first item's supplier)
      const mainSupplierId = cart[0]?.supplierId || null;

      await createImportReceipt.mutateAsync({
        products: cart.map(item => ({
          name: item.productName,
          sku: item.sku,
          imei: item.imei || null,
          category_id: item.categoryId || null,
          import_price: item.importPrice,
          supplier_id: item.supplierId || null,
          note: item.note || null,
        })),
        payments: payments.map(p => ({
          type: p.type as 'cash' | 'bank_card' | 'e_wallet' | 'debt',
          amount: p.amount,
        })),
        supplierId: mainSupplierId,
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
          <div className="flex gap-2">
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
                  <Label htmlFor="importPrice">Giá nhập *</Label>
                  <Input
                    id="importPrice"
                    type="number"
                    value={form.importPrice}
                    onChange={(e) => setForm({ ...form, importPrice: e.target.value })}
                    placeholder="VD: 28000000"
                  />
                </div>

                {/* Supplier */}
                <div className="form-field md:col-span-2">
                  <Label>Nhà cung cấp *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.supplierId}
                      onValueChange={(v) => setForm({ ...form, supplierId: v })}
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
                <Button onClick={handleAddToCart}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Thêm vào giỏ
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
