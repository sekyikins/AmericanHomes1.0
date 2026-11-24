'use client';

import {
  Activity,
  BarChart2,
  Bell,
  ChevronDown,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileText,
  Home,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  User,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui';
import { StaffAccountModal } from '@/components/staff/StaffAccountModal';
import { StaffLoginCard } from '@/components/staff/StaffLoginCard';
import { DashboardSkeleton } from '@/components/ui';
import { notificationsApi } from '@/lib/api';
import { hasStaffPermission } from '@/lib/permissionCatalog';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';

type NavItem = {
  label: string;
  href: string;
  Icon: typeof LayoutGrid;
  permission?: string;
  ownerOnly?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [{ label: 'Dashboard', href: '/staff/dashboard', Icon: LayoutGrid }],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Shipments', href: '/staff/shipments', Icon: Truck, permission: 'shipments.view' },
      { label: 'Receiving', href: '/staff/receiving', Icon: PackageCheck, permission: 'receiving.view' },
      { label: 'Product catalogue', href: '/staff/products', Icon: Store, permission: 'catalogue.view' },
      { label: 'Preparation', href: '/staff/preparation', Icon: ListChecks, permission: 'catalogue.update' },
      { label: 'Inventory & stocktakes', href: '/staff/inventory', Icon: Warehouse, permission: 'inventory.view' },
    ],
  },
  {
    title: 'CUSTOMER DEMAND',
    items: [
      { label: 'Product requests', href: '/staff/product-requests', Icon: FileText, permission: 'product_requests.view' },
      { label: 'Sourcing', href: '/staff/sourcing', Icon: Search, permission: 'sourcing.manage' },
      { label: 'Allocations', href: '/staff/allocations', Icon: Users, permission: 'allocations.manage' },
      { label: 'Product polls', href: '/staff/notifications?tab=polls', Icon: BarChart2, permission: 'product_requests.review' },
    ],
  },
  {
    title: 'SALES',
    items: [
      { label: 'Reservations', href: '/staff/reservations', Icon: Clock, permission: 'reservations.view' },
      { label: 'Orders', href: '/staff/orders', Icon: ShoppingBag, permission: 'orders.view' },
      { label: 'Collections', href: '/staff/collections', Icon: Package, permission: 'collections.manage' },
      { label: 'Payments', href: '/staff/payments', Icon: CreditCard, permission: 'payments.view' },
      { label: 'Returns', href: '/staff/returns', Icon: RotateCcw, permission: 'returns.review' },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { label: 'Finance & reports', href: '/staff/reports', Icon: BarChart2, permission: 'reports.view' },
    ],
  },
  {
    title: 'PEOPLE & SYSTEM',
    items: [
      { label: 'Customers', href: '/staff/customers', Icon: Users, permission: 'customers.view' },
      { label: 'Staff', href: '/staff/staff', Icon: User, permission: 'staff.view' },
      { label: 'Permissions', href: '/staff/permissions', Icon: ShieldCheck, permission: 'permissions.view' },
      { label: 'Audit logs', href: '/staff/audit-logs', Icon: Activity, permission: 'audit.view' },
      { label: 'Reports & requests', href: '/staff/staff-reports', Icon: ClipboardCheck, permission: 'staff_reports.view' },
      { label: 'Settings', href: '/staff/settings', Icon: Settings, ownerOnly: true },
    ],
  },
];

function getPageTitle(pathname: string): { section: string; title: string } {
  if (pathname === '/staff' || pathname === '/staff/dashboard') {
    return { section: 'Operations', title: 'Dashboard' };
  }
  if (pathname === '/staff/notifications') {
    return { section: 'Operations', title: 'Notifications' };
  }
  if (pathname === '/staff/stocktakes') {
    return { section: 'Operations', title: 'Stocktakes' };
  }
  if (pathname === '/staff/expenses') {
    return { section: 'Finance', title: 'Expenses' };
  }
  for (const sec of NAV_SECTIONS) {
    for (const item of sec.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return {
          section: sec.title.charAt(0) + sec.title.slice(1).toLowerCase(),
          title: item.label,
        };
      }
    }
  }
  return { section: 'Operations', title: 'Workspace' };
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, clearAuth } = useAuth();
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const { section, title } = getPageTitle(pathname);

  const refreshUnreadCount = useCallback(() => {
    if (!user || user.role !== 'STAFF') {
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
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${title} | Staff Portal – AmericanHomes`;
    }
  }, [title]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 960px)');
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!loading && pathname === '/staff/login' && user?.role === 'STAFF') {
      router.replace('/staff/dashboard');
    } else if (!loading && pathname !== '/staff/login' && (!user || user.role !== 'STAFF')) {
      router.replace('/staff/login');
    }
  }, [loading, pathname, router, user]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  if (pathname === '/staff/login') {
    if (!loading && user?.role === 'STAFF') {
      return (
        <main
          style={{
            minHeight: '100vh',
            background: 'var(--canvas)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--muted)',
            fontSize: 13,
          }}
        >
          Redirecting to dashboard…
        </main>
      );
    }
    return <>{children}</>;
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: 'var(--canvas)',
          padding: 28,
        }}
      >
        <DashboardSkeleton />
      </main>
    );
  }

  if (!user || user.role !== 'STAFF') {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: 'var(--canvas)',
          display: 'grid',
          placeItems: 'center',
          padding: 20,
        }}
      >
        <StaffLoginCard onSuccess={() => {}} />
      </main>
    );
  }

  const canView = (item: NavItem) => {
    if (item.ownerOnly) return Boolean(user.isOwner);
    return hasStaffPermission(user, item.permission);
  };

  const ROUTE_PERMISSIONS: Array<{ prefix: string; permission?: string; ownerOnly?: boolean }> = [
    ...NAV_SECTIONS.flatMap((s) =>
      s.items.map((item) => ({
        prefix: item.href,
        permission: item.permission,
        ownerOnly: item.ownerOnly,
      })),
    ),
    { prefix: '/staff/stocktakes', permission: 'stocktakes.view' },
    { prefix: '/staff/expenses', permission: 'expenses.view' },
  ];

  const matchedRule = ROUTE_PERMISSIONS.find(
    (r) => r.prefix !== '/staff/dashboard' && (pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)),
  );
  const routeAllowed =
    !matchedRule ||
    Boolean(user.isOwner) ||
    (matchedRule.ownerOnly ? false : hasStaffPermission(user, matchedRule.permission));

  const visibleSections = NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((item) => canView(item)),
  })).filter((sec) => sec.items.length > 0);

  const isActive = (href: string) => {
    if (href === '/staff/dashboard') {
      return pathname === '/staff' || pathname === '/staff/dashboard';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isSidebarCollapsed = collapsed && !isMobileViewport;

  return (
    <div className="admin-shell">
      {mobileNavOpen && (
        <div
          className="admin-mobile-backdrop"
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${mobileNavOpen ? 'mobile-open' : ''}`}
        aria-hidden={isMobileViewport && !mobileNavOpen ? true : undefined}
        style={isMobileViewport && !mobileNavOpen ? { visibility: 'hidden' } : undefined}
        data-node-id="9:59765"
      >
        <div className="admin-brand-row">
          <Link href="/staff/dashboard" className="admin-brand">
            <span className="admin-brand-mark" aria-hidden="true" style={{ overflow: 'hidden', padding: 0 }}>
              <img
                src="/images/americanhomes-emblem.png"
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </span>
            {!isSidebarCollapsed && (
              <span className="admin-brand-text">
                American<span style={{ color: '#6fd1a6' }}>Homes</span>
              </span>
            )}
          </Link>
          {mobileNavOpen ? (
            <button
              type="button"
              className="admin-collapse-btn"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation menu"
            >
              <X size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="admin-collapse-btn"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
        </div>

        {!isSidebarCollapsed && (
          <div className="admin-workspace-card">
            <span className="admin-ah-badge">AH</span>
            <div className="admin-workspace-meta">
              <strong>AmericanHomes</strong>
              <span>Tema warehouse</span>
            </div>
            <ChevronDown size={14} color="#8da2b5" />
          </div>
        )}

        <div className="admin-nav-scroll">
          {visibleSections.map((group) => (
            <div key={group.title} className="admin-nav-group">
              {!isSidebarCollapsed && <div className="admin-nav-label">{group.title}</div>}
              <nav className="admin-nav-list" aria-label={group.title}>
                {group.items.map(({ label, href, Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={isSidebarCollapsed ? label : undefined}
                      onClick={() => setMobileNavOpen(false)}
                      className={`admin-nav-item ${active ? 'active' : ''}`}
                    >
                      <span className="admin-nav-item-left">
                        <Icon size={16} strokeWidth={1.9} />
                        {!isSidebarCollapsed && <span>{label}</span>}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="icon-button admin-mobile-toggle"
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((prev) => !prev)}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="admin-breadcrumb">
              <span className="admin-breadcrumb-sub">
                {section} / <strong style={{ color: 'var(--green)' }}>{title}</strong>
              </span>
              <strong className="admin-breadcrumb-title">{title}</strong>
            </div>
          </div>

          <div className="admin-topbar-right">
            <form
              className="admin-search"
              onSubmit={(e) => {
                e.preventDefault();
                const q = globalSearch.trim().toLowerCase();
                if (!q) return;
                const flat = NAV_SECTIONS.flatMap((s) => s.items);
                const match = flat.find((item) => item.label.toLowerCase().includes(q));
                if (match) {
                  router.push(match.href);
                } else {
                  router.push(`/staff/products?search=${encodeURIComponent(globalSearch.trim())}`);
                }
              }}
            >
              <Search size={15} color="var(--muted)" />
              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search pages or products..."
                aria-label="Search staff workspace"
              />
            </form>
            <Link href="/staff/notifications" className="icon-button" aria-label="Staff notifications">
              <Bell size={18} />
              {unreadCount > 0 && <span className="bell-dot" aria-hidden="true" />}
            </Link>
            <button
              type="button"
              className="admin-user-chip"
              onClick={() => setAccountModalOpen(true)}
              aria-label="Open staff account settings"
              style={{ border: 0, background: 'transparent', textAlign: 'left' }}
            >
              <span className="admin-user-avatar">
                {(user.name ?? (user.isOwner ? 'O' : 'S')).charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{user.name ?? (user.isOwner ? 'Owner' : 'Staff')}</strong>
                <span>{user.isOwner ? 'Owner' : 'Authorised staff'}</span>
              </div>
            </button>
            <button
              type="button"
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => setConfirmSignOut(true)}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="admin-content">
          {routeAllowed ? (
            children
          ) : (
            <section className="acct-panel" style={{ maxWidth: 520, margin: '40px auto', padding: 28 }}>
              <div className="eyebrow">Access restricted</div>
              <h2 className="staff-h1" style={{ fontSize: 22, marginTop: 6 }}>
                Permission required
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 8 }}>
                Your staff account does not have permission to view this section. Contact the Owner
                if you need access.
              </p>
              <Link href="/staff/dashboard" className="button primary" style={{ marginTop: 16 }}>
                Return to dashboard
              </Link>
            </section>
          )}
        </div>
      </div>

      <StaffAccountModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} />

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out of Staff Portal?"
        description="You will be signed out of your staff session on this browser and returned to the staff login page."
        reversible={true}
        confirmLabel="Sign out"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => {
          clearAuth();
          setConfirmSignOut(false);
          showToast('Signed out of Staff Portal', 'info');
          router.push('/staff/login');
        }}
      />
    </div>
  );
}
