import { FileText } from 'lucide-react';

type Identity = {
  productName?: unknown;
  sku?: unknown;
  imei?: unknown;
};

function normalizeIdentity(data: Record<string, unknown> | null | undefined): Identity {
  if (!data) return {};

  return {
    // Support multiple possible field names
    productName: data.name ?? data.product_name,
    sku: data.sku,
    imei: data.imei,
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
}: {
  recordId?: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  showBeforeAfter: boolean;
}) {
  const oldIdentity = normalizeIdentity(oldData);
  const newIdentity = normalizeIdentity(newData);
  const currentIdentity = hasAnyIdentity(newIdentity) ? newIdentity : oldIdentity;

  // If we have absolutely nothing to show besides recordId, still show the card
  // because it answers “sản phẩm nào”.
  const shouldShow = Boolean(recordId) || hasAnyIdentity(currentIdentity);
  if (!shouldShow) return null;

  return (
    <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
      <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-primary">
        <FileText className="h-4 w-4" />
        Sản phẩm được thao tác
      </h4>

      {recordId && (
        <div className="text-xs text-muted-foreground mb-2">
          ID: <span className="font-mono">{recordId}</span>
        </div>
      )}

      {showBeforeAfter ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
      ) : (
        <div className="space-y-1 text-sm">
          <IdentityRow label="Tên" value={currentIdentity.productName} />
          <IdentityRow label="SKU" value={currentIdentity.sku} mono />
          <IdentityRow label="IMEI" value={currentIdentity.imei} mono />
        </div>
      )}
    </div>
  );
}
