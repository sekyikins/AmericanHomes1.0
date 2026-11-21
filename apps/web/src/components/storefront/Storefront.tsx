'use client';

import {
  ArrowRight,
  Bike,
  ChevronRight,
  Home,
  PackageCheck,
  PhoneCall,
  Refrigerator,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState, ProductGridSkeleton } from '@/components/ui';
import { catalogueApi } from '@/lib/api';
import {
  mapApiProductToCatalog,
  type CatalogProduct,
} from '@/lib/data/products';
import { ProductCard } from './ProductCard';

const categories = [
  { name: 'Furniture', count: '42 products', Icon: Home },
  { name: 'Appliances', count: '28 products', Icon: Refrigerator },
  { name: 'Bicycles', count: '12 products', Icon: Bike },
  { name: 'New arrivals', count: '19 products', Icon: Sparkles },
];

const processSteps = [
  {
    num: '01',
    title: 'We source with care',
    desc: 'Selected from trusted US suppliers.',
  },
  {
    num: '02',
    title: 'We inspect locally',
    desc: 'Every item is checked, cleaned and photographed.',
  },
  {
    num: '03',
    title: 'You shop real stock',
    desc: 'Only approved, physically available items appear.',
  },
  {
    num: '04',
    title: 'Collect in Tema',
    desc: 'Pay securely and collect from our warehouse.',
  },
];

export function Storefront() {
  const [requestOpen, setRequestOpen] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<CatalogProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    let active = true;
    catalogueApi
      .listPublished()
      .then((res) => {
        if (active && Array.isArray(res)) {
          setFeaturedProducts(res.map(mapApiProductToCatalog));
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
  const featured = featuredProducts.slice(0, 4);

  return (
    <main>
      <div className="home-container" style={{ paddingTop: 14 }}>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Quality finds, carefully selected
            </div>
            <h1>
              American quality,
              <br />
              <em>closer to home.</em>
            </h1>
            <p>
              Discover authentic furniture, appliances and everyday essentials imported from the USA
              and ready in Ghana.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/shop">
                Shop products <ArrowRight size={15} />
              </Link>
              <button className="button" style={{ background: '#fff' }} onClick={() => setRequestOpen(true)}>
                Request a product
              </button>
            </div>
            <div className="hero-trust">
              <span>
                <ShieldCheck size={14} /> Inspected before sale
              </span>
              <span>
                <PackageCheck size={14} /> Ready stock only
              </span>
              <span>
                <PhoneCall size={14} /> Local support
              </span>
            </div>
          </div>

          <div className="hero-image">
            <div className="hero-origin-tag">
              <span style={{ opacity: 0.72, marginRight: 6 }}>01</span>
              Imported from the USA · Inspected in Tema
            </div>
            <div className="product-callout">
              <span className="status">● Ready to collect</span>
              <strong>Haven Three-Seater Sofa</strong>
              <small>From GHS 8,950</small>
            </div>
          </div>
        </section>
      </div>

      <section className="home-section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Browse your way</div>
            <h2>Shop by category</h2>
          </div>
          <Link className="link" href="/shop">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="categories">
          {categories.map(({ name, count, Icon }) => (
            <Link className="category" href={`/shop?category=${encodeURIComponent(name)}`} key={name}>
              <div className="category-left">
                <span className="category-icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={2} />
                </span>
                <div>
                  <strong>{name}</strong>
                  <span>{count}</span>
                </div>
              </div>
              <ChevronRight size={16} color="var(--muted)" />
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section" style={{ paddingTop: 10 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Available now</div>
            <h2>Fresh from the warehouse</h2>
          </div>
          <Link className="link" href="/shop">
            Shop all <ArrowRight size={14} />
          </Link>
        </div>

        {loadingProducts ? (
          <ProductGridSkeleton count={4} className="home-products" />
        ) : featured.length === 0 ? (
          <EmptyState
            title="No available products yet"
            description="New arrivals are being inspected and will appear here once approved."
          />
        ) : (
          <div className="home-products">
            {featured.map((item) => (
              <ProductCard product={item} key={item.id} />
            ))}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="process-banner">
          <div>
            <div className="eyebrow" style={{ color: '#6fd1a6' }}>
              Simple. Clear. Reliable.
            </div>
            <h2>From the USA to your home in Ghana.</h2>
            <p>Every item follows a careful process before it reaches our catalogue.</p>
          </div>
          <div className="process-grid">
            {processSteps.map((step) => (
              <div className="process-item" key={step.num}>
                <span>{step.num}</span>
                <strong>{step.title}</strong>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section" style={{ paddingTop: 0 }}>
        <div className="cta-banner">
          <div>
            <div className="eyebrow">Can’t find it?</div>
            <h2>Tell us what you’re looking for.</h2>
            <p>
              Send a photo or description. We’ll consider it for a future sourcing trip—no payment
              or commitment required.
            </p>
          </div>
          <Link href="/request-product" className="button" style={{ background: '#fff', minHeight: 46 }}>
            Make a product request <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {requestOpen && <RequestModal onClose={() => setRequestOpen(false)} />}
    </main>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const [productQuery, setProductQuery] = useState('');
  const [budgetGhs, setBudgetGhs] = useState('');
  const params = new URLSearchParams();
  if (productQuery.trim()) params.set('product', productQuery.trim());
  if (budgetGhs.trim()) params.set('budget', budgetGhs.trim());
  const nextHref = params.toString() ? `/request-product?${params.toString()}` : '/request-product';

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">Customer demand</div>
            <h2 id="request-title">Request a product</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p>Tell us what you are looking for and our team will source it from trusted US suppliers.</p>
        <label className="form-field">
          What product are you looking for?
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="e.g. sectional sofa, laptop..."
          />
        </label>
        <label className="form-field">
          Your budget (GHS)
          <input
            type="number"
            value={budgetGhs}
            onChange={(e) => setBudgetGhs(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <div className="modal-actions">
          <button className="button" onClick={onClose}>
            Cancel
          </button>
          <Link className="button primary" href={nextHref} onClick={onClose}>
            Continue
          </Link>
        </div>
      </section>
    </div>
  );
}
