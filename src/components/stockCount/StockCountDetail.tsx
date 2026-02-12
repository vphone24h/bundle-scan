import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Package,
  Smartphone,
  Search,
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ScanBarcode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BarcodeScannerInput } from '@/components/export/BarcodeScannerInput';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatNumber';
import {
  useStockCountDetail,
  useUpdateStockCountItem,
  useAddSurplusImei,
  useConfirmStockCount,
  StockCount,
  StockCountItem,
} from '@/hooks/useStockCounts';
import { usePermissions } from '@/hooks/usePermissions';

interface StockCountDetailProps {
  stockCountId: string;
  onBack: () => void;
}

export function StockCountDetail({ stockCountId, onBack }: StockCountDetailProps) {
  const { data, isLoading } = useStockCountDetail(stockCountId);
  const updateItemMutation = useUpdateStockCountItem();
  const addSurplusMutation = useAddSurplusImei();
  const confirmMutation = useConfirmStockCount();
  const { data: permissions } = usePermissions();

  const [search, setSearch] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [manualImei, setManualImei] = useState('');
  const [manualProductName, setManualProductName] = useState('');
  const [manualSku, setManualSku] = useState('');
  const [imeiPage, setImeiPage] = useState(1);
  const [nonImeiPage, setNonImeiPage] = useState(1);
  const PAGE_SIZE = 30;

  const stockCount = data?.stockCount;
  const isAdmin = permissions?.role === 'super_admin' || permissions?.role === 'branch_admin';
  const items = data?.items || [];

  // Separate IMEI and non-IMEI items
  const { imeiItems, nonImeiItems, filteredImeiItems, filteredNonImeiItems } = useMemo(() => {
    const imei = items.filter((item) => item.hasImei);
    const nonImei = items.filter((item) => !item.hasImei);

    const searchLower = search.toLowerCase();
    const filteredImei = imei.filter(
      (item) =>
        item.productName.toLowerCase().includes(searchLower) ||
        item.sku.toLowerCase().includes(searchLower) ||
        item.imei?.toLowerCase().includes(searchLower)
    );
    const filteredNonImei = nonImei.filter(
      (item) =>
        item.productName.toLowerCase().includes(searchLower) ||
        item.sku.toLowerCase().includes(searchLower)
    );

    return { imeiItems: imei, nonImeiItems: nonImei, filteredImeiItems: filteredImei, filteredNonImeiItems: filteredNonImei };
  }, [items, search]);

  // Pagination
  const imeiTotalPages = Math.max(1, Math.ceil(filteredImeiItems.length / PAGE_SIZE));
  const nonImeiTotalPages = Math.max(1, Math.ceil(filteredNonImeiItems.length / PAGE_SIZE));
  const safeImeiPage = Math.min(imeiPage, imeiTotalPages);
  const safeNonImeiPage = Math.min(nonImeiPage, nonImeiTotalPages);

  const paginatedImeiItems = useMemo(() => {
    const start = (safeImeiPage - 1) * PAGE_SIZE;
    return filteredImeiItems.slice(start, start + PAGE_SIZE);
  }, [filteredImeiItems, safeImeiPage]);

  const paginatedNonImeiItems = useMemo(() => {
    const start = (safeNonImeiPage - 1) * PAGE_SIZE;
    return filteredNonImeiItems.slice(start, start + PAGE_SIZE);
  }, [filteredNonImeiItems, safeNonImeiPage]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setImeiPage(1);
    setNonImeiPage(1);
  }, []);

  // Summary stats
  const summary = useMemo(() => {
    const missing = items.filter((i) => i.status === 'missing');
    const surplus = items.filter((i) => i.status === 'surplus');
    const ok = items.filter((i) => i.status === 'ok');
    const pending = items.filter((i) => i.status === 'pending');

    return {
      total: items.length,
      missing: missing.length,
      surplus: surplus.length,
      ok: ok.length,
      pending: pending.length,
      totalMissingQty: missing.reduce((sum, i) => sum + Math.abs(i.variance), 0),
      totalSurplusQty: surplus.reduce((sum, i) => sum + i.variance, 0),
    };
  }, [items]);

  const handleToggleImei = (item: StockCountItem, checked: boolean) => {
    updateItemMutation.mutate({
      itemId: item.id,
      isChecked: checked,
      actualQuantity: checked ? 1 : 0,
      stockCountId,
    });
  };

  const handleUpdateQuantity = (item: StockCountItem, quantity: number) => {
    updateItemMutation.mutate({
      itemId: item.id,
      actualQuantity: quantity,
    });
  };

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');

  const handleNoteClick = (item: StockCountItem) => {
    if (isReadOnly) return;
    setEditingNoteId(item.id);
    setEditingNoteValue(item.note || '');
  };

  const handleNoteSave = (itemId: string) => {
    updateItemMutation.mutate({
      itemId,
      note: editingNoteValue,
      stockCountId,
    });
    setEditingNoteId(null);
  };

  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error' | 'notfound'; message: string } | null>(null);

  const handleBarcodeScan = useCallback((barcode: string) => {
    if (stockCount?.status === 'confirmed') return;

    // Parse barcode - formats: IMEI|Name|Price, N:Name:Price, or plain IMEI/SKU
    let scannedImei: string | null = null;
    let scannedSku: string | null = null;
    let scannedName: string | null = null;

    if (barcode.includes('|')) {
      // KiotViet format: IMEI|Name|Price
      const parts = barcode.split('|');
      scannedImei = parts[0]?.trim();
      scannedName = parts[1]?.trim() || null;
    } else if (barcode.startsWith('N:') || barcode.startsWith('n:')) {
      // Non-IMEI QR format: N:Name:Price
      const parts = barcode.split(':');
      scannedName = parts[1]?.trim() || null;
    } else {
      // Plain barcode - could be IMEI or SKU
      scannedImei = barcode.trim();
      scannedSku = barcode.trim();
    }

    // 1. Try to match IMEI items
    if (scannedImei) {
      const imeiMatch = items.find(
        (item) => item.hasImei && item.imei?.toLowerCase() === scannedImei!.toLowerCase()
      );
      if (imeiMatch) {
        if (!imeiMatch.isChecked) {
          handleToggleImei(imeiMatch, true);
          setScanResult({ type: 'success', message: `✓ Đã tích: ${imeiMatch.productName} (${imeiMatch.imei})` });
        } else {
          setScanResult({ type: 'success', message: `⚡ Đã kiểm rồi: ${imeiMatch.productName} (${imeiMatch.imei})` });
        }
        // Navigate to correct page
        const imeiIndex = filteredImeiItems.findIndex(i => i.id === imeiMatch.id);
        if (imeiIndex >= 0) {
          setImeiPage(Math.floor(imeiIndex / PAGE_SIZE) + 1);
        }
        setTimeout(() => setScanResult(null), 3000);
        return;
      }
    }

    // 2. Try to match non-IMEI items by SKU or name
    if (scannedSku || scannedName) {
      const nonImeiMatch = items.find(
        (item) =>
          !item.hasImei &&
          (
            (scannedSku && (item.sku.toLowerCase() === scannedSku.toLowerCase() || item.productId === scannedSku)) ||
            (scannedName && item.productName.toLowerCase() === scannedName.toLowerCase())
          )
      );
      if (nonImeiMatch) {
        const newQty = nonImeiMatch.actualQuantity + 1;
        handleUpdateQuantity(nonImeiMatch, newQty);
        setScanResult({ type: 'success', message: `✓ +1 ${nonImeiMatch.productName} (SL: ${newQty})` });
        // Navigate to correct page
        const nonImeiIndex = filteredNonImeiItems.findIndex(i => i.id === nonImeiMatch.id);
        if (nonImeiIndex >= 0) {
          setNonImeiPage(Math.floor(nonImeiIndex / PAGE_SIZE) + 1);
        }
        setTimeout(() => setScanResult(null), 3000);
        return;
      }
    }

    // 3. Not found
    setScanResult({ type: 'notfound', message: `⚠ Không tìm thấy sản phẩm: ${barcode}` });
    setTimeout(() => setScanResult(null), 4000);
  }, [items, filteredImeiItems, filteredNonImeiItems, stockCount?.status, handleToggleImei, handleUpdateQuantity, PAGE_SIZE]);

  const handleAddSurplusImei = () => {
    if (!manualImei.trim() || !manualProductName.trim() || !manualSku.trim()) return;

    addSurplusMutation.mutate({
      stockCountId,
      imei: manualImei.trim(),
      productName: manualProductName.trim(),
      sku: manualSku.trim(),
    });

    setManualImei('');
    setManualProductName('');
    setManualSku('');
  };

  const handleConfirm = () => {
    confirmMutation.mutate(stockCountId, {
      onSuccess: () => {
        setShowConfirmDialog(false);
      },
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'missing':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'surplus':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ok':
        return 'OK';
      case 'missing':
        return 'Thiếu';
      case 'surplus':
        return 'Dư';
      default:
        return 'Chờ kiểm';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stockCount) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Không tìm thấy phiếu kiểm kho</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          Quay lại
        </Button>
      </div>
    );
  }

  const isReadOnly = stockCount.status === 'confirmed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              Phiếu kiểm kho: {stockCount.code}
              {stockCount.status === 'draft' ? (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  🟡 Nháp
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  🟢 Đã xác nhận
                </Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {stockCount.branchName || 'Tất cả chi nhánh'} •{' '}
              {format(new Date(stockCount.countDate), 'dd/MM/yyyy', { locale: vi })} •{' '}
              NV: {stockCount.createdByName}
            </p>
          </div>
        </div>

        {!isReadOnly && isAdmin && (
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={summary.pending > 0}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Xác nhận kiểm kho
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hệ thống</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockCount.totalSystemQuantity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Thực tế</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockCount.totalActualQuantity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chênh lệch</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                stockCount.totalVariance < 0 && 'text-destructive',
                stockCount.totalVariance > 0 && 'text-emerald-600'
              )}
            >
              {stockCount.totalVariance > 0 ? '+' : ''}
              {stockCount.totalVariance}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 text-xs">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                ✓ {summary.ok}
              </Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700">
                ✗ {summary.missing}
              </Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-700">
                + {summary.surplus}
              </Badge>
              {summary.pending > 0 && (
                <Badge variant="outline">? {summary.pending}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barcode Scanner */}
      {!isReadOnly && (
        <div className="space-y-2">
          <BarcodeScannerInput
            onScan={handleBarcodeScan}
            placeholder="Quét mã QR/Barcode kiểm kho..."
            continuousCamera
          />
          {scanResult && (
            <div className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium animate-in fade-in',
              scanResult.type === 'success' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
              scanResult.type === 'error' && 'bg-destructive/10 text-destructive border border-destructive/20',
              scanResult.type === 'notfound' && 'bg-amber-50 text-amber-700 border border-amber-200',
            )}>
              {scanResult.message}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm sản phẩm, SKU, IMEI..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs for IMEI and Non-IMEI */}
      <Tabs defaultValue="imei" className="space-y-4">
        <TabsList>
          <TabsTrigger value="imei" className="gap-2">
            <Smartphone className="h-4 w-4" />
            Có IMEI ({imeiItems.length})
          </TabsTrigger>
          <TabsTrigger value="nonimei" className="gap-2">
            <Package className="h-4 w-4" />
            Không IMEI ({nonImeiItems.length})
          </TabsTrigger>
        </TabsList>

        {/* IMEI Products Tab */}
        <TabsContent value="imei" className="space-y-4">
          {/* Manual IMEI Input for surplus */}
          {!isReadOnly && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs text-muted-foreground">IMEI</label>
                    <Input
                      placeholder="Nhập IMEI..."
                      value={manualImei}
                      onChange={(e) => setManualImei(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs text-muted-foreground">Tên SP</label>
                    <Input
                      placeholder="Tên sản phẩm..."
                      value={manualProductName}
                      onChange={(e) => setManualProductName(e.target.value)}
                    />
                  </div>
                  <div className="w-[100px]">
                    <label className="text-xs text-muted-foreground">SKU</label>
                    <Input
                      placeholder="SKU..."
                      value={manualSku}
                      onChange={(e) => setManualSku(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleAddSurplusImei}
                    disabled={!manualImei || !manualProductName || !manualSku || addSurplusMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Thêm IMEI dư
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {!isReadOnly && <TableHead className="w-[50px]">Có</TableHead>}
                  <TableHead>IMEI</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-center">Hệ thống</TableHead>
                  <TableHead className="text-center">Thực tế</TableHead>
                  <TableHead className="text-center">Trạng thái</TableHead>
                  <TableHead className="min-w-[120px]">Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredImeiItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isReadOnly ? 6 : 7} className="h-24 text-center text-muted-foreground">
                      Không có sản phẩm IMEI nào
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedImeiItems.map((item) => (
                    <TableRow key={item.id} className={cn(item.status === 'missing' && 'bg-red-50/50')}>
                      {!isReadOnly && (
                        <TableCell>
                          <Checkbox
                            checked={item.isChecked}
                            onCheckedChange={(checked) => handleToggleImei(item, !!checked)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm">{item.imei}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.systemQuantity > 0 ? 'default' : 'secondary'}>
                          {item.systemQuantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.actualQuantity > 0 ? 'default' : 'outline'}>
                          {item.actualQuantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStatusIcon(item.status)}
                          <span className="text-sm">{getStatusLabel(item.status)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingNoteId === item.id ? (
                          <Input
                            autoFocus
                            value={editingNoteValue}
                            onChange={(e) => setEditingNoteValue(e.target.value)}
                            onBlur={() => handleNoteSave(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleNoteSave(item.id);
                              if (e.key === 'Escape') setEditingNoteId(null);
                            }}
                            className="h-8 text-sm"
                            placeholder="Nhập ghi chú..."
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleNoteClick(item)}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer w-full min-h-[32px]"
                            disabled={isReadOnly}
                          >
                            {item.note ? (
                              <span className="text-foreground truncate max-w-[150px]">{item.note}</span>
                            ) : (
                              !isReadOnly && <><MessageSquare className="h-3 w-3" /><span className="text-xs">Ghi chú</span></>
                            )}
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* IMEI Pagination */}
          {filteredImeiItems.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3">
              <p className="text-sm text-muted-foreground">
                Trang {safeImeiPage}/{imeiTotalPages} — {filteredImeiItems.length} sản phẩm
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImeiPage(p => Math.max(1, p - 1))}
                  disabled={safeImeiPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: imeiTotalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={page === safeImeiPage ? 'default' : 'outline'}
                    size="sm"
                    className="w-9"
                    onClick={() => setImeiPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImeiPage(p => Math.min(imeiTotalPages, p + 1))}
                  disabled={safeImeiPage >= imeiTotalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Non-IMEI Products Tab */}
        <TabsContent value="nonimei">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-center">Hệ thống</TableHead>
                  <TableHead className="text-center w-[120px]">Thực tế</TableHead>
                  <TableHead className="text-center">Chênh lệch</TableHead>
                  <TableHead className="text-center">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNonImeiItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Không có sản phẩm nào
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedNonImeiItems.map((item) => (
                    <TableRow key={item.id} className={cn(item.status === 'missing' && 'bg-red-50/50')}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.systemQuantity}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {isReadOnly ? (
                          <Badge>{item.actualQuantity}</Badge>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            value={item.actualQuantity}
                            onChange={(e) => handleUpdateQuantity(item, parseInt(e.target.value) || 0)}
                            className="w-20 text-center mx-auto"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            item.variance < 0 && 'bg-destructive text-destructive-foreground',
                            item.variance > 0 && 'bg-emerald-500 text-white',
                            item.variance === 0 && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {item.variance > 0 ? '+' : ''}
                          {item.variance}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStatusIcon(item.status)}
                          <span className="text-sm">{getStatusLabel(item.status)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Non-IMEI Pagination */}
          {filteredNonImeiItems.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3">
              <p className="text-sm text-muted-foreground">
                Trang {safeNonImeiPage}/{nonImeiTotalPages} — {filteredNonImeiItems.length} sản phẩm
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNonImeiPage(p => Math.max(1, p - 1))}
                  disabled={safeNonImeiPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: nonImeiTotalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={page === safeNonImeiPage ? 'default' : 'outline'}
                    size="sm"
                    className="w-9"
                    onClick={() => setNonImeiPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNonImeiPage(p => Math.min(nonImeiTotalPages, p + 1))}
                  disabled={safeNonImeiPage >= nonImeiTotalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm Info (if confirmed) */}
      {isReadOnly && stockCount.confirmedAt && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <p className="text-sm text-green-800">
              ✅ Xác nhận bởi <strong>{stockCount.confirmedByName}</strong> lúc{' '}
              {format(new Date(stockCount.confirmedAt), "HH:mm 'ngày' dd/MM/yyyy", { locale: vi })}
            </p>
            {(stockCount.adjustmentImportReceiptId || stockCount.adjustmentExportReceiptId) && (
              <p className="text-xs text-green-700 mt-1">
                Đã tạo phiếu điều chỉnh kho
                {stockCount.adjustmentExportReceiptId && ' (Xuất hao hụt)'}
                {stockCount.adjustmentImportReceiptId && ' (Nhập bổ sung)'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận kiểm kho?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Sau khi xác nhận:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Phiếu sẽ bị khóa, không thể sửa đổi</li>
                <li>Tồn kho sẽ được cập nhật theo số thực tế</li>
                {summary.missing > 0 && (
                  <li className="text-destructive">
                    Sinh phiếu xuất điều chỉnh cho {summary.totalMissingQty} sản phẩm thiếu
                  </li>
                )}
                {summary.surplus > 0 && (
                  <li className="text-emerald-600">
                    Sinh phiếu nhập điều chỉnh cho {summary.totalSurplusQty} sản phẩm dư
                  </li>
                )}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
