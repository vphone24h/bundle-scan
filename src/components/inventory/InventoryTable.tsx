import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, FileText, Package, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventoryItem } from '@/hooks/useInventory';
import { IMEIDetailDialog } from './IMEIDetailDialog';
import { NonIMEIDetailDialog } from './NonIMEIDetailDialog';
import { cn } from '@/lib/utils';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { usePermissions } from '@/hooks/usePermissions';

interface InventoryTableProps {
  data: InventoryItem[];
  isLoading?: boolean;
}

interface VariantGroup {
  groupId: string;
  groupName: string; // base product name (extracted from first variant)
  branchId: string | null;
  branchName: string | null;
  categoryName: string | null;
  totalStock: number;
  totalImported: number;
  totalSold: number;
  avgImportPrice: number;
  hasImei: boolean;
  variants: InventoryItem[];
}

function extractBaseName(item: InventoryItem): string {
  // Remove variant parts from the product name to get base name
  let name = item.productName;
  if (item.variant1) name = name.replace(item.variant1, '').trim();
  if (item.variant2) name = name.replace(item.variant2, '').trim();
  if (item.variant3) name = name.replace(item.variant3, '').trim();
  return name || item.productName;
}

function getVariantLabel(item: InventoryItem): string {
  const parts: string[] = [];
  if (item.variant1) parts.push(item.variant1);
  if (item.variant2) parts.push(item.variant2);
  if (item.variant3) parts.push(item.variant3);
  return parts.join(' • ') || item.productName;
}

export function InventoryTable({ data, isLoading }: InventoryTableProps) {
  const { t } = useTranslation();
  const { data: permissions } = usePermissions();
  const canViewImportPrice = permissions?.canViewImportPrice ?? false;
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showIMEIDialog, setShowIMEIDialog] = useState(false);
  const [showNonIMEIDialog, setShowNonIMEIDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const handleViewDetail = (item: InventoryItem) => {
    setSelectedItem(item);
    if (item.hasImei) setShowIMEIDialog(true);
    else setShowNonIMEIDialog(true);
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // Process data into grouped and ungrouped items
  const { groups, ungrouped } = useMemo(() => {
    const groupMap = new Map<string, VariantGroup>();
    const ungrouped: InventoryItem[] = [];

    for (const item of data) {
      if (item.groupId) {
        const key = `${item.groupId}|${item.branchId || 'no-branch'}`;
        const existing = groupMap.get(key);
        if (existing) {
          existing.variants.push(item);
          existing.totalStock += item.stock;
          existing.totalImported += item.totalImported;
          existing.totalSold += item.totalSold;
        } else {
          groupMap.set(key, {
            groupId: item.groupId,
            groupName: extractBaseName(item),
            branchId: item.branchId,
            branchName: item.branchName,
            categoryName: item.categoryName,
            totalStock: item.stock,
            totalImported: item.totalImported,
            totalSold: item.totalSold,
            avgImportPrice: item.avgImportPrice,
            hasImei: item.hasImei,
            variants: [item],
          });
        }
      } else {
        ungrouped.push(item);
      }
    }

    // Calculate weighted average import price for groups
    for (const group of groupMap.values()) {
      if (group.totalStock > 0) {
        const totalCost = group.variants.reduce((s, v) => s + v.totalImportCost, 0);
        group.avgImportPrice = totalCost / group.totalStock;
      }
    }

    return { groups: Array.from(groupMap.values()), ungrouped };
  }, [data]);

  const getStockBadgeClass = (stock: number) => {
    if (stock === 0) return 'bg-muted text-muted-foreground';
    if (stock === 1) return 'bg-destructive text-destructive-foreground';
    if (stock <= 2) return 'bg-orange-500 text-white';
    return 'bg-primary text-primary-foreground';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">{t('tours.inventory.noInventoryData')}</h3>
        <p className="text-muted-foreground">{t('tours.inventory.noInventoryDataDesc')}</p>
      </div>
    );
  }

  let rowIndex = 0;

  const renderItemRow = (item: InventoryItem, index: number, isVariantChild = false) => {
    const currentIndex = index;
    return (
      <TableRow key={`${item.productName}-${item.sku}-${item.branchId}`} className={isVariantChild ? 'bg-muted/30' : ''}>
        <TableCell className="text-muted-foreground">{isVariantChild ? '' : currentIndex}</TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            {isVariantChild ? (
              <span className="font-medium text-sm pl-4 line-clamp-2">
                ↳ {getVariantLabel(item)}
              </span>
            ) : (
              <span className="font-medium line-clamp-2">{item.productName}</span>
            )}
            {!isVariantChild && <span className="text-xs text-muted-foreground">SKU: {item.sku}</span>}
            {!isVariantChild && item.categoryName && <Badge variant="outline" className="w-fit text-xs">{item.categoryName}</Badge>}
            {!isVariantChild && <span className="text-xs text-muted-foreground md:hidden">{item.branchName || '-'}</span>}
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">{!isVariantChild ? (item.branchName || <span className="text-muted-foreground">-</span>) : ''}</TableCell>
        <TableCell className="text-center hidden sm:table-cell">
          {item.hasImei ? (
            <Badge variant="secondary" className="gap-1"><Smartphone className="h-3 w-3" />IMEI</Badge>
          ) : (
            <Badge variant="outline">{t('tours.inventory.normalType')}</Badge>
          )}
        </TableCell>
        <TableCell className="text-center hidden lg:table-cell"><Badge variant="outline">{item.totalImported}</Badge></TableCell>
        <TableCell className="text-center hidden lg:table-cell"><Badge variant="secondary">{item.totalSold}</Badge></TableCell>
        <TableCell className="text-center"><Badge className={cn('min-w-[40px]', getStockBadgeClass(item.stock))}>{item.stock}</Badge></TableCell>
        {canViewImportPrice && <TableCell className="text-right hidden md:table-cell font-medium">{formatCurrencyWithSpaces(item.avgImportPrice)}</TableCell>}
        <TableCell className="text-right">
          <Button variant="outline" size="sm" onClick={() => handleViewDetail(item)}
            className="flex-col gap-0.5 h-auto py-1.5 px-2 sm:flex-row sm:gap-2 sm:py-2 sm:px-3 text-xs"
          >
            {item.hasImei ? (
              <><Smartphone className="h-4 w-4" /><span className="text-[10px] sm:text-xs leading-none">IMEI</span></>
            ) : (
              <><FileText className="h-4 w-4" /><span className="text-[10px] sm:text-xs leading-none">{t('tours.inventory.detailBtn')}</span></>
            )}
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  const renderGroupRow = (group: VariantGroup, index: number) => {
    const groupKey = `${group.groupId}|${group.branchId || 'no-branch'}`;
    const isExpanded = expandedGroups.has(groupKey);

    return (
      <>
        <TableRow 
          key={`group-${groupKey}`} 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => toggleGroup(groupKey)}
        >
          <TableCell className="text-muted-foreground">{index}</TableCell>
          <TableCell>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-primary shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <Layers className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold line-clamp-2">{group.groupName}</span>
              </div>
              <div className="flex items-center gap-1.5 pl-10">
                <Badge variant="secondary" className="text-xs">{group.variants.length} biến thể</Badge>
                {group.categoryName && <Badge variant="outline" className="text-xs">{group.categoryName}</Badge>}
              </div>
              <span className="text-xs text-muted-foreground md:hidden pl-10">{group.branchName || '-'}</span>
            </div>
          </TableCell>
          <TableCell className="hidden md:table-cell">{group.branchName || <span className="text-muted-foreground">-</span>}</TableCell>
          <TableCell className="text-center hidden sm:table-cell">
            {group.hasImei ? (
              <Badge variant="secondary" className="gap-1"><Smartphone className="h-3 w-3" />IMEI</Badge>
            ) : (
              <Badge variant="outline">{t('tours.inventory.normalType')}</Badge>
            )}
          </TableCell>
          <TableCell className="text-center hidden lg:table-cell"><Badge variant="outline">{group.totalImported}</Badge></TableCell>
          <TableCell className="text-center hidden lg:table-cell"><Badge variant="secondary">{group.totalSold}</Badge></TableCell>
          <TableCell className="text-center">
            <Badge className={cn('min-w-[40px]', getStockBadgeClass(group.totalStock))}>
              {group.totalStock}
            </Badge>
          </TableCell>
          {canViewImportPrice && <TableCell className="text-right hidden md:table-cell font-medium">{formatCurrencyWithSpaces(group.avgImportPrice)}</TableCell>}
          <TableCell className="text-right">
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={(e) => { e.stopPropagation(); toggleGroup(groupKey); }}>
              {isExpanded ? 'Thu gọn' : 'Xem'}
            </Button>
          </TableCell>
        </TableRow>

        {/* Expanded variant rows */}
        {isExpanded && group.variants.map((variant) => renderItemRow(variant, 0, true))}
      </>
    );
  };

  return (
    <>
      <div className="rounded-lg border bg-card overflow-x-auto" data-tour="inventory-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] whitespace-nowrap">#</TableHead>
              <TableHead className="min-w-[200px]">{t('tours.inventory.productCol')}</TableHead>
              <TableHead className="whitespace-nowrap hidden md:table-cell">{t('tours.inventory.branchCol')}</TableHead>
              <TableHead className="text-center whitespace-nowrap hidden sm:table-cell">{t('tours.inventory.typeCol')}</TableHead>
              <TableHead className="text-center whitespace-nowrap hidden lg:table-cell">{t('tours.inventory.totalImportedCol')}</TableHead>
              <TableHead className="text-center whitespace-nowrap hidden lg:table-cell">{t('tours.inventory.soldCol')}</TableHead>
              <TableHead className="text-center whitespace-nowrap">{t('tours.inventory.stockCol')}</TableHead>
              {canViewImportPrice && <TableHead className="text-right whitespace-nowrap hidden md:table-cell">{t('tours.inventory.avgImportPriceCol')}</TableHead>}
              <TableHead className="text-right whitespace-nowrap">{t('tours.inventory.actionsCol')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Render grouped variant items first */}
            {groups.map((group) => {
              rowIndex++;
              return renderGroupRow(group, rowIndex);
            })}
            {/* Render ungrouped items */}
            {ungrouped.map((item) => {
              rowIndex++;
              return renderItemRow(item, rowIndex);
            })}
          </TableBody>
        </Table>
      </div>

      {selectedItem && <IMEIDetailDialog open={showIMEIDialog} onOpenChange={setShowIMEIDialog} productName={selectedItem.productName} sku={selectedItem.sku} branchId={selectedItem.branchId} />}
      {selectedItem && <NonIMEIDetailDialog open={showNonIMEIDialog} onOpenChange={setShowNonIMEIDialog} productId={selectedItem.productId} productName={selectedItem.productName} sku={selectedItem.sku} totalStock={selectedItem.stock} avgImportPrice={selectedItem.avgImportPrice} branchId={selectedItem.branchId} />}
    </>
  );
}
