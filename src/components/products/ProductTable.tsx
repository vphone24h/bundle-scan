import React, { useState } from 'react';
import { Product } from '@/types/warehouse';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Barcode, Trash2, Package, Settings2, Printer, Copy, Layers, ArrowDownToLine, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermissions } from '@/hooks/usePermissions';
import { AdjustQuantityDialog } from './AdjustQuantityDialog';
import { DeleteProductDialog } from './DeleteProductDialog';

interface ExtendedProduct extends Product {
  isPrinted?: boolean;
  isTemplateGroup?: boolean;
  isVariantGroup?: boolean;
  variantCount?: number;
  childProducts?: ExtendedProduct[];
  variant1?: string;
  variant2?: string;
  variant3?: string;
  groupId?: string;
}

interface ProductTableProps {
  products: ExtendedProduct[];
  selectedProducts: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (product: ExtendedProduct) => void;
  onPrintBarcode: (products: ExtendedProduct[]) => void;
  onDuplicate?: (product: ExtendedProduct) => void;
  onImportFromTemplate?: (product: ExtendedProduct) => void;
  onDeleteTemplate?: (product: ExtendedProduct) => void;
  /** Lazy-load variants of a group when user expands it (server-side grouping). */
  onLoadVariants?: (product: ExtendedProduct) => Promise<ExtendedProduct[]>;
}

export function ProductTable({
  products,
  selectedProducts,
  onSelectionChange,
  onEdit,
  onPrintBarcode,
  onDuplicate,
  onImportFromTemplate,
  onDeleteTemplate,
  onLoadVariants,
}: ProductTableProps) {
  const isMobile = useIsMobile();
  const { data: permissions } = usePermissions();
  const allSelected = products.length > 0 && selectedProducts.length === products.length;

  // Dialog states
  const [adjustDialog, setAdjustDialog] = useState<{
    open: boolean;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unit: string;
  }>({ open: false, productId: '', productName: '', sku: '', quantity: 0, unit: 'cái' });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    productId: string;
    productName: string;
    sku: string;
    imei: string;
  }>({ open: false, productId: '', productName: '', sku: '', imei: '' });

  // Expand/collapse state for variant groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // Lazy-loaded variants per group id (when childProducts not preloaded)
  const [loadedVariants, setLoadedVariants] = useState<Record<string, ExtendedProduct[]>>({});
  const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (product: ExtendedProduct) => {
    const id = product.id;
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Lazy-load if no childProducts and not yet loaded
    if (
      onLoadVariants &&
      !product.childProducts &&
      !loadedVariants[id] &&
      !loadingGroups.has(id)
    ) {
      setLoadingGroups(prev => new Set(prev).add(id));
      onLoadVariants(product)
        .then(variants => {
          setLoadedVariants(prev => ({ ...prev, [id]: variants }));
        })
        .catch(() => {
          // swallow — caller should toast
        })
        .finally(() => {
          setLoadingGroups(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });
    }
  };

  const getChildren = (product: ExtendedProduct): ExtendedProduct[] | undefined => {
    return product.childProducts ?? loadedVariants[product.id];
  };

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(products.map((p) => p.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedProducts.includes(id)) {
      onSelectionChange(selectedProducts.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedProducts, id]);
    }
  };

  const getStatusBadge = (status: Product['status'], p?: Product) => {
    switch (status) {
      case 'in_stock':
        if (p && !p.imei && p.quantity === 0) {
          return <Badge className="bg-muted text-muted-foreground text-[10px] sm:text-xs">Hết hàng</Badge>;
        }
        return <Badge className="status-in-stock text-[10px] sm:text-xs">Tồn kho</Badge>;
      case 'sold':
        return <Badge className="status-sold text-[10px] sm:text-xs">Đã bán</Badge>;
      case 'returned':
        return <Badge className="status-pending text-[10px] sm:text-xs">Đã trả</Badge>;
      case 'template':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] sm:text-xs">SP mẫu</Badge>;
    }
  };

  const handleAdjustQuantity = (product: Product) => {
    setAdjustDialog({
      open: true,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: product.quantity || 1,
      unit: (product as any).unit || 'cái',
    });
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteDialog({
      open: true,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      imei: product.imei || '',
    });
  };

  // Check if product is IMEI product
  const isIMEIProduct = (product: Product) => !!product.imei;

  // Mobile Card View
  if (isMobile) {
    return (
      <>
        <div className="space-y-2">
          {/* Select All Header */}
          <div className="flex items-center gap-3 p-3 bg-card border rounded-lg" data-tour="product-select-all">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Chọn tất cả"
            />
            <span className="text-sm font-medium text-muted-foreground">
              {selectedProducts.length > 0 ? `Đã chọn ${selectedProducts.length}` : 'Chọn tất cả'}
            </span>
          </div>

          {products.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground bg-card border rounded-lg">
              Không có sản phẩm nào
            </div>
          ) : (
            products.map((product) => {
              const isGroup = !!(product.isVariantGroup || product.isTemplateGroup) && (product.variantCount || 0) > 1;
              const isExpanded = expandedGroups.has(product.id);
              
              return (
                <div key={product.id}>
                  <div
                    className={cn(
                      'bg-card border rounded-lg p-3 space-y-2',
                      selectedProducts.includes(product.id) && 'ring-2 ring-primary/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleOne(product.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {isGroup && (
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(product)}
                                  className="shrink-0 p-0.5 rounded hover:bg-muted"
                                >
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
                              )}
                              <p
                                className={cn("font-medium text-sm break-words", isGroup && "cursor-pointer")}
                                onClick={isGroup ? () => toggleGroup(product) : undefined}
                              >
                                {product.name}
                              </p>
                              {isGroup && (
                                <Badge variant="secondary" className="text-[10px] gap-0.5 shrink-0">
                                  <Layers className="h-2.5 w-2.5" />
                                  {product.variantCount} biến thể
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-tour="product-action-menu">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => onEdit(product)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Chỉnh sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onPrintBarcode([product])}>
                                <Barcode className="mr-2 h-4 w-4" />
                                In mã vạch
                              </DropdownMenuItem>
                              {product.status === 'template' && onDuplicate && (
                                <DropdownMenuItem onClick={() => onDuplicate(product)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Sao chép sản phẩm mẫu
                                </DropdownMenuItem>
                              )}
                              {onImportFromTemplate && (
                                <DropdownMenuItem onClick={() => onImportFromTemplate(product)}>
                                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                                  Nhập hàng từ SP
                                </DropdownMenuItem>
                              )}
                              {product.status === 'template' && onDeleteTemplate && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onDeleteTemplate(product)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Xóa sản phẩm mẫu
                                  </DropdownMenuItem>
                                </>
                              )}
                              
                              {permissions?.canAdjustProductQuantity && !isIMEIProduct(product) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleAdjustQuantity(product)}>
                                    <Settings2 className="mr-2 h-4 w-4" />
                                    Điều chỉnh số lượng
                                  </DropdownMenuItem>
                                </>
                              )}
                              
                              {permissions?.canDeleteIMEIProducts && isIMEIProduct(product) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteProduct(product)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Xóa sản phẩm
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pl-7">
                      {product.imei && (
                        <span className="font-mono">IMEI: {product.imei}</span>
                      )}
                      <span>{product.categoryName || 'Chưa phân loại'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between pl-7">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-3">
                          {permissions?.canViewImportPrice && (
                            <span className="font-semibold text-sm">{formatCurrency(product.importPrice)}</span>
                          )}
                          {product.salePrice && product.salePrice > 0 && (
                            permissions?.canViewSalePrice !== false ? (
                              <span className={cn("text-xs text-success", !permissions?.canViewImportPrice && "font-semibold text-sm text-foreground")}>
                                {permissions?.canViewImportPrice ? 'Giá bán: ' : ''}{formatCurrencyWithSpaces(product.salePrice)}đ
                              </span>
                            ) : (
                              <span className={cn("text-xs text-muted-foreground", !permissions?.canViewImportPrice && "font-semibold text-sm")}>
                                {permissions?.canViewImportPrice ? 'Giá bán: ' : ''}***
                              </span>
                            )
                          )}
                          {getStatusBadge(product.status, product)}
                          {(product as any).isPrinted && (
                            <Badge variant="outline" className="text-[10px] gap-0.5 h-5 border-primary/30 text-primary">
                              <Printer className="h-2.5 w-2.5" />
                              Đã in
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(product.importDate)}
                      </span>
                    </div>
                  </div>

                  {/* Expanded variant children */}
                  {isGroup && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary/20 pl-3">
                      {loadingGroups.has(product.id) && !getChildren(product) && (
                        <div className="text-xs text-muted-foreground py-2 px-2">Đang tải biến thể...</div>
                      )}
                      {getChildren(product)?.map((child) => {
                        const variantLabel = [child.variant1, child.variant2, child.variant3].filter(Boolean).join(' · ');
                        return (
                          <div
                            key={child.id}
                            className="bg-muted/30 border rounded-md p-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium break-words">{variantLabel || child.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{child.sku}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {permissions?.canViewImportPrice && (
                                <span className="text-xs font-medium">{formatCurrency(child.importPrice)}</span>
                              )}
                              {getStatusBadge(child.status, child)}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-popover">
                                  <DropdownMenuItem onClick={() => onEdit(child)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Chỉnh sửa
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onPrintBarcode([child])}>
                                    <Barcode className="mr-2 h-4 w-4" />
                                    In mã vạch
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Dialogs */}
        <AdjustQuantityDialog
          open={adjustDialog.open}
          onOpenChange={(open) => setAdjustDialog(prev => ({ ...prev, open }))}
          productId={adjustDialog.productId}
          productName={adjustDialog.productName}
          sku={adjustDialog.sku}
          currentQuantity={adjustDialog.quantity}
          unit={adjustDialog.unit}
        />

        <DeleteProductDialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
          productId={deleteDialog.productId}
          productName={deleteDialog.productName}
          sku={deleteDialog.sku}
          imei={deleteDialog.imei}
        />
      </>
    );
  }

  // Desktop Table View
  return (
    <>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Chọn tất cả"
                />
              </th>
              <th>Tên sản phẩm</th>
              <th>SKU</th>
              <th className="hidden lg:table-cell">IMEI</th>
              <th className="hidden sm:table-cell">Danh mục</th>
              {permissions?.canViewImportPrice && <th className="text-right">Giá nhập</th>}
              {permissions?.canViewSalePrice !== false && <th className="text-right hidden sm:table-cell">Giá bán</th>}
              <th className="hidden md:table-cell">Ngày nhập</th>
              <th className="hidden lg:table-cell">Nhà cung cấp</th>
              <th>Trạng thái</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const isGroup = !!(product.isVariantGroup || product.isTemplateGroup) && (product.variantCount || 0) > 1;
              const isExpanded = expandedGroups.has(product.id);
              const colCount = 6 + (permissions?.canViewImportPrice ? 1 : 0) + (permissions?.canViewSalePrice !== false ? 1 : 0);
              
              return (
                <React.Fragment key={product.id}>
                  <tr className={cn(isGroup && 'cursor-pointer')} onClick={isGroup ? () => toggleGroup(product.id) : undefined}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleOne(product.id)}
                        aria-label={`Chọn ${product.name}`}
                      />
                    </td>
                    <td className="font-medium min-w-[260px] max-w-[420px]">
                      <div className="flex items-center gap-1.5">
                        {isGroup && (
                          isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="break-words">{product.name}</span>
                        {isGroup && (
                          <Badge variant="secondary" className="text-[10px] gap-0.5 shrink-0">
                            <Layers className="h-2.5 w-2.5" />
                            {product.variantCount} biến thể
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="text-muted-foreground text-xs sm:text-sm">{product.sku}</td>
                    <td className="font-mono text-xs sm:text-sm hidden lg:table-cell">{product.imei || '-'}</td>
                    <td className="hidden sm:table-cell">{product.categoryName}</td>
                    {permissions?.canViewImportPrice && <td className="text-right font-medium text-sm">{formatCurrency(product.importPrice)}</td>}
                    {permissions?.canViewSalePrice !== false && (
                      <td className="text-right font-medium text-sm hidden sm:table-cell">
                        {product.salePrice ? formatCurrencyWithSpaces(product.salePrice) + 'đ' : '-'}
                      </td>
                    )}
                    <td className="hidden md:table-cell">{formatDate(product.importDate)}</td>
                    <td className="hidden lg:table-cell">{product.supplierName}</td>
                    <td>
                      {getStatusBadge(product.status, product)}
                      {(product as any).isPrinted && (
                        <Badge variant="outline" className="ml-1 text-[10px] gap-0.5 h-5 border-primary/30 text-primary">
                          <Printer className="h-2.5 w-2.5" />
                          Đã in
                        </Badge>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => onEdit(product)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onPrintBarcode([product])}>
                            <Barcode className="mr-2 h-4 w-4" />
                            In mã vạch
                          </DropdownMenuItem>
                          {product.status === 'template' && onDuplicate && (
                            <DropdownMenuItem onClick={() => onDuplicate(product)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Sao chép sản phẩm mẫu
                            </DropdownMenuItem>
                          )}
                          {onImportFromTemplate && (
                            <DropdownMenuItem onClick={() => onImportFromTemplate(product)}>
                              <ArrowDownToLine className="mr-2 h-4 w-4" />
                              Nhập hàng từ SP
                            </DropdownMenuItem>
                          )}
                          {product.status === 'template' && onDeleteTemplate && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDeleteTemplate(product)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Xóa sản phẩm mẫu
                              </DropdownMenuItem>
                            </>
                          )}
                          {permissions?.canAdjustProductQuantity && !isIMEIProduct(product) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAdjustQuantity(product)}>
                                <Settings2 className="mr-2 h-4 w-4" />
                                Điều chỉnh số lượng
                              </DropdownMenuItem>
                            </>
                          )}
                          {permissions?.canDeleteIMEIProducts && isIMEIProduct(product) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteProduct(product)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Xóa sản phẩm
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  {/* Expanded variant rows */}
                  {isGroup && isExpanded && product.childProducts?.map((child) => {
                    const variantLabel = [child.variant1, child.variant2, child.variant3].filter(Boolean).join(' · ');
                    return (
                      <tr key={child.id} className="bg-muted/20">
                        <td>
                          <Checkbox
                            checked={selectedProducts.includes(child.id)}
                            onCheckedChange={() => toggleOne(child.id)}
                          />
                        </td>
                        <td className="font-medium min-w-[260px] max-w-[420px] pl-8">
                          <span className="break-words text-sm">{variantLabel || child.name}</span>
                        </td>
                        <td className="text-muted-foreground text-xs sm:text-sm">{child.sku}</td>
                        <td className="font-mono text-xs sm:text-sm hidden lg:table-cell">{child.imei || '-'}</td>
                        <td className="hidden sm:table-cell">{child.categoryName}</td>
                        {permissions?.canViewImportPrice && <td className="text-right font-medium text-sm">{formatCurrency(child.importPrice)}</td>}
                        {permissions?.canViewSalePrice !== false && (
                          <td className="text-right font-medium text-sm hidden sm:table-cell">
                            {child.salePrice ? formatCurrencyWithSpaces(child.salePrice) + 'đ' : '-'}
                          </td>
                        )}
                        <td className="hidden md:table-cell">{formatDate(child.importDate)}</td>
                        <td className="hidden lg:table-cell">{child.supplierName}</td>
                        <td>{getStatusBadge(child.status, child)}</td>
                        <td>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => onEdit(child)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Chỉnh sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onPrintBarcode([child])}>
                                <Barcode className="mr-2 h-4 w-4" />
                                In mã vạch
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Không có sản phẩm nào
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AdjustQuantityDialog
        open={adjustDialog.open}
        onOpenChange={(open) => setAdjustDialog(prev => ({ ...prev, open }))}
        productId={adjustDialog.productId}
        productName={adjustDialog.productName}
        sku={adjustDialog.sku}
        currentQuantity={adjustDialog.quantity}
        unit={adjustDialog.unit}
      />

      <DeleteProductDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        productId={deleteDialog.productId}
        productName={deleteDialog.productName}
        sku={deleteDialog.sku}
        imei={deleteDialog.imei}
      />
    </>
  );
}
