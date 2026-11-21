'use client';

import { ArrowLeft, Clock, PackageCheck, Sparkles, Truck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { notificationsApi } from '@/lib/api';
import { mapCustomerNotifications, type CustomerNotificationItem } from '@/lib/customerAccount';

const TABS: Array<'All' | 'Orders' | 'Requests' | 'Account'> = [
  'All',
  'Orders',
  'Requests',
  'Account',
];

export default function NotificationsPage() {
  const [items, setItems] = useState<CustomerNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'All' | 'Orders' | 'Requests' | 'Account'>('All');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationsApi.getMy();
      setItems(mapCustomerNotifications(res));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = items.filter((i) => i.unread).length;
  const visible =
    activeTab === 'All' ? items : items.filter((item) => item.category === activeTab);

  const markAllRead = async () => {
    const unreadIds = items.filter((i) => i.unread).map((i) => i.id);
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
    await Promise.all(unreadIds.map((id) => notificationsApi.markRead(id).catch(() => {})));
  };

  const toggleRead = async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    );
    await notificationsApi.markRead(id).catch(() => {});
  };

  const renderIcon = (item: CustomerNotificationItem) => {
    if (item.tone === 'green') return <PackageCheck size={17} />;
    if (item.tone === 'amber') return <Clock size={17} />;
    if (item.tone === 'blue') return <Truck size={17} />;
    return <Sparkles size={17} />;
  };

  return (
    <main className="notif-shell" data-node-id="2:9900">
      <Link href="/account" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to account</span>
      </Link>

      <div className="notif-head">
        <div>
          <div className="eyebrow">Stay updated</div>
          <h1 className="notif-title">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="link"
            style={{ border: 0, background: 'transparent', padding: 0 }}
            onClick={markAllRead}
          >
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      <div className="notif-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`notif-tab ${activeTab === tab ? 'active' : ''}`}
          >
            <span>{tab}</span>
          </button>
        ))}
      </div>

      <section className="notif-list">
        {loading ? (
          <div style={{ padding: 20 }}>
            <TableSkeleton rows={4} />
          </div>
        ) : error ? (
          <div style={{ padding: 20 }}>
            <ErrorState message={error} onRetry={loadNotifications} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No notifications in this category"
            description="Order, reservation, and product request updates will appear here."
          />
        ) : (
          visible.map((item) => (
            <button
              key={item.id}
              type="button"
              className="notif-item"
              onClick={() => toggleRead(item.id)}
            >
              <span className={`notif-icon ${item.tone}`} aria-hidden="true">
                {renderIcon(item)}
              </span>
              <div className="notif-content">
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{item.time}</small>
              </div>
              {item.unread && <span className="notif-unread-dot" aria-label="Unread" />}
            </button>
          ))
        )}
      </section>
    </main>
  );
}
