'use client';

import { Bell, Home, Menu, ShoppingBag, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { NavigationHistoryTracker } from '@/components/ui';
import { notificationsApi } from '@/lib/api';
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
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(() => {
    if (!user || user.role === 'STAFF') {
      setUnreadCount(0);
      return;
    }
    notificationsApi
      .getMy()
      .then((rows) => {
        if (Array.isArray(rows)) {
          const unread = (rows as Array<{ readAt?: string | null }>).filter((n) => !n.readAt).length;
          setUnreadCount(unread);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('ah:notifications-updated', refreshUnreadCount);
    return () => window.removeEventListener('ah:notifications-updated', refreshUnreadCount);
  }, [refreshUnreadCount]);

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
      <NavigationHistoryTracker />
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
              <span className="brand-mark" aria-hidden="true" style={{ overflow: 'hidden', padding: 0 }}>
                <img
                  src="/images/americanhomes-emblem.png"
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
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
              {unreadCount > 0 && <span className="bell-dot" aria-hidden="true" />}
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
              <Link
                href="/account"
                className="button primary signin-btn is-authenticated"
                aria-label="My account"
              >
                <User size={16} strokeWidth={2.2} />
                <span className="signin-name">{user.name?.split(' ')[0] ?? 'Account'}</span>
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
