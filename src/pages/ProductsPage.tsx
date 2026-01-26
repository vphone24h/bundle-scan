import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProductTable } from '@/components/products/ProductTable';
import { BarcodeDialog } from '@/components/products/BarcodeDialog';
import { mockProducts, mockCategories } from '@/lib/mockData';
import { Product } from '@/types/warehouse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Barcode, Filter } from 'lucide-react';

export default function ProductsPage() {
  const [products] = useState<Product[]>(mockProducts);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [productsForBarcode, setProductsForBarcode] = useState<Product[]>([]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.imei && p.imei.includes(searchTerm));
    const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleEdit = (product: Product) => {
    console.log('Edit product:', product);
    // TODO: Open edit dialog
  };

  const handlePrintBarcode = (products: Product[]) => {
    setProductsForBarcode(products);
    setBarcodeOpen(true);
  };

  const handlePrintSelected = () => {
    const selected = products.filter((p) => selectedProducts.includes(p.id));
    handlePrintBarcode(selected);
  };

  // Get unique parent categories
  const parentCategories = mockCategories.filter((c) => !c.parentId);

  return (
    <MainLayout>
      <PageHeader
        title="Quản lý sản phẩm"
        description="Xem, chỉnh sửa và in mã vạch cho sản phẩm"
        actions={
          selectedProducts.length > 0 && (
            <Button onClick={handlePrintSelected}>
              <Barcode className="mr-2 h-4 w-4" />
              In mã vạch ({selectedProducts.length})
            </Button>
          )
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, SKU hoặc IMEI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Danh mục" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Tất cả danh mục</SelectItem>
              {mockCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.parentId ? `— ${cat.name}` : cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="in_stock">Tồn kho</SelectItem>
              <SelectItem value="sold">Đã bán</SelectItem>
              <SelectItem value="returned">Đã trả</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Hiển thị {filteredProducts.length} / {products.length} sản phẩm
          </p>
          {selectedProducts.length > 0 && (
            <p className="text-sm font-medium text-primary">
              Đã chọn {selectedProducts.length} sản phẩm
            </p>
          )}
        </div>

        {/* Table */}
        <ProductTable
          products={filteredProducts}
          selectedProducts={selectedProducts}
          onSelectionChange={setSelectedProducts}
          onEdit={handleEdit}
          onPrintBarcode={handlePrintBarcode}
        />
      </div>

      {/* Barcode Dialog */}
      <BarcodeDialog
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
        products={productsForBarcode}
      />
    </MainLayout>
  );
}
