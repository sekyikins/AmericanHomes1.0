'use client';

import { ArrowRight, Home } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

export function CustomerFooter() {
  const [phone, setPhone] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setSubError('Please enter your phone number.');
      setSubscribed(false);
      return;
    }
    setSubError(null);
    setSubscribed(true);
    setPhone('');
  };

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <Link className="brand" href="/" style={{ color: '#fff' }}>
              <span className="brand-mark" aria-hidden="true" style={{ overflow: 'hidden', padding: 0 }}>
                <img
                  src="/images/americanhomes-emblem.png"
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </span>
              <span>
                American<span style={{ color: '#6fd1a6' }}>Homes</span>
              </span>
            </Link>
            <p className="footer-desc">
              Imported quality goods, thoughtfully selected and made available to homes across Ghana.
            </p>
            <p className="footer-meta">Community 25, Tema · Mon–Sat, 9am–6pm</p>
          </div>

          <div>
            <h4 className="footer-heading">Shop</h4>
            <ul className="footer-links">
              <li>
                <Link href="/shop">All products</Link>
              </li>
              <li>
                <Link href="/shop?category=Furniture">Furniture</Link>
              </li>
              <li>
                <Link href="/shop?category=Appliances">Appliances</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="footer-heading">Support</h4>
            <ul className="footer-links">
              <li>
                <Link href="/request-product">Request a product</Link>
              </li>
              <li>
                <Link href="/account/orders">My orders</Link>
              </li>
              <li>
                <Link href="/policies/collection">Collection guide</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="footer-heading">Stay informed</h4>
            <p className="footer-desc" style={{ marginTop: 0, marginBottom: 14 }}>
              Get notified on new arrivals and product updates.
            </p>
            <form onSubmit={handleSubscribe} className="footer-form" noValidate>
              <input
                id="footer-newsletter-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (subError) setSubError(null);
                }}
                placeholder="Your phone number"
                aria-label="Your phone number"
                aria-invalid={Boolean(subError) || undefined}
              />
              <button type="submit" aria-label="Subscribe">
                <ArrowRight size={15} />
              </button>
            </form>
            {subError && (
              <p role="alert" style={{ color: '#fca5a5', fontSize: 12, marginTop: 8 }}>
                {subError}
              </p>
            )}
            {subscribed && (
              <p style={{ color: '#6fd1a6', fontSize: 12, marginTop: 8 }}>
                Subscribed for arrival updates.
              </p>
            )}
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 AmericanHomes Ghana</span>
          <div className="footer-legal">
            <Link href="/policies/collection">Collection</Link>
            <span>·</span>
            <Link href="/policies/returns">Return policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
