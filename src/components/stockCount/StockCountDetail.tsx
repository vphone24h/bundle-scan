import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm sản phẩm, SKU, IMEI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredImeiItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isReadOnly ? 5 : 6} className="h-24 text-center text-muted-foreground">
                      Không có sản phẩm IMEI nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredImeiItems.map((item) => (
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
                  filteredNonImeiItems.map((item) => (
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
