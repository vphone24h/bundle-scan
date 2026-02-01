import { FileText, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Identity = {
  productName?: unknown;
  sku?: unknown;
  imei?: unknown;
  quantity?: unknown;
  reason?: unknown;
};

function normalizeIdentity(data: Record<string, unknown> | null | undefined): Identity {
  if (!data) return {};

  return {
    productName: data.name ?? data.product_name,
    sku: data.sku,
    imei: data.imei,
    quantity: data.quantity,
    reason: data.reason,
  };
}

function hasAnyIdentity(i: Identity): boolean {
  return Boolean(i.productName ?? i.sku ?? i.imei);
}

function IdentityRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
}) {
  if (value === null || value === undefined || value === '') return null;

  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[60px]">{label}:</span>
      <span className={mono ? 'font-mono text-xs break-all' : 'font-medium break-words'}>
        {String(value)}
      </span>
    </div>
  );
}

export function ProductIdentityCard({
  recordId,
  oldData,
  newData,
  showBeforeAfter,
  actionType,
}: {
  recordId?: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  showBeforeAfter: boolean;
  actionType?: string;
}) {
  const oldIdentity = normalizeIdentity(oldData);
  const newIdentity = normalizeIdentity(newData);
  const baseIdentity = hasAnyIdentity(newIdentity) ? newIdentity : oldIdentity;

  // Fetch product info from DB if we have record_id but no name in the log data
  const shouldFetchProduct = Boolean(recordId) && !baseIdentity.productName;
  
  const { data: fetchedProduct, isLoading } = useQuery({
    queryKey: ['product-for-audit', recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const { data } = await supabase
        .from('products')
        .select('name, sku, imei')
        .eq('id', recordId)
        .maybeSingle();
      return data;
    },
    enabled: shouldFetchProduct,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Merge fetched data with existing identity
  const currentIdentity: Identity = {
    productName: baseIdentity.productName || fetchedProduct?.name,
    sku: baseIdentity.sku || fetchedProduct?.sku,
    imei: baseIdentity.imei || fetchedProduct?.imei,
    quantity: baseIdentity.quantity,
    reason: baseIdentity.reason,
  };

  // For quantity adjustment, calculate difference
  const isQuantityAdjust = actionType === 'ADJUST_QUANTITY';
  const oldQty = Number(oldIdentity.quantity) || 0;
  const newQty = Number(newIdentity.quantity) || 0;
  const qtyDiff = newQty - oldQty;

  const shouldShow = Boolean(recordId) || hasAnyIdentity(currentIdentity);
  if (!shouldShow) return null;

  return (
    <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
      <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-primary">
        <FileText className="h-4 w-4" />
        Sản phẩm được thao tác
      </h4>

      {/* Show loading state when fetching */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Đang tải thông tin sản phẩm...
        </div>
      )}

      {/* Show product name/sku/imei if available */}
      {(currentIdentity.productName || currentIdentity.sku || currentIdentity.imei) && (
        <div className="space-y-1 text-sm mb-3">
          <IdentityRow label="Tên" value={currentIdentity.productName} />
          <IdentityRow label="SKU" value={currentIdentity.sku} mono />
          <IdentityRow label="IMEI" value={currentIdentity.imei} mono />
        </div>
      )}

      {/* Show ID if no name available */}
      {!currentIdentity.productName && !isLoading && recordId && (
        <div className="text-xs text-muted-foreground mb-2">
          ID: <span className="font-mono break-all">{recordId}</span>
          <span className="text-amber-600 dark:text-amber-400 ml-2">(Sản phẩm có thể đã bị xóa)</span>
        </div>
      )}

      {/* Show quantity adjustment details */}
      {isQuantityAdjust && (
        <div className="p-2 rounded bg-muted/40 space-y-2 text-sm">
          <div className="font-medium text-amber-600 dark:text-amber-400">Điều chỉnh số lượng</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-destructive/10 rounded">
              <div className="text-xs text-muted-foreground">Trước</div>
              <div className="font-semibold">{oldQty}</div>
            </div>
            <div className="p-2 bg-primary/10 rounded">
              <div className="text-xs text-muted-foreground">Sau</div>
              <div className="font-semibold">{newQty}</div>
            </div>
            <div className={`p-2 rounded ${qtyDiff >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <div className="text-xs text-muted-foreground">Chênh lệch</div>
              <div className={`font-semibold ${qtyDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {qtyDiff >= 0 ? '+' : ''}{qtyDiff}
              </div>
            </div>
          </div>
          {newIdentity.reason && (
            <div className="text-sm">
              <span className="text-muted-foreground">Lý do: </span>
              <span className="font-medium">{String(newIdentity.reason)}</span>
            </div>
          )}
        </div>
      )}

      {/* Show before/after for name/sku/imei changes */}
      {showBeforeAfter && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-2">
          <div className="text-xs font-medium text-muted-foreground mb-1 col-span-full">Thay đổi định danh:</div>
          <div className="p-2 rounded bg-muted/40">
            <div className="text-xs text-muted-foreground mb-1">Trước</div>
            <div className="space-y-1">
              <IdentityRow label="Tên" value={oldIdentity.productName} />
              <IdentityRow label="SKU" value={oldIdentity.sku} mono />
              <IdentityRow label="IMEI" value={oldIdentity.imei} mono />
            </div>
          </div>
          <div className="p-2 rounded bg-muted/40">
            <div className="text-xs text-muted-foreground mb-1">Sau</div>
            <div className="space-y-1">
              <IdentityRow label="Tên" value={newIdentity.productName} />
              <IdentityRow label="SKU" value={newIdentity.sku} mono />
              <IdentityRow label="IMEI" value={newIdentity.imei} mono />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
