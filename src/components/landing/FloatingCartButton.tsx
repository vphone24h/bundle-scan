import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useLandingCart } from '@/hooks/useLandingCart';
import { CartCheckoutDialog } from './CartCheckoutDialog';

interface FloatingCartButtonProps {
  tenantId: string;
  primaryColor: string;
  branches: { id: string; name: string }[];
  onNavigateOrderLookup?: () => void;
}

export function FloatingCartButton({ tenantId, primaryColor, branches, onNavigateOrderLookup }: FloatingCartButtonProps) {
  const cart = useLandingCart();
  const [showCheckout, setShowCheckout] = useState(false);

  // Don't hide when dialog is open (so success popup can render after cart is cleared)
  const showButton = cart.totalItems > 0 || showCheckout;

  if (!showButton) return null;

  return (
    <>
      {cart.totalItems > 0 && (
        <button
          onClick={() => setShowCheckout(true)}
          className="fixed bottom-6 right-4 z-50 h-14 w-14 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          aria-label="Giỏ hàng"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full bg-white text-destructive text-xs font-bold shadow border border-destructive/20">
            {cart.totalItems}
          </span>
        </button>
      )}

      <CartCheckoutDialog
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        tenantId={tenantId}
        primaryColor={primaryColor}
        branches={branches}
        onNavigateOrderLookup={onNavigateOrderLookup}
      />
    </>
  );
}
