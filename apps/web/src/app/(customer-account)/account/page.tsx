'use client';

import {
  ArrowRight,
  Bell,
  Clock,
  FileText,
  Settings,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AccountSettingsModal } from '@/components/customer/AccountSettingsModal';
import { AccountOverviewSkeleton, EmptyState, ErrorState } from '@/components/ui';
import { notificationsApi, ordersApi, requestsApi, reservationsApi } from '@/lib/api';
import {
  mapCustomerNotifications,
  mapCustomerOrders,
  mapCustomerRequests,
  mapCustomerReservations,
  type CustomerOrderRecord,
  type CustomerReservationRecord,
} from '@/lib/customerAccount';
import { formatGHS } from '@/lib/formatting/currency';
import { useAuth } from '@/store/auth.store';

export default function AccountOverviewPage() {
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([]);
  const [reservations, setReservations] = useState<CustomerReservationRecord[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordRes, resRes, reqRes, notifRes] = await Promise.all([
        ordersApi.getMy(),
        reservationsApi.getMy(),
        requestsApi.getMy(),
        notificationsApi.getMy(),
      ]);
      setOrders(mapCustomerOrders(ordRes));
      setReservations(mapCustomerReservations(resRes));
      setRequestCount(mapCustomerRequests(reqRes).length);
      setUnreadCount(mapCustomerNotifications(notifRes).filter((n) => n.unread).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your account overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const activeOrdersCount = orders.filter((o) => o.collectionStatus !== 'Cancelled').length;
  const activeReservations = reservations.filter(
    (r) => r.status === 'Approved' || r.status === 'Pending review',
  );
  const featuredReservation =
    activeReservations.find((r) => r.status === 'Approved') ?? activeReservations[0];

  return (
    <main className="acct-shell" data-node-id="2:9492">
      <div className="acct-head">
        <div>
          <div className="eyebrow">My AmericanHomes</div>
          <h1 className="acct-title">Welcome back, {firstName}.</h1>
        </div>
        <button
          type="button"
          className="button"
          style={{ background: '#fff' }}
          onClick={() => setSettingsOpen(true)}
        >
          <Settings size={15} />
          <span>Account settings</span>
        </button>
      </div>

      {loading ? (
        <AccountOverviewSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadOverview} />
      ) : (
        <>
          <section className="acct-stats" aria-label="Account summary">
            <Link href="/account/orders" className="acct-stat-card">
              <span className="acct-stat-icon">
                <ShoppingBag size={17} />
              </span>
              <div>
                <strong>{activeOrdersCount}</strong>
                <span>{activeOrdersCount === 1 ? 'Active order' : 'Active orders'}</span>
              </div>
            </Link>

            <Link href="/account/reservations" className="acct-stat-card">
              <span className="acct-stat-icon">
                <Clock size={17} />
              </span>
              <div>
                <strong>{activeReservations.length}</strong>
                <span>{activeReservations.length === 1 ? 'Reservation' : 'Reservations'}</span>
              </div>
            </Link>

            <Link href="/account/product-requests" className="acct-stat-card">
              <span className="acct-stat-icon">
                <FileText size={17} />
              </span>
              <div>
                <strong>{requestCount}</strong>
                <span>{requestCount === 1 ? 'Product request' : 'Product requests'}</span>
              </div>
            </Link>

            <Link href="/account/notifications" className="acct-stat-card">
              <span className="acct-stat-icon">
                <Bell size={17} />
              </span>
              <div>
                <strong>{unreadCount}</strong>
                <span>{unreadCount === 1 ? 'Unread update' : 'Unread updates'}</span>
              </div>
            </Link>

            <Link href="/account/polls" className="acct-stat-card">
              <span className="acct-stat-icon">
                <FileText size={17} />
              </span>
              <div>
                <strong>Polls</strong>
                <span>Vote on upcoming stock</span>
              </div>
            </Link>
          </section>

          <div className="acct-main-grid">
            <section className="acct-panel">
              <div className="acct-panel-head">
                <div>
                  <h2>Recent orders</h2>
                  <p>Payment and collection are tracked separately.</p>
                </div>
                <Link href="/account/orders" className="link">
                  View all
                </Link>
              </div>

              {orders.length === 0 ? (
                <EmptyState
                  title="No orders yet"
                  description="Your placed orders and warehouse collection statuses will appear here."
                  action={
                    <Link href="/shop" className="button primary">
                      Browse shop
                    </Link>
                  }
                />
              ) : (
                orders.slice(0, 2).map((order) => {
                  const outstanding = Math.max(0, order.totalPesewas - order.paidPesewas);
                  const pct =
                    order.totalPesewas > 0
                      ? Math.min(100, Math.round((order.paidPesewas / order.totalPesewas) * 100))
                      : 0;
                  return (
                    <article className="acct-order-row" key={order.id}>
                      <img src={order.image} alt="" className="acct-order-img" />
                      <div className="acct-order-info">
                        <span className="acct-order-ref">
                          {order.reference} · {order.date}
                        </span>
                        <h3>{order.productName}</h3>
                        <span className="acct-order-meta">
                          {formatGHS(order.totalPesewas)} · {order.itemCount}{' '}
                          {order.itemCount === 1 ? 'item' : 'items'}
                        </span>
                        <div className="acct-pills">
                          <span
                            className={`acct-pill ${
                              order.paymentStatus === 'Paid' ? 'green' : 'amber'
                            }`}
                          >
                            ● {order.paymentStatus}
                          </span>
                          <span
                            className={`acct-pill ${
                              order.collectionStatus === 'Ready for collection' ? 'blue' : 'gray'
                            }`}
                          >
                            ● {order.collectionStatus}
                          </span>
                        </div>
                      </div>
                      <div className="acct-order-pay" style={{ justifyContent: 'center' }}>
                        {outstanding > 0 ? (
                          <>
                            <div className="acct-pay-line" style={{ gap: 12, whiteSpace: 'nowrap' }}>
                              <span>Amount paid</span>
                              <strong>{formatGHS(order.paidPesewas)}</strong>
                            </div>
                            <div className="acct-progress">
                              <div className="acct-progress-bar" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="acct-pay-line" style={{ gap: 12, whiteSpace: 'nowrap' }}>
                              <span>Outstanding</span>
                              <strong>{formatGHS(outstanding)}</strong>
                            </div>
                            <Link
                              href="/account/orders"
                              className="button primary"
                              style={{ width: '100%', minWidth: 118, minHeight: 38, marginTop: 10, whiteSpace: 'nowrap' }}
                            >
                              View order
                            </Link>
                          </>
                        ) : (
                          <Link
                            href="/account/orders"
                            className="link"
                            style={{ justifyContent: 'flex-end' }}
                          >
                            <span>View details</span>
                            <ArrowRight size={14} />
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </section>

            <div className="acct-side-col">
              <section className="acct-panel">
                <div className="acct-res-head">
                  <h2>Reservation</h2>
                  {featuredReservation?.countdown && (
                    <span className="acct-pill amber">● {featuredReservation.countdown}</span>
                  )}
                </div>
                {featuredReservation ? (
                  <>
                    <strong className="acct-res-item">{featuredReservation.productName}</strong>
                    <p className="acct-res-copy">{featuredReservation.note}</p>
                    <Link
                      href="/account/reservations"
                      className="button primary"
                      style={{ width: '100%', minHeight: 42, marginTop: 16 }}
                    >
                      {featuredReservation.status === 'Approved'
                        ? `Pay ${formatGHS(featuredReservation.pricePesewas)}`
                        : 'View reservation'}
                    </Link>
                  </>
                ) : (
                  <p className="acct-res-copy" style={{ marginTop: 8 }}>
                    You have no active reservations. Reserve any available item to hold stock while
                    completing payment.
                  </p>
                )}
              </section>

              <section className="acct-panel">
                <h2 style={{ fontSize: 16, marginBottom: 10 }}>Collection location</h2>
                <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)' }}>
                  AmericanHomes Warehouse
                </strong>
                <p className="acct-res-copy" style={{ marginTop: 4 }}>
                  Community 25, Tema
                  <br />
                  Mon–Sat · 9am–6pm
                </p>
                <Link
                  href="/policies/collection"
                  className="link"
                  style={{ marginTop: 14, display: 'inline-flex' }}
                >
                  <span>View collection guide</span>
                  <ArrowRight size={14} />
                </Link>
              </section>
            </div>
          </div>
        </>
      )}

      <AccountSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
