'use client';

import { Check, CheckCircle2, Heart, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CatalogProduct } from '@/lib/data/products';
import { formatGHS } from '@/lib/formatting/currency';
import { useToast } from '@/providers/toast.provider';
import { useCart } from '@/store/cart.store';

const WISHLIST_KEY = 'ah_saved_products';

export function ProductCard({ product }: { product: CatalogProduct }) {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [justAdded, setJustAdded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WISHLIST_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.includes(product.id)) {
          setSaved(true);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [product.id]);

  const handleToggleSave = () => {
    const next = !saved;
    setSaved(next);
    try {
      const raw = window.localStorage.getItem(WISHLIST_KEY);
      const existing: string[] = raw && Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
      const updated = next
        ? Array.from(new Set([...existing, product.id]))
        : existing.filter((id) => id !== product.id);
      window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
    showToast(
      next ? `Saved ${product.name} to wishlist` : `Removed ${product.name} from wishlist`,
      'info',
    );
  };

  const handleQuickAdd = () => {
    addItem({
      id: product.defaultVariantId ?? product.id,
      name: product.name,
      category: product.category,
      variant: product.variants[0]?.name ?? 'Standard',
      pricePesewas: product.variants[0]?.pricePesewas ?? product.pricePesewas,
      image: product.image,
      defectDisclosures: product.defectDisclosures ?? null,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article className="product">
      <div className="product-media-wrap">
        {product.badge && <span className="badge">{product.badge}</span>}
        <button
          type="button"
          className="wishlist-pill"
          aria-label={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`}
          aria-pressed={saved}
          style={saved ? { color: '#b42318', borderColor: '#f3c6c3' } : undefined}
          onClick={(e) => {
            e.preventDefault();
            handleToggleSave();
          }}
        >
          <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
        </button>

        <Link
          href={`/shop/${product.id}`}
          className="product-image-link"
          aria-hidden="true"
          tabIndex={-1}
        >
          <div
            className="product-image"
            style={{ backgroundImage: `url('${product.image}')` }}
          />
        </Link>

        <button
          type="button"
          className="quick-add-btn"
          disabled={product.availableCount <= 0}
          onClick={handleQuickAdd}
          style={product.availableCount <= 0 ? { opacity: 0.65, cursor: 'not-allowed' } : undefined}
        >
          {product.availableCount <= 0 ? (
            <span>Out of stock</span>
          ) : justAdded ? (
            <>
              <Check size={15} strokeWidth={2.5} />
              <span>Added to bag</span>
            </>
          ) : (
            <>
              <Plus size={15} strokeWidth={2.2} />
              <span>Quick add</span>
            </>
          )}
        </button>
      </div>

      <Link href={`/shop/${product.id}`} className="product-body-link">
        <div className="product-body">
          <p>{product.category}</p>
          <h3>{product.name}</h3>
          <div className="product-price-row">
            <strong>{formatGHS(product.pricePesewas)}</strong>
            {product.previousPricePesewas && (
              <span className="price-strike">{formatGHS(product.previousPricePesewas)}</span>
            )}
          </div>
          <div className="product-stock">
            <CheckCircle2 size={13} /> {product.availableCount} available for collection
          </div>
        </div>
      </Link>
    </article>
  );
}
