import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wrench, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface MatchResult {
  receiptCode: string;
  strategy: string;
  products: { name: string; imei: string | null; price: number }[];
}

interface Summary {
  totalEmptyReceipts: number;
  totalOrphanProducts: number;
  matched: number;
  unmatched: number;
  productsLinked: number;
}

export function RestoreImportReceiptItemsButton() {
  const { data: tenant } = useCurrentTenant();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [matchDetails, setMatchDetails] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const runAnalysis = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    setMatchDetails([]);
    setApplied(false);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('restore-import-receipt-items', {
        body: { tenantId: tenant.id, dryRun: true },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSummary(data.summary);
      setMatchDetails(data.matchDetails ?? []);
    } catch (e: any) {
      setError(e.message || 'Lỗi khi phân tích');
    } finally {
      setLoading(false);
    }
  };

  const applyFix = async () => {
    if (!tenant?.id) return;
    setApplying(true);
    setError(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('restore-import-receipt-items', {
        body: { tenantId: tenant.id, dryRun: false },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSummary(data.summary);
      setApplied(true);
      toast.success(`Đã phục hồi ${data.summary.productsLinked} sản phẩm cho ${data.summary.matched} phiếu nhập`);
      qc.invalidateQueries({ queryKey: ['import-receipts'] });
    } catch (e: any) {
      setError(e.message || 'Lỗi khi áp dụng');
    } finally {
      setApplying(false);
    }
  };

  const strategyLabel = (s: string) => {
    switch (s) {
      case 'exact_single': return 'Khớp chính xác';
      case 'greedy_multi': return 'Khớp nhiều SP';
      case 'cross_supplier_single': return 'Khớp giá (khác NCC)';
      default: return s;
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); runAnalysis(); }}>
        <Wrench className="mr-2 h-4 w-4" />
        Phục hồi SP phiếu nhập
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Phục hồi sản phẩm cho phiếu nhập</DialogTitle>
            <DialogDescription>
              Tìm và gắn lại sản phẩm bị mất liên kết với phiếu nhập hàng
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Đang phân tích dữ liệu...</span>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {summary && !loading && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded bg-muted">
                  <div className="text-muted-foreground">Phiếu nhập trống</div>
                  <div className="text-lg font-bold">{summary.totalEmptyReceipts}</div>
                </div>
                <div className="p-2 rounded bg-muted">
                  <div className="text-muted-foreground">SP mồ côi</div>
                  <div className="text-lg font-bold">{summary.totalOrphanProducts}</div>
                </div>
                <div className="p-2 rounded bg-green-500/10">
                  <div className="text-muted-foreground">Có thể khớp</div>
                  <div className="text-lg font-bold text-green-600">{summary.matched}</div>
                </div>
                <div className="p-2 rounded bg-orange-500/10">
                  <div className="text-muted-foreground">Không khớp</div>
                  <div className="text-lg font-bold text-orange-600">{summary.unmatched}</div>
                </div>
              </div>

              {matchDetails.length > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-medium">Chi tiết khớp:</div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                    {matchDetails.map((m, i) => (
                      <div key={i} className="p-2 rounded bg-muted/50 border">
                        <div className="font-mono text-primary">{m.receiptCode}</div>
                        <div className="text-muted-foreground">
                          {strategyLabel(m.strategy)} • {m.products.length} SP
                        </div>
                        {m.products.map((p, j) => (
                          <div key={j} className="ml-2 truncate">
                            {p.name} {p.imei ? `(${p.imei})` : ''} — {p.price.toLocaleString()}đ
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {applied && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    Đã phục hồi thành công {summary.productsLinked} sản phẩm cho {summary.matched} phiếu nhập!
                  </AlertDescription>
                </Alert>
              )}

              {summary.unmatched > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {summary.unmatched} phiếu không thể tự động khớp do dữ liệu gốc (NCC, ngày nhập) đã bị thay đổi. 
                    Cần file Excel gốc để khôi phục thủ công.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            {summary && summary.matched > 0 && !applied && (
              <Button onClick={applyFix} disabled={applying}>
                {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Áp dụng ({summary.matched} phiếu)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
