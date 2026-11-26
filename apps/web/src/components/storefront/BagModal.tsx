'use client';

import { ArrowRight, Heart, Minus, Plus, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { formatGHS } from '@/lib/formatting/currency';
import { useToast } from '@/providers/toast.provider';
import { useCart, type CartItem } from '@/store/cart.store';
import { useWishlist } from '@/store/wishlist.store';

export function BagPanel({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { items, setLineQuantity, removeLine, subtotalPesewas, setBagOpen } = useCart();
  const { count: wishlistCount, saveItem } = useWishlist();

  const handleSaveForLater = async (item: CartItem) => {
    const targetProductId = item.productId ?? item.id;
    await saveItem(
      {
        productId: targetProductId,
        variantId: item.id,
        priceAtSavePesewas: item.pricePesewas,
        name: item.name,
      },
      true,
    );
    removeLine(item.id, item.variant);
    showToast(`Saved ${item.name} to your wishlist for later`, 'info');
  };

  const itemCount = items.length;
  const itemLabel = itemCount === 1 ? '1 item ready for you' : `${itemCount} items ready for you`;
  const HeadingTag = onClose ? 'h2' : 'h1';

  const groupedLines = Array.from(
    items.reduce((acc, item) => {
      const key = `${item.id}::${item.variant}`;
      const existing = acc.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        acc.set(key, { item, quantity: 1 });
      }
      return acc;
    }, new Map<string, { item: CartItem; quantity: number }>()),
  );

  const handleCheckout = () => {
    if (itemCount === 0) return;
    setBagOpen(false);
    router.push('/checkout');
  };

  return (
    <div
      className="bag-card"
      data-node-id={itemCount === 0 ? '1:1827' : '1:4978'}
      onClick={(e) => e.stopPropagation()}
    >
      {onClose && (
        <button
          type="button"
          className="login-close"
          onClick={onClose}
          aria-label="Close shopping bag"
        >
          <X size={17} strokeWidth={2} />
        </button>
      )}

      <div className="bag-header">
        <div className="eyebrow">Your shopping bag</div>
        <HeadingTag className="bag-title">{itemLabel}</HeadingTag>
      </div>

      <div className="bag-grid">
        <div className="bag-items-col">
          {itemCount === 0 ? (
            <div className="bag-empty">
              <span className="bag-empty-icon" aria-hidden="true">
                <ShoppingBag size={24} strokeWidth={1.8} />
              </span>
              <strong>Your bag is empty</strong>
              <p>Explore our available products to get started.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
                <Link
                  href="/shop"
                  className="button primary"
                  onClick={() => onClose?.()}
                >
                  <span>Browse shop</span>
                  <ArrowRight size={15} />
                </Link>
                {wishlistCount > 0 && (
                  <Link
                    href="/wishlist"
                    className="button"
                    style={{ background: '#fff' }}
                    onClick={() => onClose?.()}
                  >
                    <Heart size={14} color="#b42318" fill="#b42318" />
                    <span>View saved ({wishlistCount})</span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="bag-list">
              {groupedLines.map(([key, { item, quantity }]) => (
                <article className="bag-item" key={key}>
                  <img src={item.image} alt="" className="bag-item-img" />
                  <div className="bag-item-info">
                    <span className="bag-item-cat">{item.category}</span>
                    <h3>{item.name}</h3>
                    <span className="bag-item-variant">{item.variant}</span>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.name}`}
                        onClick={() => setLineQuantity(item.id, item.variant, quantity - 1)}
                        style={{
                          width: 26,
                          height: 26,
                          border: '0.8px solid var(--line)',
                          background: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
                        {quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.name}`}
                        onClick={() => setLineQuantity(item.id, item.variant, quantity + 1)}
                        style={{
                          width: 26,
                          height: 26,
                          border: '0.8px solid var(--line)',
                          background: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="bag-item-right">
                    <strong>{formatGHS(item.pricePesewas * quantity)}</strong>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                      <button
                        type="button"
                        className="bag-remove-btn"
                        style={{ color: 'var(--green)' }}
                        aria-label={`Save ${item.name} for later`}
                        onClick={() => void handleSaveForLater(item)}
                      >
                        Save for later
                      </button>
                      <button
                        type="button"
                        className="bag-remove-btn"
                        aria-label={`Remove ${item.name} from bag`}
                        onClick={() => removeLine(item.id, item.variant)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="bag-summary">
          <h3>Order summary</h3>
          <div className="bag-summary-row">
            <span>Subtotal</span>
            <strong>{formatGHS(subtotalPesewas)}</strong>
          </div>
          <div className="bag-summary-row">
            <span>Collection</span>
            <strong>Free</strong>
          </div>
          <div className="bag-summary-total">
            <span>Total</span>
            <strong>{formatGHS(subtotalPesewas)}</strong>
          </div>

          <button
            type="button"
            disabled={itemCount === 0}
            onClick={handleCheckout}
            className="button primary bag-checkout-btn"
          >
            <span>Proceed to checkout</span>
            <ArrowRight size={15} strokeWidth={2.2} />
          </button>

          <div className="bag-secure-note">
            <ShieldCheck size={13} />
            <span>Secure checkout · Verified payment</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function BagModal() {
  const { bagOpen, setBagOpen } = useCart();

  useEffect(() => {
    if (!bagOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBagOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bagOpen, setBagOpen]);

  if (!bagOpen) return null;

  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Your shopping bag"
      onClick={() => setBagOpen(false)}
    >
      <BagPanel onClose={() => setBagOpen(false)} />
    </div>
  );
}
