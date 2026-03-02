import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { CashBookPrintReceipt } from './CashBookPrintReceipt';
import { useCurrentTenant } from '@/hooks/useTenant';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { toVietnamDate } from '@/lib/vietnamTime';
import type { CashBookEntry } from '@/hooks/useCashBook';

interface ExportReceiptItem {
  id: string;
  product_name: string;
  imei: string | null;
  sale_price: number;
  sku: string;
}

interface CashBookDetailDialogProps {
  entry: CashBookEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentSourceLabels: Record<string, string>;
}

export function CashBookDetailDialog({
  entry,
  open,
  onOpenChange,
  paymentSourceLabels,
}: CashBookDetailDialogProps) {
  const { data: tenant } = useCurrentTenant();
  const [items, setItems] = useState<ExportReceiptItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !entry?.reference_id) {
      setItems([]);
      return;
    }

    if (entry.reference_type === 'export_receipt') {
      setLoading(true);
      supabase
        .from('export_receipt_items')
        .select('id, product_name, imei, sale_price, sku')
        .eq('receipt_id', entry.reference_id)
        .then(({ data, error }) => {
          if (!error && data) setItems(data);
          setLoading(false);
        });
    } else if (entry.reference_type === 'import_receipt') {
      // Import receipt - load products via product_imports joined with products
      setLoading(true);
      supabase
        .from('product_imports')
        .select('id, import_price, quantity, products(name, imei, sku)')
        .eq('import_receipt_id', entry.reference_id)
        .then(({ data, error }) => {
          if (!error && data) {
            setItems(data.map(r => ({
              id: r.id,
              product_name: (r.products as any)?.name || 'Sản phẩm',
              imei: (r.products as any)?.imei || null,
              sale_price: r.import_price,
              sku: (r.products as any)?.sku || '',
            })));
          }
          setLoading(false);
        });
    } else if (entry.reference_type === 'export_return_receipt') {
      setLoading(true);
      supabase
        .from('export_returns')
        .select('id, product_name, imei, sku, sale_price, refund_amount')
        .eq('export_receipt_id', entry.reference_id)
        .then(({ data, error }) => {
          if (!error && data) {
            setItems(data.map(r => ({
              id: r.id,
              product_name: r.product_name,
              imei: r.imei,
              sale_price: r.refund_amount || r.sale_price,
              sku: r.sku,
            })));
          }
          setLoading(false);
        });
    } else if (entry.reference_type === 'import_return') {
      setLoading(true);
      supabase
        .from('import_returns')
        .select('id, product_name, imei, sku, import_price, total_refund_amount, import_receipt_id')
        .eq('import_receipt_id', entry.reference_id)
        .then(({ data, error }) => {
          if (!error && data) {
            setItems(data.map(r => ({
              id: r.id,
              product_name: r.product_name,
              imei: r.imei,
              sale_price: r.total_refund_amount || r.import_price,
              sku: r.sku,
            })));
          }
          setLoading(false);
        });
    } else if (entry.reference_type === 'export_return') {
      setLoading(true);
      supabase
        .from('export_returns')
        .select('id, product_name, imei, sku, sale_price, refund_amount')
        .eq('id', entry.reference_id)
        .then(({ data, error }) => {
          if (!error && data) {
            setItems(data.map(r => ({
              id: r.id,
              product_name: r.product_name,
              imei: r.imei,
              sale_price: r.refund_amount || r.sale_price,
              sku: r.sku,
            })));
          }
          setLoading(false);
        });
    } else {
      setItems([]);
    }
  }, [open, entry?.reference_id, entry?.reference_type]);

  if (!entry) return null;

  const supportedRefTypes = ['export_receipt', 'import_receipt', 'export_return_receipt', 'export_return', 'import_return'];
  const hasProducts = supportedRefTypes.includes(entry.reference_type || '') && items.length > 0;
  const productSectionTitle = (entry.reference_type === 'export_return_receipt' || entry.reference_type === 'export_return')
    ? 'Sản phẩm trả hàng'
    : entry.reference_type === 'import_return'
    ? 'Sản phẩm trả NCC'
    : 'Sản phẩm trong phiếu';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              {entry.type === 'income' ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-destructive" />
              )}
              Chi tiết giao dịch
            </DialogTitle>
            <CashBookPrintReceipt
              entry={entry}
              paymentSourceLabel={paymentSourceLabels[entry.payment_source] || entry.payment_source}
              storeName={tenant?.name || undefined}
              branchName={entry.branches?.name || undefined}
            />
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entry Info */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Loại</span>
              <Badge className={cn(
                entry.type === 'expense'
                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                  : 'bg-green-100 text-green-700 border-green-200'
              )}>
                {entry.type === 'expense' ? 'Phiếu chi' : 'Phiếu thu'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Danh mục</span>
              <Badge variant="secondary">{entry.category}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Thời gian</span>
              <span className="text-sm font-medium">
                {format(toVietnamDate(entry.transaction_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Nguồn tiền</span>
              <span className="text-sm font-medium">
                {paymentSourceLabels[entry.payment_source] || entry.payment_source}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Số tiền</span>
              <span className={cn(
                "text-lg font-bold",
                entry.type === 'expense' ? 'text-destructive' : 'text-green-600'
              )}>
                {entry.type === 'expense' ? '-' : '+'}{formatCurrency(Number(entry.amount))}
              </span>
            </div>
          </div>

          {/* Staff & Recipient Info */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            {entry.created_by_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nhân viên thực hiện</span>
                <span className="text-sm font-medium">{entry.created_by_name}</span>
              </div>
            )}
            {entry.recipient_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Người nhận</span>
                <div className="text-right">
                  <span className="text-sm font-medium">{entry.recipient_name}</span>
                  {entry.recipient_phone && (
                    <span className="text-xs text-muted-foreground block">{entry.recipient_phone}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <span className="text-sm font-medium">Mô tả</span>
            <p className="text-sm text-muted-foreground">{entry.description}</p>
          </div>

          {entry.note && (
            <div className="space-y-1">
              <span className="text-sm font-medium">Ghi chú</span>
              <p className="text-sm text-muted-foreground">{entry.note}</p>
            </div>
          )}

          {/* Products List */}
          {supportedRefTypes.includes(entry.reference_type || '') && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{productSectionTitle} ({items.length})</span>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : items.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {items.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="p-3 rounded-lg border bg-card text-sm"
                    >
                      <div className="font-medium text-foreground line-clamp-2">
                        {index + 1}. {item.product_name}
                      </div>
                      {item.imei && (
                        <div className="text-xs text-muted-foreground mt-1">
                          IMEI: <span className="font-mono">{item.imei}</span>
                        </div>
                      )}
                      <div className="text-sm font-medium text-primary mt-1">
                        {formatCurrency(item.sale_price)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">Không có sản phẩm</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
