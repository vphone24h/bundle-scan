import { create } from 'zustand';

// We use a simple React context + state approach (no zustand needed)
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface CartItem {
  productId: string;
  productName: string;
  productImageUrl: string | null;
  price: number;
  variant?: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string, variant?: string) => void;
  updateQuantity: (productId: string, variant: string | undefined, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartState | null>(null);

export function LandingCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId && i.variant === item.variant);
      if (existing) {
        return prev.map(i =>
          i.productId === item.productId && i.variant === item.variant
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string, variant?: string) => {
    setItems(prev => prev.filter(i => !(i.productId === productId && i.variant === variant)));
  }, []);

  const updateQuantity = useCallback((productId: string, variant: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => !(i.productId === productId && i.variant === variant)));
    } else {
      setItems(prev => prev.map(i =>
        i.productId === productId && i.variant === variant ? { ...i, quantity } : i
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
