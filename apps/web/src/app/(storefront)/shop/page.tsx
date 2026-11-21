'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ProductCard } from '@/components/storefront/ProductCard';
import { EmptyState, ProductGridSkeleton } from '@/components/ui';
import { catalogueApi } from '@/lib/api';
import {
  mapApiProductToCatalog,
  type CatalogProduct,
} from '@/lib/data/products';

const categories = ['All', 'Living room', 'Office', 'Kitchen', 'Outdoors', 'Dining', 'Electronics'];

const CATEGORY_ALIASES: Record<string, string> = {
  furniture: 'Living room',
  appliances: 'Kitchen',
  bicycles: 'Outdoors',
  'new arrivals': 'All',
};

function normalizeCategory(raw: string): string {
  return raw.trim().toLowerCase().replace(/[-_]+/g, ' ');
}

function resolveCategoryParam(raw: string | null): string {
  if (!raw) return 'All';
  const exact = categories.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
  if (exact) return exact;
  return CATEGORY_ALIASES[raw.trim().toLowerCase()] ?? 'All';
}

function ShopContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [category, setCategory] = useState(() => resolveCategoryParam(searchParams.get('category')));
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<'all' | 'under3000' | 'over3000'>('all');

  useEffect(() => {
    let active = true;
    catalogueApi
      .listPublished()
      .then((res) => {
        if (active && Array.isArray(res)) {
          setProducts(res.map(mapApiProductToCatalog));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingProducts(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const rawCat = searchParams.get('category');
    if (rawCat !== null) {
      setCategory(resolveCategoryParam(rawCat));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filtersOpen]);

  const activeFilterCount = (priceRange !== 'all' ? 1 : 0) + (category !== 'All' ? 1 : 0);

  const visible = products.filter((p) => {
    const pCat = normalizeCategory(p.category);
    const selCat = normalizeCategory(category);
    const matchesCat = category === 'All' || pCat === selCat || pCat.startsWith(`${selCat} `);
    const matchesSearch =
      !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
    const matchesPrice =
      priceRange === 'all' ||
      (priceRange === 'under3000' && p.pricePesewas < 300000) ||
      (priceRange === 'over3000' && p.pricePesewas >= 300000);
    return matchesCat && matchesSearch && matchesPrice;
  });

  return (
    <main className="page-shell">
      <div className="eyebrow">The collection</div>
      <h1 style={{ fontSize: 'clamp(38px,5vw,62px)', maxWidth: 650, margin: '12px 0' }}>
        Well-made things for everyday living.
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 18, maxWidth: 620, lineHeight: 1.55 }}>
        Every item shown is physically received, inspected and approved for sale.
      </p>

      <div className="shop-tools">
        <label className="search">
          <Search size={18} style={{ marginRight: 10, color: 'var(--muted)' }} />
          <input
            aria-label="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            style={{ border: 0, outline: 0, width: '100%', background: 'transparent' }}
          />
        </label>
        <button className="filters" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal size={16} /> Filters{' '}
          {activeFilterCount > 0 && (
            <span className="status" style={{ padding: '4px 7px' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="tabs">
        {categories.map((item) => (
          <button
            key={item}
            className={`tab ${category === item ? 'active' : ''}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <p style={{ color: 'var(--muted)', marginTop: 30 }}>
        {loadingProducts ? (
          'Loading available products…'
        ) : (
          <>
            <strong style={{ color: 'var(--ink)' }}>{visible.length}</strong> available products
          </>
        )}
      </p>

      {loadingProducts ? (
        <div style={{ marginTop: 28 }}>
          <ProductGridSkeleton count={6} className="products" />
        </div>
      ) : visible.length === 0 ? (
        <div style={{ marginTop: 28 }}>
          <EmptyState
            title="No products found"
            description="No available products match your current search or filter."
            action={
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setSearch('');
                  setCategory('All');
                  setPriceRange('all');
                }}
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <div className="products">
          {visible.map((item) => (
            <ProductCard product={item} key={item.id} />
          ))}
        </div>
      )}

      {filtersOpen && (
        <div className="modal-backdrop" onClick={() => setFiltersOpen(false)}>
          <section
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Filter products"
          >
            <div className="modal-header">
              <h2>Filter products</h2>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Close filter modal"
                onClick={() => setFiltersOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p>Refine the collection by availability and price range.</p>
            <label className="form-field">
              Availability
              <select defaultValue="ready">
                <option value="ready">Ready for collection</option>
              </select>
            </label>
            <label className="form-field">
              Price range
              <select
                value={priceRange}
                onChange={(e) =>
                  setPriceRange(e.target.value as 'all' | 'under3000' | 'over3000')
                }
              >
                <option value="all">Any price</option>
                <option value="under3000">Under GHS 3,000</option>
                <option value="over3000">GHS 3,000 and above</option>
              </select>
            </label>
            <div className="modal-actions">
              <button
                className="button"
                onClick={() => {
                  setPriceRange('all');
                  setCategory('All');
                  setFiltersOpen(false);
                }}
              >
                Clear
              </button>
              <button className="button primary" onClick={() => setFiltersOpen(false)}>
                Apply filters
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<main className="page-shell">Loading products…</main>}>
      <ShopContent />
    </Suspense>
  );
}
