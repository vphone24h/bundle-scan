import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Search, Package, Loader2 } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { TablePagination } from '@/components/ui/table-pagination';
import { usePagination } from '@/hooks/usePagination';

interface TenantProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
  tenantName: string;
}

export function TenantProductsDialog({ 
  open, 
  onOpenChange, 
  tenantId, 
  tenantName 
}: TenantProductsDialogProps) {
  const [search, setSearch] = useState('');

  const { data: products, isLoading } = useQuery({
    queryKey: ['tenant-products', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, import_price, quantity, category_id, imei, created_at, status')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  const filteredProducts = products?.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const pagination = usePagination(filteredProducts, { defaultPageSize: 10 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Sản phẩm - {tenantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <SearchInput placeholder="Tìm theo tên, SKU..." value={search} onChange={setSearch} />

          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <Badge variant="outline">
              Tổng: {products?.length || 0} sản phẩm
            </Badge>
            <Badge variant="secondary">
              Tìm thấy: {filteredProducts.length}
            </Badge>
          </div>

          {/* Products Table */}
          <div className="flex-1 overflow-auto border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {products?.length === 0 ? 'Chưa có sản phẩm nào' : 'Không tìm thấy sản phẩm'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Giá nhập</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                    <TableHead>Loại</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedData.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <p className="font-medium line-clamp-1">{product.name}</p>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {product.sku || '-'}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(product.import_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={product.quantity <= 0 ? 'text-destructive' : ''}>
                          {product.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.imei ? 'default' : 'secondary'}>
                          {product.imei ? 'IMEI' : 'Thường'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {filteredProducts.length > 0 && (
            <TablePagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
