'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { catalogueApi } from '@/lib/api';
import { mapApiProductToCatalog, type CatalogProduct } from '@/lib/data/products';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';

const GUEST_WISHLIST_KEY = 'ah_saved_products_v2';
const LEGACY_WISHLIST_KEY = 'ah_saved_products';

export type WishlistEntry = {
  productId: string;
  variantId?: string | null;
  priceAtSavePesewas?: number;
  addedAt: string;
  product?: CatalogProduct | null;
};

export type WishlistToggleInput = {
  productId: string;
  variantId?: string | null;
  priceAtSavePesewas?: number;
  name?: string;
  product?: CatalogProduct | null;
};

type WishlistContextValue = {
  entries: WishlistEntry[];
  count: number;
  loading: boolean;
  isSaved: (productId: string) => boolean;
  toggleItem: (input: WishlistToggleInput) => Promise<boolean>;
  saveItem: (input: WishlistToggleInput, silent?: boolean) => Promise<void>;
  removeItem: (productId: string, name?: string, silent?: boolean) => Promise<void>;
  refreshWishlist: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue>({
  entries: [],
  count: 0,
  loading: false,
  isSaved: () => false,
  toggleItem: async () => false,
  saveItem: async () => {},
  removeItem: async () => {},
  refreshWishlist: async () => {},
});

function readGuestStorage(): WishlistEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const rawV2 = window.localStorage.getItem(GUEST_WISHLIST_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item.productId === 'string' && item.productId.trim())
          .map((item) => ({
            productId: String(item.productId).trim(),
            variantId: item.variantId ? String(item.variantId) : null,
            priceAtSavePesewas:
              typeof item.priceAtSavePesewas === 'number' ? item.priceAtSavePesewas : undefined,
            addedAt:
              typeof item.addedAt === 'string' && item.addedAt
                ? item.addedAt
                : new Date().toISOString(),
          }));
      }
    }

    // Migrate legacy string[] key ('ah_saved_products') if present
    const rawLegacy = window.localStorage.getItem(LEGACY_WISHLIST_KEY);
    if (rawLegacy) {
      const legacyParsed = JSON.parse(rawLegacy);
      if (Array.isArray(legacyParsed)) {
        const migrated: WishlistEntry[] = Array.from(
          new Set(legacyParsed.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))),
        ).map((productId) => ({
          productId: productId.trim(),
          variantId: null,
          addedAt: new Date().toISOString(),
        }));
        window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(migrated));
        window.localStorage.removeItem(LEGACY_WISHLIST_KEY);
        return migrated;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

function writeGuestStorage(entries: WishlistEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    const serializable = entries.map((e) => ({
      productId: e.productId,
      variantId: e.variantId ?? null,
      priceAtSavePesewas: e.priceAtSavePesewas,
      addedAt: e.addedAt,
    }));
    window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(serializable));
    window.localStorage.removeItem(LEGACY_WISHLIST_KEY);
  } catch {
    // Ignore storage quota errors
  }
}

function clearGuestStorage() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_WISHLIST_KEY);
    window.localStorage.removeItem(LEGACY_WISHLIST_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const lastSyncedUserIdRef = useRef<string | null>(null);

  const isCustomer = Boolean(user && user.role !== 'STAFF');

  const mapServerResponse = useCallback(
    (
      items: Array<{
        productId: string;
        variantId?: string | null;
        priceAtSaveCents?: number;
        addedAt: string;
        product?: Record<string, unknown> | null;
      }>,
    ): WishlistEntry[] =>
      (Array.isArray(items) ? items : []).map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        priceAtSavePesewas: item.priceAtSaveCents,
        addedAt: item.addedAt,
        product:
          item.product && typeof item.product === 'object'
            ? mapApiProductToCatalog(item.product)
            : null,
      })),
    [],
  );

  const hydrateGuestEntries = useCallback(async (rawEntries: WishlistEntry[]) => {
    if (rawEntries.length === 0) {
      setEntries([]);
      return;
    }
    try {
      const published = await catalogueApi.listPublished().catch(() => []);
      const catalogList = Array.isArray(published)
        ? published.map((r) => mapApiProductToCatalog(r as Record<string, unknown>))
        : [];
      const byId = new Map(catalogList.map((p) => [p.id, p]));
      const missingIds = rawEntries
        .map((e) => e.productId)
        .filter((pid) => !byId.has(pid));

      if (missingIds.length > 0) {
        const fetched = await Promise.all(
          missingIds.map((pid) =>
            catalogueApi
              .getProduct(pid)
              .then((res) =>
                res && typeof res === 'object' && 'id' in res
                  ? mapApiProductToCatalog(res as Record<string, unknown>)
                  : null,
              )
              .catch(() => null),
          ),
        );
        for (const p of fetched) {
          if (p) byId.set(p.id, p);
        }
      }

      setEntries(
        rawEntries.map((e) => ({
          ...e,
          product: byId.get(e.productId) ?? e.product ?? null,
        })),
      );
    } catch {
      setEntries(rawEntries);
    }
  }, []);

  const refreshWishlist = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    try {
      if (isCustomer && user?.id) {
        const guestItems = readGuestStorage();
        if (guestItems.length > 0) {
          const merged = await catalogueApi.mergeWishlist(
            guestItems.map((g) => ({
              productId: g.productId,
              variantId: g.variantId ?? null,
              priceAtSaveCents: g.priceAtSavePesewas,
              addedAt: g.addedAt,
            })),
          );
          clearGuestStorage();
          setEntries(mapServerResponse(merged.items));
          if ((merged.mergedNewCount ?? 0) > 0) {
            const c = merged.mergedNewCount ?? 0;
            showToast(
              `Synced ${c} saved ${c === 1 ? 'item' : 'items'} to your account wishlist`,
              'success',
            );
          }
        } else {
          const res = await catalogueApi.getWishlist();
          setEntries(mapServerResponse(res.items));
        }
        lastSyncedUserIdRef.current = user.id;
      } else {
        lastSyncedUserIdRef.current = null;
        const guestItems = readGuestStorage();
        await hydrateGuestEntries(guestItems);
      }
    } catch {
      const guestItems = readGuestStorage();
      await hydrateGuestEntries(guestItems);
    } finally {
      setLoading(false);
    }
  }, [authLoading, hydrateGuestEntries, isCustomer, mapServerResponse, showToast, user?.id]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const savedIdsSet = useMemo(
    () => new Set(entries.map((e) => e.productId)),
    [entries],
  );

  const isSaved = useCallback(
    (productId: string) => savedIdsSet.has(productId),
    [savedIdsSet],
  );

  const saveItem = useCallback(
    async (input: WishlistToggleInput, silent = false) => {
      const newEntry: WishlistEntry = {
        productId: input.productId,
        variantId: input.variantId ?? input.product?.defaultVariantId ?? null,
        priceAtSavePesewas:
          input.priceAtSavePesewas ?? input.product?.pricePesewas ?? undefined,
        addedAt: new Date().toISOString(),
        product: input.product ?? null,
      };

      setEntries((prev) => {
        const filtered = prev.filter((e) => e.productId !== input.productId);
        const next = [newEntry, ...filtered];
        if (!isCustomer) {
          writeGuestStorage(next);
        }
        return next;
      });

      if (!silent) {
        showToast(
          input.name ? `Saved ${input.name} to wishlist` : 'Saved to wishlist',
          'success',
        );
      }

      if (isCustomer) {
        try {
          const res = await catalogueApi.addWishlistItem({
            productId: newEntry.productId,
            variantId: newEntry.variantId,
            priceAtSaveCents: newEntry.priceAtSavePesewas,
            addedAt: newEntry.addedAt,
          });
          setEntries(mapServerResponse(res.items));
        } catch {
          // Keep optimistic entry on transient network error
        }
      }
    },
    [isCustomer, mapServerResponse, showToast],
  );

  const removeItem = useCallback(
    async (productId: string, name?: string, silent = false) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.productId !== productId);
        if (!isCustomer) {
          writeGuestStorage(next);
        }
        return next;
      });

      if (!silent) {
        showToast(
          name ? `Removed ${name} from wishlist` : 'Removed from wishlist',
          'info',
        );
      }

      if (isCustomer) {
        try {
          const res = await catalogueApi.removeWishlistItem(productId);
          setEntries(mapServerResponse(res.items));
        } catch {
          // Ignore transient error
        }
      }
    },
    [isCustomer, mapServerResponse, showToast],
  );

  const toggleItem = useCallback(
    async (input: WishlistToggleInput): Promise<boolean> => {
      const currentlySaved = savedIdsSet.has(input.productId);
      if (currentlySaved) {
        await removeItem(input.productId, input.name);
        return false;
      }
      await saveItem(input);
      return true;
    },
    [removeItem, saveItem, savedIdsSet],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      entries,
      count: entries.length,
      loading,
      isSaved,
      toggleItem,
      saveItem,
      removeItem,
      refreshWishlist,
    }),
    [entries, isSaved, loading, refreshWishlist, removeItem, saveItem, toggleItem],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
