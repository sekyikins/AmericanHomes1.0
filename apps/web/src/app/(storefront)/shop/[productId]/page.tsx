'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Warehouse,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { BackLink, Button, EmptyState, ProductDetailSkeleton } from '@/components/ui';
import { catalogueApi, reservationsApi } from '@/lib/api';
import {
  mapApiProductToCatalog,
  type CatalogProduct,
} from '@/lib/data/products';
import { formatGHS } from '@/lib/formatting/currency';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';
import { useCart } from '@/store/cart.store';
import { useWishlist } from '@/store/wishlist.store';

export default function ProductDetailPage({ params }: { params: { productId: string } }) {
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const { addItem } = useCart();
  const { isSaved, toggleItem } = useWishlist();
  const { user, setLoginOpen } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    catalogueApi
      .getProduct(params.productId)
      .then((res) => {
        if (active && res && typeof res === 'object' && 'id' in res) {
          setProduct(mapApiProductToCatalog(res as Record<string, unknown>));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingProduct(false);
      });
    return () => {
      active = false;
    };
  }, [params.productId]);

  const [selectedVariant, setSelectedVariant] = useState(0);
  const [selectedThumb, setSelectedThumb] = useState(0);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [defectsOpen, setDefectsOpen] = useState(true);

  const [reserveOpen, setReserveOpen] = useState(false);
  const [pendingReserveIntent, setPendingReserveIntent] = useState(false);
  const [reserveNotes, setReserveNotes] = useState('');
  const [reservedRef, setReservedRef] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [submittingReserve, setSubmittingReserve] = useState(false);

  useEffect(() => {
    if (user && pendingReserveIntent) {
      setPendingReserveIntent(false);
      setReservedRef(null);
      setReserveOpen(true);
    }
  }, [user, pendingReserveIntent]);

  if (loadingProduct) {
    return (
      <main className="page-shell">
        <BackLink href="/shop" className="pdp-back">
          <ArrowLeft size={15} />
          <span>Back to products</span>
        </BackLink>
        <ProductDetailSkeleton />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="page-shell">
        <BackLink href="/shop" className="pdp-back">
          <ArrowLeft size={15} />
          <span>Back to products</span>
        </BackLink>
        <EmptyState
          title="Product not found"
          description="This item may have been unpublished or is no longer available."
          action={
            <Link href="/shop" className="button primary">
              Browse available products
            </Link>
          }
        />
      </main>
    );
  }

  const activeVariant = product.variants[selectedVariant] ?? product.variants[0];
  const activeAvailableCount =
    typeof activeVariant?.availableCount === 'number'
      ? activeVariant.availableCount
      : product.availableCount;
  const unitPricePesewas = activeVariant?.pricePesewas ?? product.pricePesewas;
  const effectiveQty = Math.min(Math.max(1, qty), Math.max(1, activeAvailableCount));
  const totalPesewas = unitPricePesewas * effectiveQty;
  const galleryImages =
    product.images && product.images.length > 0 ? product.images : [product.image];
  const activeImage = galleryImages[selectedThumb] ?? galleryImages[0] ?? product.image;
  const saved = isSaved(product.id);

  const handleToggleWishlist = () => {
    void toggleItem({
      productId: product.id,
      variantId: activeVariant?.id ?? product.defaultVariantId ?? null,
      priceAtSavePesewas: unitPricePesewas,
      name: product.name,
      product,
    });
  };

  const handleAddToBag = () => {
    if (activeAvailableCount <= 0) return;
    for (let i = 0; i < effectiveQty; i++) {
      addItem({
        id: activeVariant?.id ?? product.defaultVariantId ?? product.id,
        productId: product.id,
        name: product.name,
        category: product.category,
        variant: activeVariant?.name ?? 'Standard',
        pricePesewas: unitPricePesewas,
        image: product.image,
        defectDisclosures: product.defectDisclosures ?? null,
        maxQty: activeAvailableCount,
      });
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  };

  const handleOpenReserve = () => {
    if (!user) {
      setPendingReserveIntent(true);
      setLoginOpen(true);
      return;
    }
    setReservedRef(null);
    setReserveOpen(true);
  };

  const handleSubmitReserve = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingReserve) return;
    setReserveError(null);
    setSubmittingReserve(true);
    try {
      const created = (await reservationsApi.request({
        productVariantId: activeVariant?.id ?? product.defaultVariantId ?? product.id,
        quantity: qty,
        notes: reserveNotes.trim() || undefined,
      })) as { id?: string } | null;
      setReservedRef(created?.id ?? 'SUBMITTED');
      showToast('Reservation request submitted', 'success');
    } catch (err) {
      setReserveError(
        err instanceof Error ? err.message : 'Unable to submit reservation. Please try again.',
      );
    } finally {
      setSubmittingReserve(false);
    }
  };

  return (
    <main className="pdp-shell" data-node-id="1:8537">
      <BackLink href="/shop" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to products</span>
      </BackLink>

      <div className="pdp-grid">
        <div className="pdp-gallery">
          <div className="pdp-main-img-wrap">
            <img src={activeImage} alt={product.name} className="pdp-main-img" />
            <span className="pdp-photo-tag">
              ({selectedThumb + 1}/{galleryImages.length})
            </span>
          </div>

          <div className="pdp-thumbs">
            {galleryImages.map((imgUrl, idx) => (
              <button
                key={`${imgUrl}-${idx}`}
                type="button"
                onClick={() => setSelectedThumb(idx)}
                className={`pdp-thumb ${selectedThumb === idx ? 'active' : ''}`}
                aria-label={`View photo ${idx + 1} of ${galleryImages.length}`}
              >
                <img src={imgUrl} alt={`${product.name} photo ${idx + 1}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="pdp-info">
          <div className="pdp-meta-row">
            <span className="bag-stock-pill" style={{ marginTop: 0 }}>
              ● Available now
            </span>
            <span className="pdp-sku">{product.sku}</span>
          </div>

          <h1 className="pdp-title">{product.name}</h1>

          <div className="pdp-rating" style={{ gap: 8 }}>
            <span className="acct-pill green" style={{ fontSize: 12 }}>
              Condition: {product.condition}
            </span>
          </div>

          <div className="pdp-price">{formatGHS(unitPricePesewas)}</div>

          <p className="pdp-desc">{product.description}</p>

          <div className="pdp-variant-head">
            <strong>Choose a variant</strong>
            <span>{activeVariant?.name}</span>
          </div>

          <div className="pdp-variants">
            {product.variants.map((variant, idx) => {
              const active = idx === selectedVariant;
              return (
                <button
                  key={variant.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedVariant(idx);
                    const nextAvail =
                      typeof variant.availableCount === 'number'
                        ? variant.availableCount
                        : product.availableCount;
                    setQty((q) => Math.min(Math.max(1, q), Math.max(1, nextAvail)));
                  }}
                  className={`pdp-variant-chip ${active ? 'active' : ''}`}
                >
                  <span
                    className="pdp-swatch"
                    style={{ backgroundColor: variant.swatch }}
                    aria-hidden="true"
                  />
                  <span>{variant.name}</span>
                  {active && <Check size={14} color="var(--green)" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>

          <div className="pdp-stock-box">
            <CheckCircle2
              size={18}
              color={activeAvailableCount > 0 ? 'var(--green)' : '#b42318'}
              style={{ flexShrink: 0 }}
            />
            <div>
              <strong>
                {activeAvailableCount > 0
                  ? `${activeAvailableCount} ${activeAvailableCount === 1 ? 'unit' : 'units'} available${
                      product.variants.length > 1 && activeVariant?.name
                        ? ` (${activeVariant.name})`
                        : ''
                    }`
                  : `Out of stock${
                      product.variants.length > 1 && activeVariant?.name
                        ? ` (${activeVariant.name})`
                        : ''
                    }`}
              </strong>
              <span>
                {activeAvailableCount > 0
                  ? 'Ready for collection from our Tema warehouse'
                  : 'Select another variant or submit a product request'}
              </span>
            </div>
          </div>

          <div className="pdp-buy-row">
            <div className="pdp-qty">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={effectiveQty <= 1 || activeAvailableCount <= 0}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus size={14} />
              </button>
              <span>{effectiveQty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={effectiveQty >= Math.max(1, activeAvailableCount) || activeAvailableCount <= 0}
                onClick={() => setQty((q) => Math.min(activeAvailableCount, q + 1))}
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              type="button"
              className="button primary pdp-add-btn"
              disabled={activeAvailableCount <= 0}
              onClick={handleAddToBag}
            >
              {justAdded ? (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  <span>Added to bag</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={16} />
                  <span>Add to bag · {formatGHS(totalPesewas)}</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="button"
              aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
              aria-pressed={saved}
              onClick={handleToggleWishlist}
              style={{
                background: '#fff',
                color: saved ? '#b42318' : 'var(--ink)',
                borderColor: saved ? '#f3c6c3' : 'var(--line)',
                padding: '0 14px',
              }}
            >
              <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
              <span>{saved ? 'Saved' : 'Save'}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={activeAvailableCount <= 0}
            onClick={handleOpenReserve}
            className="pdp-reserve-link"
            style={{ width: '100%', border: 0, background: 'transparent', padding: 0 }}
          >
            <Clock size={14} />
            <span>Need time to pay? Request a reservation</span>
            <ArrowRight size={14} />
          </button>

          <div className="pdp-trust-strip">
            <div className="pdp-trust-item">
              <ShieldCheck size={16} color="var(--green)" />
              <div>
                <strong>Condition checked</strong>
                <span>Inspected and tested</span>
              </div>
            </div>
            <div className="pdp-trust-item">
              <Warehouse size={16} color="var(--green)" />
              <div>
                <strong>Warehouse collection</strong>
                <span>Community 25, Tema</span>
              </div>
            </div>
            <div className="pdp-trust-item">
              <RotateCcw size={16} color="var(--green)" />
              <div>
                <strong>7-day returns</strong>
                <span>Management reviewed</span>
              </div>
            </div>
          </div>

          <div className="pdp-accordion">
            <button
              type="button"
              className="pdp-accordion-trigger"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((o) => !o)}
            >
              <span>Product details</span>
              {detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {detailsOpen && (
              <div className="pdp-accordion-body">
                <div className="pdp-detail-row">
                  <span>Brand</span>
                  <strong>{product.brand}</strong>
                </div>
                <div className="pdp-detail-row">
                  <span>Condition</span>
                  <strong>{product.condition}</strong>
                </div>
                <div className="pdp-detail-row">
                  <span>Source</span>
                  <strong>{product.sourceBatch}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="pdp-accordion">
            <button
              type="button"
              className="pdp-accordion-trigger"
              aria-expanded={defectsOpen}
              onClick={() => setDefectsOpen((o) => !o)}
            >
              <span>Condition &amp; disclosed defects</span>
              {defectsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {defectsOpen && (
              <div className="pdp-accordion-body">
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
                  {product.defectsNote}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {reserveOpen && (
        <div className="login-backdrop" role="dialog" aria-modal="true" onClick={() => setReserveOpen(false)}>
          <div className="login-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="login-close"
              onClick={() => setReserveOpen(false)}
              aria-label="Close reservation dialog"
            >
              <X size={17} />
            </button>

            <div className="login-inner">
              {reservedRef ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="order-confirm-check" style={{ margin: '0 auto 18px' }}>
                    <Check size={24} strokeWidth={2.5} />
                  </div>
                  <div className="eyebrow">Reservation requested</div>
                  <h2 className="login-title" style={{ fontSize: 24 }}>
                    Hold request submitted
                  </h2>
                  <p className="login-subtitle" style={{ marginTop: 10 }}>
                    Reference <strong>{reservedRef}</strong> for {qty} × {product.name} (
                    {activeVariant?.name}) is pending staff approval. You’ll receive a payment
                    deadline once approved.
                  </p>
                  <Link
                    href="/account/reservations"
                    onClick={() => setReserveOpen(false)}
                    className="button primary"
                    style={{ width: '100%', minHeight: 46, marginTop: 22 }}
                  >
                    View my reservations
                  </Link>
                </div>
              ) : (
                <>
                  <div className="eyebrow">Stock hold</div>
                  <h2 className="login-title" style={{ fontSize: 24 }}>
                    Request a reservation
                  </h2>
                  <p className="login-subtitle">
                    {qty} × <strong>{product.name}</strong> ({activeVariant?.name}) ·{' '}
                    <strong>{formatGHS(totalPesewas)}</strong>. Staff review is required before the
                    hold is confirmed.
                  </p>

                  <form onSubmit={handleSubmitReserve} className="login-form">
                    <label className="login-label" htmlFor="reserve-notes">
                      Notes for staff (optional)
                    </label>
                    <textarea
                      id="reserve-notes"
                      rows={3}
                      value={reserveNotes}
                      onChange={(e) => setReserveNotes(e.target.value)}
                      placeholder="e.g. Planning to pay tomorrow afternoon"
                      style={{
                        width: '100%',
                        padding: 12,
                        border: '0.8px solid var(--line)',
                        borderRadius: 4,
                        marginBottom: 18,
                      }}
                    />
                    {reserveError && (
                      <div
                        role="alert"
                        style={{
                          marginBottom: 14,
                          padding: '10px 12px',
                          border: '1px solid #f0c2bd',
                          background: '#fdf3f2',
                          color: '#b42318',
                          fontSize: 13,
                        }}
                      >
                        {reserveError}
                      </div>
                    )}
                    <Button
                      type="submit"
                      variant="primary"
                      className="login-submit"
                      loading={submittingReserve}
                      loadingText="Submitting…"
                    >
                      <span>Submit reservation request</span>
                      <ArrowRight size={15} />
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
