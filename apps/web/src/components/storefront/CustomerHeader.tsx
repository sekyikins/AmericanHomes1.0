'use client';

import { Bell, Home, Menu, ShoppingBag, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/store/auth.store';
import { useCart } from '@/store/cart.store';
import { BagModal } from './BagModal';
import { LoginModal } from './LoginModal';
import { OrderConfirmedModal } from './OrderConfirmedModal';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Request a product', href: '/request-product' },
];

export function CustomerHeader() {
  const pathname = usePathname();
  const { items, setBagOpen } = useCart();
  const { user, loginOpen, setLoginOpen, setPostLoginRedirect } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <div className="topline">
        <span>Imported quality. Local confidence.</span>
        <span>Warehouse collection in Tema, Ghana</span>
      </div>
      <header className="header-wrap">
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="icon-button mobile-nav-toggle"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <Link className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                <Home size={18} strokeWidth={2.2} />
              </span>
              <span>
                American<span style={{ color: 'var(--green)' }}>Homes</span>
              </span>
            </Link>
          </div>

          <nav className="nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive(item.href) ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="actions">
            <Link
              href="/account/notifications"
              className="icon-button"
              aria-label="Notifications"
              onClick={(e) => {
                if (!user || user.role === 'STAFF') {
                  e.preventDefault();
                  setPostLoginRedirect('/account/notifications');
                  setLoginOpen(true);
                }
              }}
            >
              <Bell size={19} strokeWidth={2} />
              <span className="bell-dot" aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="bag-link"
              onClick={() => setBagOpen(true)}
              aria-label={`Shopping bag, ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
            >
              <ShoppingBag size={19} strokeWidth={2} />
              <span>Bag</span>
              {items.length > 0 && <span className="bag-count-pill">{items.length}</span>}
            </button>
            {user && user.role !== 'STAFF' ? (
              <Link href="/account" className="button primary signin-btn" aria-label="My account">
                <User size={16} strokeWidth={2.2} />
                <span>{user.name?.split(' ')[0] ?? 'Account'}</span>
              </Link>
            ) : (
              <button
                type="button"
                className="button primary signin-btn"
                aria-label="Sign in"
                onClick={() => setLoginOpen(true)}
              >
                <User size={16} strokeWidth={2.2} />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
        {mobileMenuOpen && (
          <>
            <div
              className="mobile-nav-backdrop"
              aria-hidden="true"
              onClick={() => setMobileMenuOpen(false)}
            />
            <nav className="mobile-nav-drawer" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link ${isActive(item.href) ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </>
        )}
      </header>
      <BagModal />
      <OrderConfirmedModal />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
