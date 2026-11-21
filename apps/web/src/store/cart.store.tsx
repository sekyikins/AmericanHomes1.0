'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const CART_STORAGE_KEY = 'ah_cart_items';

export type CartItem = {
  id: string;
  name: string;
  category: string;
  variant: string;
  pricePesewas: number;
  image: string;
  defectDisclosures?: string | null;
};

type CartContextValue = {
  items: CartItem[];
  bagOpen: boolean;
  setBagOpen: (open: boolean) => void;
  confirmedOrderRef: string | null;
  setConfirmedOrderRef: (ref: string | null) => void;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  setLineQuantity: (id: string, variant: string, nextQty: number) => void;
  removeLine: (id: string, variant: string) => void;
  clearCart: () => void;
  subtotalPesewas: number;
};

const CartContext = createContext<CartContextValue>({
  items: [],
  bagOpen: false,
  setBagOpen: () => {},
  confirmedOrderRef: null,
  setConfirmedOrderRef: () => {},
  addItem: () => {},
  removeItem: () => {},
  setLineQuantity: () => {},
  removeLine: () => {},
  clearCart: () => {},
  subtotalPesewas: 0,
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [confirmedOrderRef, setConfirmedOrderRef] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // Ignore corrupt storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage quota errors
    }
  }, [items, hydrated]);

  const addItem = (item: CartItem) => {
    setItems((prev) => [...prev, item]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const removeLine = (id: string, variant: string) => {
    setItems((prev) => prev.filter((item) => !(item.id === id && item.variant === variant)));
  };

  const setLineQuantity = (id: string, variant: string, nextQty: number) => {
    const qty = Math.max(0, Math.floor(nextQty));
    setItems((prev) => {
      const sample = prev.find((item) => item.id === id && item.variant === variant);
      const others = prev.filter((item) => !(item.id === id && item.variant === variant));
      if (!sample || qty === 0) return others;
      return [...others, ...Array.from({ length: qty }, () => sample)];
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const subtotalPesewas = items.reduce((sum, item) => sum + item.pricePesewas, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        bagOpen,
        setBagOpen,
        confirmedOrderRef,
        setConfirmedOrderRef,
        addItem,
        removeItem,
        setLineQuantity,
        removeLine,
        clearCart,
        subtotalPesewas,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
