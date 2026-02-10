import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ArrowRight, Eye, Check, X, Package, ArrowRightLeft, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { usePermissions } from '@/hooks/usePermissions';
import { useAccessibleBranches } from '@/hooks/usePermissions';
import {
  useStockTransferRequests,
  useStockTransferItems,
  useApproveTransfer,
  useRejectTransfer,
  StockTransferRequest,
} from '@/hooks/useStockTransfers';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Chờ duyệt', className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  approved: { label: 'Đã duyệt', className: 'bg-green-500/10 text-green-700 border-green-500/20' },
  rejected: { label: 'Đã từ chối', className: 'bg-red-500/10 text-red-700 border-red-500/20' },
  cancelled: { label: 'Đã hủy', className: 'bg-gray-500/10 text-gray-700 border-gray-500/20' },
};

export default function StockTransferPage() {
  const { data: permissions } = usePermissions();
  const { data: branches } = useAccessibleBranches();
  const { data: requests, isLoading } = useStockTransferRequests();
  const approveTransfer = useApproveTransfer();
  const rejectTransfer = useRejectTransfer();

  const [searchTerm, setSearchTerm] = useState('');
  const [detailRequest, setDetailRequest] = useState<StockTransferRequest | null>(null);
  const [rejectRequest, setRejectRequest] = useState<StockTransferRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { data: detailItems, isLoading: itemsLoading } = useStockTransferItems(detailRequest?.id || null);

  const userBranchId = permissions?.branchId;
  const isSuperAdmin = permissions?.role === 'super_admin';

  // Split into outgoing / incoming
  const outgoingRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter(r => {
      if (isSuperAdmin) return true;
      return r.from_branch_id === userBranchId;
    }).filter(r => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        (r.from_branch as any)?.name?.toLowerCase().includes(s) ||
        (r.to_branch as any)?.name?.toLowerCase().includes(s) ||
        r.note?.toLowerCase().includes(s)
      );
    });
  }, [requests, isSuperAdmin, userBranchId, searchTerm]);

  const incomingRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter(r => {
      if (isSuperAdmin) return true;
      return r.to_branch_id === userBranchId;
    }).filter(r => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        (r.from_branch as any)?.name?.toLowerCase().includes(s) ||
        (r.to_branch as any)?.name?.toLowerCase().includes(s) ||
        r.note?.toLowerCase().includes(s)
      );
    });
  }, [requests, isSuperAdmin, userBranchId, searchTerm]);

  const pendingIncoming = incomingRequests.filter(r => r.status === 'pending').length;

  const handleApprove = (request: StockTransferRequest) => {
    approveTransfer.mutate({ requestId: request.id }, {
      onSuccess: (data) => {
        toast({ title: 'Đã duyệt', description: `Đã chuyển ${data.count} sản phẩm thành công` });
        setDetailRequest(null);
      },
      onError: (err: any) => {
        toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
      },
    });
  };

  const handleReject = () => {
    if (!rejectRequest) return;
    rejectTransfer.mutate({ requestId: rejectRequest.id, reason: rejectReason }, {
      onSuccess: () => {
        toast({ title: 'Đã từ chối', description: 'Phiếu chuyển hàng đã bị từ chối. Sản phẩm giữ nguyên tại kho cũ.' });
        setRejectRequest(null);
        setRejectReason('');
        setDetailRequest(null);
      },
      onError: (err: any) => {
        toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
      },
    });
  };

  const canApprove = (request: StockTransferRequest) => {
    if (request.status !== 'pending') return false;
    if (isSuperAdmin) return true;
    // Branch admin can approve incoming to their branch
    return permissions?.role === 'branch_admin' && request.to_branch_id === userBranchId;
  };

  const renderRequestCard = (request: StockTransferRequest, type: 'outgoing' | 'incoming') => {
    const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
    const isPending = request.status === 'pending';

    return (
      <Card key={request.id} className={cn('transition-colors', isPending && type === 'incoming' && 'border-yellow-500/40 bg-yellow-50/30 dark:bg-yellow-950/10')}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(new Date(request.created_at))}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{(request.from_branch as any)?.name || '?'}</span>
                <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate">{(request.to_branch as any)?.name || '?'}</span>
              </div>
            </div>
          </div>

          {/* Creator info */}
          <div className="text-xs text-muted-foreground">
            Tạo bởi: {request.creator_profile?.display_name || 'N/A'}
            {request.approver_profile && request.status !== 'pending' && (
              <> · {request.status === 'approved' ? 'Duyệt' : 'Từ chối'} bởi: {request.approver_profile.display_name}</>
            )}
          </div>

          {request.note && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{request.note}</p>
          )}

          {request.reject_reason && (
            <p className="text-xs text-destructive bg-destructive/5 p-2 rounded">
              Lý do từ chối: {request.reject_reason}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailRequest(request)}
              className="gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              Chi tiết
            </Button>
            {canApprove(request) && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleApprove(request)}
                  disabled={approveTransfer.isPending}
                  className="gap-1.5 bg-green-600 hover:bg-green-700"
                >
                  {approveTransfer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Chấp nhận
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRejectRequest(request)}
                  disabled={rejectTransfer.isPending}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Từ chối
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Chuyển hàng"
        description="Quản lý phiếu chuyển hàng giữa các chi nhánh"
        helpText="Tạo phiếu chuyển hàng từ chi nhánh này sang chi nhánh khác. Chi nhánh nhận cần xác nhận trước khi hàng được cập nhật tồn kho. Theo dõi trạng thái: chờ duyệt, đã nhận, từ chối."
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* Hướng dẫn */}
        <div className="flex items-start gap-2.5 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            Để chuyển hàng: vào <strong>Lịch sử nhập hàng</strong> → tab <strong>Theo sản phẩm</strong> → tích chọn sản phẩm → bấm nút <strong>Chuyển hàng</strong>.
          </p>
        </div>
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo chi nhánh, ghi chú..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs defaultValue="incoming" className="space-y-4">
          <TabsList>
            <TabsTrigger value="incoming" className="relative">
              Hàng nhận về ({incomingRequests.length})
              {pendingIncoming > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                  {pendingIncoming}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="outgoing">
              Hàng chuyển đi ({outgoingRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incoming" className="space-y-3">
            {incomingRequests.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Chưa có phiếu chuyển hàng nào</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {incomingRequests.map(r => renderRequestCard(r, 'incoming'))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="outgoing" className="space-y-3">
            {outgoingRequests.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Chưa có phiếu chuyển hàng nào</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {outgoingRequests.map(r => renderRequestCard(r, 'outgoing'))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailRequest} onOpenChange={(open) => !open && setDetailRequest(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Chi tiết phiếu chuyển hàng
            </DialogTitle>
            <DialogDescription>
              {(detailRequest?.from_branch as any)?.name} → {(detailRequest?.to_branch as any)?.name}
            </DialogDescription>
          </DialogHeader>

          {detailRequest && (
            <div className="space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Trạng thái</Label>
                  <Badge className={STATUS_CONFIG[detailRequest.status]?.className}>
                    {STATUS_CONFIG[detailRequest.status]?.label}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ngày tạo</Label>
                  <p className="font-medium">{formatDate(new Date(detailRequest.created_at))}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Người tạo</Label>
                  <p className="font-medium">{detailRequest.creator_profile?.display_name || 'N/A'}</p>
                </div>
                {detailRequest.approved_by && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {detailRequest.status === 'approved' ? 'Người duyệt' : 'Người từ chối'}
                    </Label>
                    <p className="font-medium">{detailRequest.approver_profile?.display_name || 'N/A'}</p>
                  </div>
                )}
              </div>

              {detailRequest.note && (
                <div className="p-2 bg-muted/50 rounded text-sm">{detailRequest.note}</div>
              )}

              {detailRequest.reject_reason && (
                <div className="p-2 bg-destructive/5 rounded text-sm text-destructive">
                  Lý do từ chối: {detailRequest.reject_reason}
                </div>
              )}

              {/* Items */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Danh sách sản phẩm
                </Label>
                {itemsLoading ? (
                  <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
                ) : (
                  <div className="border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
                    {(detailItems || []).map((item, idx) => (
                      <div key={item.id} className="p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-sm">{item.product_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground pl-7 space-y-0.5">
                          <div>SKU: {item.sku}</div>
                          {item.imei && <div className="font-mono">IMEI: {item.imei}</div>}
                          {item.supplier_name && (
                            <div>NCC: <span className="text-foreground font-medium">{item.supplier_name}</span></div>
                          )}
                          {item.note && (
                            <div className="italic">Ghi chú: {item.note}</div>
                          )}
                          <div className="flex gap-4 flex-wrap">
                            <span>SL: {item.quantity}</span>
                            <span>Giá nhập: {formatCurrency(item.import_price)}</span>
                            <span className="font-medium text-foreground">
                              Thành tiền: {formatCurrency(item.import_price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total */}
              {detailItems && detailItems.length > 0 && (
                <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <span className="text-sm font-medium">Tổng giá trị ({detailItems.length} SP)</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(detailItems.reduce((s, i) => s + i.import_price * i.quantity, 0))}
                  </span>
                </div>
              )}
            </div>
          )}

          {detailRequest && canApprove(detailRequest) && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="destructive"
                onClick={() => {
                  setRejectRequest(detailRequest);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Từ chối
              </Button>
              <Button
                onClick={() => handleApprove(detailRequest)}
                disabled={approveTransfer.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveTransfer.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Chấp nhận chuyển hàng
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectRequest} onOpenChange={(open) => { if (!open) { setRejectRequest(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Từ chối phiếu chuyển hàng</DialogTitle>
            <DialogDescription>
              Sản phẩm sẽ được giữ nguyên tại chi nhánh gửi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Lý do từ chối (không bắt buộc)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setRejectRequest(null); setRejectReason(''); }}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectTransfer.isPending}
            >
              {rejectTransfer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
