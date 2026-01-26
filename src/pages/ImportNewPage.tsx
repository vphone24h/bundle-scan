import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImportCart } from '@/components/import/ImportCart';
import { PaymentDialog } from '@/components/import/PaymentDialog';
import { mockCategories, mockSuppliers, mockProducts } from '@/lib/mockData';
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
import { FileSpreadsheet, Download, Plus, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function ImportNewPage() {
  const navigate = useNavigate();
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
  const [suggestions, setSuggestions] = useState<typeof mockProducts>([]);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.importPrice, 0),
    [cart]
  );

  const handleProductNameChange = (value: string) => {
    setForm({ ...form, productName: value });
    if (value.length >= 1) {
      const matches = mockProducts.filter((p) =>
        p.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(matches.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (product: typeof mockProducts[0]) => {
    setForm({
      ...form,
      productName: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      supplierId: product.supplierId,
    });
    setSuggestions([]);
  };

  const handleAddToCart = () => {
    if (!form.productName || !form.sku || !form.categoryId || !form.importPrice || !form.supplierId) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ các trường bắt buộc',
        variant: 'destructive',
      });
      return;
    }

    const category = mockCategories.find((c) => c.id === form.categoryId);
    const supplier = mockSuppliers.find((s) => s.id === form.supplierId);

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

  const handlePaymentConfirm = (payments: PaymentSource[]) => {
    console.log('Import completed:', { cart, payments, totalAmount });
    toast({
      title: 'Nhập hàng thành công!',
      description: `Đã nhập ${cart.length} sản phẩm với tổng giá trị ${totalAmount.toLocaleString('vi-VN')} VND`,
    });
    setPaymentOpen(false);
    setCart([]);
    navigate('/import/history');
  };

  const handleExportTemplate = () => {
    toast({
      title: 'Tải file mẫu',
      description: 'File Excel mẫu đang được tải xuống...',
    });
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
                        {mockCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.parentId ? `— ${cat.name}` : cat.name}
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
                        {mockSuppliers.map((sup) => (
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
              onClick={() => {
                toast({ title: 'Đã thêm nhà cung cấp', description: newSupplierForm.name });
                setSupplierDialogOpen(false);
                setNewSupplierForm({ name: '', phone: '', address: '' });
              }}
              disabled={!newSupplierForm.name.trim()}
            >
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
              onClick={() => {
                toast({ title: 'Đã thêm danh mục', description: newCategoryName });
                setCategoryDialogOpen(false);
                setNewCategoryName('');
              }}
              disabled={!newCategoryName.trim()}
            >
              Thêm mới
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
