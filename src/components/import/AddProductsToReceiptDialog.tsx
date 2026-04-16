import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PriceInput } from '@/components/ui/price-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCategories } from '@/hooks/useCategories';
import { useAddProductsToReceipt } from '@/hooks/useAddProductsToReceipt';
import { PRODUCT_UNITS, DECIMAL_UNITS } from '@/types/warehouse';
import { formatCurrency } from '@/lib/mockData';
import { Plus, Trash2, Loader2, Package, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AddProductItem {
  id: string;
  name: string;
  sku: string;
  imei: string;
  category_id: string;
  import_price: number;
  sale_price: number;
  quantity: number;
  unit: string;
}

interface Props {
  receiptId: string;
  receiptCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function createEmptyItem(): AddProductItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    sku: '',
    imei: '',
    category_id: '',
    import_price: 0,
    sale_price: 0,
    quantity: 1,
    unit: 'cái',
  };
}

export function AddProductsToReceiptDialog({ receiptId, receiptCode, open, onOpenChange }: Props) {
  const [items, setItems] = useState<AddProductItem[]>([createEmptyItem()]);
  const { data: categories } = useCategories();
  const addProducts = useAddProductsToReceipt();

  // Product suggestions
  const [searchingIdx, setSearchingIdx] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const totalAmount = useMemo(() =>
    items.reduce((sum, item) => sum + item.import_price * item.quantity, 0),
    [items]
  );

  const updateItem = (index: number, field: keyof AddProductItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const handleSearchProduct = async (index: number, query: string) => {
    updateItem(index, 'name', query);
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearchingIdx(index);
    try {
      const { data } = await supabase.rpc('search_product_suggestions', {
        _search: query,
        _limit: 8,
      });
      setSuggestions(data || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (index: number, suggestion: any) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? {
        ...item,
        name: suggestion.name,
        sku: suggestion.sku || '',
        category_id: suggestion.category_id || '',
        import_price: suggestion.import_price || 0,
        sale_price: suggestion.sale_price || 0,
        unit: suggestion.unit || 'cái',
      } : item
    ));
    setShowSuggestions(false);
    setSearchingIdx(null);
  };

  const handleSubmit = async () => {
    const validItems = items.filter(item => item.name.trim());
    if (validItems.length === 0) {
      toast({ title: 'Chưa có sản phẩm', description: 'Vui lòng thêm ít nhất 1 sản phẩm', variant: 'destructive' });
      return;
    }

    for (const item of validItems) {
      if (item.import_price <= 0) {
        toast({ title: 'Thiếu giá nhập', description: `Sản phẩm "${item.name}" chưa có giá nhập`, variant: 'destructive' });
        return;
      }
      if (item.quantity <= 0) {
        toast({ title: 'Số lượng không hợp lệ', description: `Sản phẩm "${item.name}" cần số lượng > 0`, variant: 'destructive' });
        return;
      }
    }

    try {
      const result = await addProducts.mutateAsync({
        receiptId,
        products: validItems.map(item => ({
          name: item.name.trim(),
          sku: item.sku.trim(),
          imei: item.imei.trim() || null,
          category_id: item.category_id || null,
          import_price: item.import_price,
          sale_price: item.sale_price || null,
          quantity: item.imei ? 1 : item.quantity,
          unit: item.unit || null,
        })),
      });

      toast({
        title: 'Đã thêm sản phẩm',
        description: `Thêm ${result.addedCount} SP vào phiếu ${result.code} - Giá trị: ${formatCurrency(result.addedAmount)}`,
      });

      setItems([createEmptyItem()]);
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setItems([createEmptyItem()]);
      setSuggestions([]);
      setShowSuggestions(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Package className="h-5 w-5 text-primary" />
            Thêm sản phẩm vào phiếu {receiptCode}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6 overflow-y-auto">
          <div className="space-y-4 pb-4">
            {items.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-3 sm:p-4 space-y-3 relative bg-card">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">SP {index + 1}</Badge>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Product name with search */}
                <div className="relative">
                  <Label className="text-xs">Tên sản phẩm *</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={item.name}
                      onChange={(e) => handleSearchProduct(index, e.target.value)}
                      onFocus={() => { setSearchingIdx(index); if (suggestions.length > 0) setShowSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder="Tìm hoặc nhập tên sản phẩm..."
                      className="pl-8"
                    />
                  </div>
                  {showSuggestions && searchingIdx === index && suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((s: any, si: number) => (
                        <button
                          key={si}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between items-center"
                          onMouseDown={() => selectSuggestion(index, s)}
                        >
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.sku}</div>
                          </div>
                          {s.import_price > 0 && (
                            <span className="text-xs text-muted-foreground">{formatCurrency(s.import_price)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">SKU</Label>
                    <Input value={item.sku} onChange={(e) => updateItem(index, 'sku', e.target.value)} placeholder="Mã SKU" />
                  </div>
                  <div>
                    <Label className="text-xs">IMEI (nếu có)</Label>
                    <Input value={item.imei} onChange={(e) => updateItem(index, 'imei', e.target.value)} placeholder="Số IMEI" />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Giá nhập *</Label>
                    <PriceInput value={item.import_price} onChange={(v) => updateItem(index, 'import_price', v)} />
                  </div>
                  <div>
                    <Label className="text-xs">Giá bán</Label>
                    <PriceInput value={item.sale_price} onChange={(v) => updateItem(index, 'sale_price', v)} />
                  </div>
                  <div>
                    <Label className="text-xs">Số lượng</Label>
                    <Input
                      type="number"
                      min={DECIMAL_UNITS.includes(item.unit) ? 0.1 : 1}
                      step={DECIMAL_UNITS.includes(item.unit) ? 0.1 : 1}
                      value={item.imei ? 1 : item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      disabled={!!item.imei}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Đơn vị</Label>
                    <Select value={item.unit} onValueChange={(v) => updateItem(index, 'unit', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {PRODUCT_UNITS.map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Danh mục</Label>
                  <Select value={item.category_id || '_none_'} onValueChange={(v) => updateItem(index, 'category_id', v === '_none_' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="_none_">-- Không chọn --</SelectItem>
                      {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Line total */}
                <div className="text-right text-sm font-medium text-primary">
                  Thành tiền: {formatCurrency(item.import_price * (item.imei ? 1 : item.quantity))}
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addItem} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Thêm sản phẩm
            </Button>
          </div>
        </ScrollArea>

        <DialogFooter className="px-4 pb-4 sm:px-6 sm:pb-6 border-t pt-4">
          <div className="flex items-center justify-between w-full gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Tổng thêm: </span>
              <span className="font-bold text-primary text-base">{formatCurrency(totalAmount)}</span>
              <span className="text-muted-foreground ml-2">({items.filter(i => i.name.trim()).length} SP)</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Hủy</Button>
              <Button onClick={handleSubmit} disabled={addProducts.isPending}>
                {addProducts.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận thêm
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
