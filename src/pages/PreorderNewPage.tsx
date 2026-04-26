import { useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Search, Plus, Trash2, ShoppingCart, Save, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCheckProductForSale, useSearchProductsByName } from '@/hooks/useExportReceipts';
import { useBranches } from '@/hooks/useBranches';
import { useCreatePreorder, useReservedImeis, type PreorderItem } from '@/hooks/usePreorders';
import { useUpsertCustomer } from '@/hooks/useCustomers';
import { CustomerSearchCombobox } from '@/components/export/CustomerSearchCombobox';
import { PriceInput } from '@/components/ui/price-input';
import { formatNumber, parseFormattedNumber } from '@/lib/formatNumber';
import { useStaffList } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';

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

export default function PreorderNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: branches } = useBranches();
  const { data: staffList } = useStaffList();
  const { data: reservedImeis } = useReservedImeis();
  const checkProduct = useCheckProductForSale();
  const searchProducts = useSearchProductsByName();
  const createPreorder = useCreatePreorder();
  const upsertCustomer = useUpsertCustomer();

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Items
  const [items, setItems] = useState<PreorderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Preorder info
  const [branchId, setBranchId] = useState<string>('');
  const [salesStaffId, setSalesStaffId] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositSource, setDepositSource] = useState<string>('cash');
  const [note, setNote] = useState('');

  const totalAmount = items.reduce((s, it) => s + (it.sale_price * (it.quantity || 1)), 0);
  const remaining = Math.max(0, totalAmount - depositAmount);

  const handleSearchProduct = async () => {
    const term = searchQuery.trim();
    if (!term) return;

    // Try IMEI first
    const product = await checkProduct.mutateAsync(term);
    if (product) {
      // Check if reserved
      if (product.imei && reservedImeis?.has(product.imei)) {
        toast({ title: 'Sản phẩm đang được giữ chỗ', description: 'IMEI này đã có khách cọc trong phiếu khác', variant: 'destructive' });
        return;
      }
      // Check duplicate
      if (items.some(it => it.imei && it.imei === product.imei)) {
        toast({ title: 'Đã có trong giỏ', variant: 'destructive' });
        return;
      }
      addProductToCart(product);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    // Fallback search by name
    const results = await searchProducts.mutateAsync(term);
    // Filter out reserved IMEIs
    const filtered = results.filter((p: any) => !p.imei || !reservedImeis?.has(p.imei));
    setSearchResults(filtered);
    setShowSearchDropdown(true);
  };

  const addProductToCart = (product: any) => {
    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      imei: product.imei || null,
      category_id: product.category_id,
      sale_price: Number(product.sale_price) || 0,
      quantity: 1,
      unit: product.unit || null,
    }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemPrice = (idx: number, price: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, sale_price: price } : it));
  };

  const updateItemQty = (idx: number, qty: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: qty } : it));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({ title: 'Chưa có sản phẩm', description: 'Vui lòng thêm ít nhất 1 sản phẩm', variant: 'destructive' });
      return;
    }
    if (depositAmount <= 0) {
      toast({ title: 'Chưa nhập tiền cọc', description: 'Số tiền cọc phải lớn hơn 0', variant: 'destructive' });
      return;
    }
    if (!customerName.trim() && !selectedCustomer) {
      toast({ title: 'Thiếu thông tin khách', description: 'Vui lòng nhập tên hoặc chọn khách hàng', variant: 'destructive' });
      return;
    }

    // Đảm bảo có customer_id
    let customerId = selectedCustomer?.id || null;
    if (!customerId && (customerName.trim() || customerPhone.trim())) {
      try {
        const newCustomer = await upsertCustomer.mutateAsync({
          name: customerName.trim() || 'Khách lẻ',
          phone: customerPhone.trim() || '',
          address: customerAddress || '',
          email: customerEmail || '',
        } as any);
        customerId = (newCustomer as any)?.id || null;
      } catch (e) {
        // ignore
      }
    }

    try {
      await createPreorder.mutateAsync({
        customer_id: customerId,
        customer_name: customerName || selectedCustomer?.name,
        branch_id: branchId || null,
        sales_staff_id: salesStaffId || user?.id || null,
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        deposit_payment_source: depositSource,
        note: note.trim() || null,
        items,
      });
      navigate('/preorder/history');
    } catch (e) {
      // toast already shown in hook
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Đặt hàng trước (Cọc)"
        description="Tạo phiếu cọc để giữ chỗ sản phẩm cho khách"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cart */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Sản phẩm khách đặt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Search */}
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    placeholder="Quét/nhập IMEI hoặc tên sản phẩm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchProduct()}
                  />
                  <Button onClick={handleSearchProduct} disabled={checkProduct.isPending || searchProducts.isPending}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (items.some(it => it.imei && it.imei === p.imei)) {
                            toast({ title: 'Đã có trong giỏ', variant: 'destructive' });
                            return;
                          }
                          addProductToCart(p);
                          setSearchQuery('');
                          setShowSearchDropdown(false);
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku} {p.imei && `• IMEI: ${p.imei}`} • {formatNumber(Number(p.sale_price))}đ
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showSearchDropdown && searchResults.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                    Không tìm thấy sản phẩm khả dụng (có thể IMEI đang được giữ chỗ)
                  </div>
                )}
              </div>

              {/* Items table */}
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có sản phẩm. Hãy tìm và thêm sản phẩm khách muốn đặt.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sản phẩm</TableHead>
                        <TableHead>IMEI</TableHead>
                        <TableHead>SL</TableHead>
                        <TableHead>Giá bán</TableHead>
                        <TableHead>Thành tiền</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-medium text-sm">{it.product_name}</div>
                            <div className="text-xs text-muted-foreground">{it.sku}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {it.imei ? <Badge variant="outline">{it.imei}</Badge> : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={it.quantity || 1}
                              onChange={(e) => updateItemQty(idx, Number(e.target.value) || 1)}
                              disabled={!!it.imei}
                              className="w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <PriceInput
                              value={it.sale_price}
                              onChange={(v) => updateItemPrice(idx, v)}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatNumber(it.sale_price * (it.quantity || 1))}đ
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle>Thông tin khách hàng</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerSearchCombobox
                selectedCustomer={selectedCustomer}
                onSelect={setSelectedCustomer}
                onCustomerInfoChange={() => {}}
                customerName={customerName}
                customerPhone={customerPhone}
                customerAddress={customerAddress}
                customerEmail={customerEmail}
                setCustomerName={setCustomerName}
                setCustomerPhone={setCustomerPhone}
                setCustomerAddress={setCustomerAddress}
                setCustomerEmail={setCustomerEmail}
              />
            </CardContent>
          </Card>
        </div>

        {/* Payment / Deposit */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin cọc</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Chi nhánh</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
                  <SelectContent>
                    {(branches || []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nhân viên bán</Label>
                <Select value={salesStaffId} onValueChange={setSalesStaffId}>
                  <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                  <SelectContent>
                    {(staffList || []).map((s: any) => (
                      <SelectItem key={s.user_id} value={s.user_id}>{s.display_name || s.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Tổng tiền máy:</span>
                  <span className="font-semibold">{formatNumber(totalAmount)}đ</span>
                </div>

                <div>
                  <Label>Số tiền cọc <span className="text-destructive">*</span></Label>
                  <PriceInput value={depositAmount} onChange={setDepositAmount} />
                </div>

                <div>
                  <Label>Nguồn tiền nhận cọc</Label>
                  <Select value={depositSource} onValueChange={setDepositSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Tiền mặt</SelectItem>
                      <SelectItem value="bank">Chuyển khoản</SelectItem>
                      <SelectItem value="e_wallet">Ví điện tử</SelectItem>
                      <SelectItem value="debt">Trừ vào công nợ khách</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {depositSource === 'debt'
                      ? 'Sẽ ghi giảm công nợ khách (không vào sổ quỹ)'
                      : 'Sẽ + tiền vào sổ quỹ + tạo công nợ tương ứng'}
                  </p>
                </div>

                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Còn lại khi nhận hàng:</span>
                  <span className="font-semibold text-primary">{formatNumber(remaining)}đ</span>
                </div>
              </div>

              <div>
                <Label>Ghi chú</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (tùy chọn)" />
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-md p-3 text-xs text-blue-900 dark:text-blue-100 flex gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  Khi tạo cọc: ghi sổ quỹ tiền cọc (nếu có nguồn tiền), tạo công nợ tương ứng và giữ chỗ IMEI.
                  Doanh thu/lợi nhuận chỉ được tính khi khách lấy hàng (Hoàn thành đơn).
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={createPreorder.isPending || items.length === 0 || depositAmount <= 0}
              >
                <Save className="h-4 w-4 mr-2" />
                {createPreorder.isPending ? 'Đang lưu...' : 'Tạo phiếu cọc'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
