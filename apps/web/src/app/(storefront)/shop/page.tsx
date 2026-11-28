'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ProductCard } from '@/components/storefront/ProductCard';
import { EmptyState, ProductGridSkeleton } from '@/components/ui';
import { catalogueApi, governanceApi } from '@/lib/api';
import {
  mapApiProductToCatalog,
  type CatalogProduct,
} from '@/lib/data/products';

const DEFAULT_CATEGORIES = ['Living room', 'Office', 'Kitchen', 'Outdoors', 'Dining', 'Electronics'];

const CATEGORY_ALIASES: Record<string, string> = {
  furniture: 'Living room',
  appliances: 'Kitchen',
  bicycles: 'Outdoors',
  'new arrivals': 'All',
};

function normalizeCategory(raw: string): string {
  return raw.trim().toLowerCase().replace(/[-_]+/g, ' ');
}

function resolveCategoryParam(raw: string | null, availableCategories: string[]): string {
  if (!raw) return 'All';
  const exact = availableCategories.find(
    (c) => normalizeCategory(c) === normalizeCategory(raw),
  );
  if (exact) return exact;
  return CATEGORY_ALIASES[raw.trim().toLowerCase()] ?? raw.trim();
}

function ShopContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['All', ...DEFAULT_CATEGORIES]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [category, setCategory] = useState(() =>
    resolveCategoryParam(searchParams.get('category'), ['All', ...DEFAULT_CATEGORIES]),
  );
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<'all' | 'under3000' | 'over3000'>('all');
  const [conditionFilter, setConditionFilter] = useState<'all' | 'new' | 'excellent' | 'good' | 'fair'>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');

  useEffect(() => {
    let active = true;
    Promise.all([
      catalogueApi.listPublished(),
      governanceApi.getProductCollections().catch(() => null),
    ])
      .then(([res, colRes]) => {
        if (!active) return;
        const mapped = Array.isArray(res) ? res.map(mapApiProductToCatalog) : [];
        setProducts(mapped);
        const merged = new Map<string, string>();
        const addCat = (c: string) => {
          const clean = c.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
          if (!clean) return;
          const k = clean.toLowerCase();
          if (!merged.has(k)) {
            merged.set(
              k,
              clean === clean.toLowerCase()
                ? clean.charAt(0).toUpperCase() + clean.slice(1)
                : clean,
            );
          }
        };
        const base = colRes?.collections?.length ? colRes.collections : DEFAULT_CATEGORIES;
        for (const c of base) addCat(c);
        for (const p of mapped) {
          if (p.category) addCat(p.category);
        }
        const nextCats = ['All', ...Array.from(merged.values())];
        setCategories(nextCats);
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
      setCategory(resolveCategoryParam(rawCat, categories));
    }
  }, [searchParams, categories]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filtersOpen]);

  const activeFilterCount =
    (priceRange !== 'all' ? 1 : 0) +
    (category !== 'All' ? 1 : 0) +
    (conditionFilter !== 'all' ? 1 : 0);

  const visible = products
    .filter((p) => {
      const pCat = normalizeCategory(p.category);
      const selCat = normalizeCategory(category);
      const matchesCat = category === 'All' || pCat === selCat || pCat.startsWith(`${selCat} `);
      const matchesSearch =
        !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
      const matchesPrice =
        priceRange === 'all' ||
        (priceRange === 'under3000' && p.pricePesewas < 300000) ||
        (priceRange === 'over3000' && p.pricePesewas >= 300000);
      const matchesCondition =
        conditionFilter === 'all' ||
        p.condition.toLowerCase().includes(conditionFilter);
      return matchesCat && matchesSearch && matchesPrice && matchesCondition;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return a.pricePesewas - b.pricePesewas;
      if (sortBy === 'price-desc') return b.pricePesewas - a.pricePesewas;
      return 0;
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

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: 24,
        }}
      >
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          {loadingProducts ? (
            'Loading available products…'
          ) : (
            <>
              <strong style={{ color: 'var(--ink)' }}>{visible.length}</strong> available products
            </>
          )}
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            aria-label="Filter by condition"
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value as typeof conditionFilter)}
            style={{
              padding: '8px 12px',
              border: '0.8px solid var(--line)',
              borderRadius: 4,
              background: '#fff',
              fontSize: 13,
            }}
          >
            <option value="all">All conditions</option>
            <option value="new">New</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
          </select>

          <select
            aria-label="Sort products"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: '8px 12px',
              border: '0.8px solid var(--line)',
              borderRadius: 4,
              background: '#fff',
              fontSize: 13,
            }}
          >
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

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
                  setConditionFilter('all');
                  setSortBy('featured');
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
