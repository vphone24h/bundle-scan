// Landing page cart state management
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export interface CartItem {
  itemKey: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  basePrice: number;
  price: number;
  variant?: string;
  selectedPackages?: Array<{ id: string; name: string; price: number }>;
  packagesTotal?: number;
  quantity: number;
}

const CART_STORAGE_KEY = 'landing_cart_items';

function buildCartItemKey(item: {
  productId: string;
  variant?: string;
  selectedPackages?: Array<{ id: string; name: string; price: number }>;
}) {
  const packagesKey = (item.selectedPackages || [])
    .map(pkg => pkg.id)
    .sort()
    .join(',');

  return `${item.productId}::${item.variant || ''}::${packagesKey}`;
}

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is Partial<CartItem> & { productId: string; productName: string; price: number } =>
        !!item && typeof item.productId === 'string' && typeof item.productName === 'string' && typeof item.price === 'number'
      )
      .map((item) => {
        const selectedPackages = Array.isArray(item.selectedPackages) ? item.selectedPackages : [];

        return {
          itemKey: typeof item.itemKey === 'string' && item.itemKey.length > 0
            ? item.itemKey
            : buildCartItemKey({
                productId: item.productId,
                variant: item.variant,
                selectedPackages,
              }),
          productId: item.productId,
          productName: item.productName,
          productImageUrl: item.productImageUrl || null,
          basePrice: typeof item.basePrice === 'number' ? item.basePrice : item.price,
          price: item.price,
          variant: item.variant,
          selectedPackages,
          packagesTotal: typeof item.packagesTotal === 'number'
            ? item.packagesTotal
            : selectedPackages.reduce((sum, pkg) => sum + (typeof pkg.price === 'number' ? pkg.price : 0), 0),
          quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        } satisfies CartItem;
      });
  } catch { return []; }
}

function saveCartToStorage(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity' | 'itemKey'> & { quantity?: number }) => void;
  removeItem: (itemKey: string) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartState | null>(null);

export function LandingCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCartFromStorage);

  useEffect(() => {
    saveCartToStorage(items);
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity' | 'itemKey'> & { quantity?: number }) => {
    setItems(prev => {
      const itemKey = buildCartItemKey(item);
      const existing = prev.find(i => i.itemKey === itemKey);

      if (existing) {
        return prev.map(i =>
          i.itemKey === itemKey
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }

      return [...prev, {
        ...item,
        itemKey,
        selectedPackages: item.selectedPackages || [],
        packagesTotal: item.packagesTotal || 0,
        quantity: item.quantity || 1,
      }];
    });
  }, []);

  const removeItem = useCallback((itemKey: string) => {
    setItems(prev => prev.filter(i => i.itemKey !== itemKey));
  }, []);

  const updateQuantity = useCallback((itemKey: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.itemKey !== itemKey));
    } else {
      setItems(prev => prev.map(i =>
        i.itemKey === itemKey ? { ...i, quantity } : i
      ));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useLandingCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    // Return a no-op cart when outside provider
    return {
      items: [] as CartItem[],
      addItem: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      totalItems: 0,
      totalPrice: 0,
    } as CartState;
  }
  return ctx;
}
