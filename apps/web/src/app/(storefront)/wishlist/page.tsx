'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Heart,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { BackLink, EmptyState, ProductGridSkeleton } from '@/components/ui';
import { formatGHS } from '@/lib/formatting/currency';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';
import { useCart } from '@/store/cart.store';
import { useWishlist, type WishlistEntry } from '@/store/wishlist.store';

export default function WishlistPage() {
  const { entries, loading, removeItem } = useWishlist();
  const { addItem, setBagOpen } = useCart();
  const { user, setLoginOpen } = useAuth();
  const { showToast } = useToast();

  const isGuest = !user || user.role === 'STAFF';
  const availableEntries = entries.filter((e) => (e.product?.availableCount ?? 0) > 0);

  const handleMoveToBag = async (entry: WishlistEntry) => {
    const p = entry.product;
    if (!p || p.availableCount <= 0) return;
    addItem({
      id: entry.variantId ?? p.defaultVariantId ?? p.id,
      productId: p.id,
      name: p.name,
      category: p.category,
      variant: p.variants[0]?.name ?? 'Standard',
      pricePesewas: p.variants[0]?.pricePesewas ?? p.pricePesewas,
      image: p.image,
      defectDisclosures: p.defectDisclosures ?? null,
    });
    await removeItem(entry.productId, p.name, true);
    showToast(`Moved ${p.name} from wishlist to your bag`, 'success');
  };

  const handleMoveAllAvailableToBag = async () => {
    if (availableEntries.length === 0) return;
    for (const entry of availableEntries) {
      const p = entry.product;
      if (!p) continue;
      addItem({
        id: entry.variantId ?? p.defaultVariantId ?? p.id,
        productId: p.id,
        name: p.name,
        category: p.category,
        variant: p.variants[0]?.name ?? 'Standard',
        pricePesewas: p.variants[0]?.pricePesewas ?? p.pricePesewas,
        image: p.image,
        defectDisclosures: p.defectDisclosures ?? null,
      });
      await removeItem(entry.productId, p.name, true);
    }
    showToast(
      `Moved ${availableEntries.length} ${
        availableEntries.length === 1 ? 'item' : 'items'
      } to your shopping bag`,
      'success',
    );
    setBagOpen(true);
  };

  return (
    <main className="page-shell">
      <BackLink href="/shop" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to shop</span>
      </BackLink>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 12,
        }}
      >
        <div>
          <div className="eyebrow">Your wishlist</div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,48px)', margin: '8px 0 6px' }}>
            Saved items ({entries.length})
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 15, margin: 0, maxWidth: 580 }}>
            Track real-time warehouse availability, price changes, and move your saved items into
            your bag or reserve them for collection in Tema.
          </p>
        </div>

        {availableEntries.length > 1 && (
          <button
            type="button"
            className="button primary"
            onClick={() => void handleMoveAllAvailableToBag()}
          >
            <ShoppingBag size={15} />
            <span>Move all available to bag ({availableEntries.length})</span>
          </button>
        )}
      </div>

      {isGuest && entries.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: '14px 18px',
            background: '#f3f7f5',
            border: '1px solid #cce0d4',
            borderRadius: 4,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={18} color="var(--green)" fill="var(--green)" />
            <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>
              <strong>Saved in this browser session.</strong> Sign in to automatically merge and
              sync your wishlist across all your devices.
            </span>
          </div>
          <button
            type="button"
            className="button"
            style={{ background: '#fff', minHeight: 36 }}
            onClick={() => setLoginOpen(true)}
          >
            <User size={14} />
            <span>Sign in to sync</span>
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 28 }}>
          <ProductGridSkeleton count={3} className="products" />
        </div>
      ) : entries.length === 0 ? (
        <div style={{ marginTop: 32 }}>
          <EmptyState
            title="Your wishlist is empty"
            description="Tap the heart icon on any product in the shop to save it here and track its availability."
            action={
              <Link href="/shop" className="button primary">
                <span>Browse available products</span>
                <ArrowRight size={15} />
              </Link>
            }
          />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
            marginTop: 28,
          }}
        >
          {entries.map((entry) => {
            const p = entry.product;
            const availableCount = p?.availableCount ?? 0;
            const isOutOfStock = !p || availableCount <= 0;
            const isLowStock = availableCount > 0 && availableCount <= 3;
            const currentPricePesewas = p?.pricePesewas ?? entry.priceAtSavePesewas ?? 0;
            const priceDropPesewas =
              entry.priceAtSavePesewas &&
              currentPricePesewas > 0 &&
              entry.priceAtSavePesewas > currentPricePesewas
                ? entry.priceAtSavePesewas - currentPricePesewas
                : 0;

            return (
              <article
                key={entry.productId}
                className="product"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div className="product-media-wrap">
                    {priceDropPesewas > 0 ? (
                      <span
                        className="badge"
                        style={{
                          background: 'var(--green)',
                          color: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Sparkles size={11} />
                        Price dropped by {formatGHS(priceDropPesewas)}
                      </span>
                    ) : isLowStock ? (
                      <span className="badge" style={{ background: '#fef0c7', color: '#93370d' }}>
                        Only {availableCount} left
                      </span>
                    ) : isOutOfStock ? (
                      <span className="badge" style={{ background: '#f2f4f7', color: '#475467' }}>
                        Out of stock
                      </span>
                    ) : null}

                    <button
                      type="button"
                      className="wishlist-pill"
                      aria-label={`Remove ${p?.name ?? 'item'} from wishlist`}
                      style={{ color: '#b42318', borderColor: '#f3c6c3' }}
                      onClick={() => void removeItem(entry.productId, p?.name)}
                    >
                      <Trash2 size={14} />
                    </button>

                    <Link href={`/shop/${entry.productId}`} className="product-image-link">
                      <div
                        className="product-image"
                        style={{
                          backgroundImage: `url('${p?.image ?? '/images/sofa.avif'}')`,
                          opacity: isOutOfStock ? 0.6 : 1,
                        }}
                      />
                    </Link>
                  </div>

                  <div className="product-body">
                    <p>
                      {p?.category ?? 'Home Goods'}
                      {p?.condition ? ` · ${p.condition.split('·')[0].trim()}` : ''}
                    </p>
                    <Link href={`/shop/${entry.productId}`} className="product-body-link">
                      <h3>{p?.name ?? 'Saved product'}</h3>
                    </Link>
                    <div className="product-price-row">
                      <strong>{formatGHS(currentPricePesewas)}</strong>
                      {priceDropPesewas > 0 && entry.priceAtSavePesewas && (
                        <span className="price-strike">{formatGHS(entry.priceAtSavePesewas)}</span>
                      )}
                    </div>

                    <div
                      className="product-stock"
                      style={{
                        color: isOutOfStock
                          ? 'var(--muted)'
                          : isLowStock
                            ? '#b54708'
                            : 'var(--green)',
                      }}
                    >
                      {isOutOfStock ? (
                        <>
                          <AlertTriangle size={13} /> Currently out of stock
                        </>
                      ) : isLowStock ? (
                        <>
                          <AlertTriangle size={13} /> Low stock — only {availableCount} available for
                          collection
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} /> {availableCount} available for collection
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '0 16px 16px',
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {!isOutOfStock ? (
                    <>
                      <button
                        type="button"
                        className="button primary"
                        style={{ flex: 1, minHeight: 38 }}
                        onClick={() => void handleMoveToBag(entry)}
                      >
                        <ShoppingBag size={14} />
                        <span>Move to bag</span>
                      </button>
                      <Link
                        href={`/shop/${entry.productId}`}
                        className="button"
                        style={{ background: '#fff', minHeight: 38 }}
                      >
                        <span>View / Reserve</span>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/request-product`}
                        className="button primary"
                        style={{ flex: 1, minHeight: 38 }}
                      >
                        <span>Request similar item</span>
                        <ArrowRight size={14} />
                      </Link>
                      <button
                        type="button"
                        className="button"
                        style={{ background: '#fff', minHeight: 38 }}
                        onClick={() => void removeItem(entry.productId, p?.name)}
                      >
                        <span>Remove</span>
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
