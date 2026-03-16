import { ImportReceiptItem } from '@/types/warehouse';
import { formatCurrency } from '@/lib/mockData';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, ShoppingCart, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ImportCartProps {
  items: ImportReceiptItem[];
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export function ImportCart({ items, onRemove, onCheckout }: ImportCartProps) {
  const { t } = useTranslation();
  const total = items.reduce((sum, item) => sum + item.importPrice * item.quantity, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="bg-card border rounded-xl p-4 lg:sticky lg:top-4">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{t('common.importCart')}</h3>
        <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
          {items.length} {t('common.lines')} / {totalQuantity} {t('common.products')}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t('common.noProductsInCart')}
        </p>
      ) : (
        <>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SKU: {item.sku}
                  </p>
                  {item.imei && (
                    <p className="text-xs text-muted-foreground font-mono">
                      IMEI: {item.imei}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-medium text-primary">
                      {formatCurrency(item.importPrice)} x {item.quantity}
                    </p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-muted-foreground">
                        = {formatCurrency(item.importPrice * item.quantity)}
                      </p>
                    )}
                  </div>
                  {item.salePrice && item.salePrice > 0 && (
                    <p className="text-xs text-success mt-0.5">
                      {t('common.salePrice')}: {formatCurrencyWithSpaces(item.salePrice)}đ
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive shrink-0"
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium">{t('common.totalPrice')}</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(total)}
              </span>
            </div>
            <Button className="w-full" size="lg" onClick={onCheckout}>
              {t('common.payAndImport')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
