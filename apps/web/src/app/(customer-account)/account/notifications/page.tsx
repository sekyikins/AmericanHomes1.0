'use client';

import { ArrowLeft, Clock, PackageCheck, Sparkles, Truck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BackLink, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { notificationsApi } from '@/lib/api';
import { mapCustomerNotifications, type CustomerNotificationItem } from '@/lib/customerAccount';
import { useToast } from '@/providers/toast.provider';

const TABS: Array<'All' | 'Orders' | 'Requests' | 'Account'> = [
  'All',
  'Orders',
  'Requests',
  'Account',
];

export default function NotificationsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<CustomerNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'All' | 'Orders' | 'Requests' | 'Account'>('All');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

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
    if (markingAll) return;
    const unreadIds = items.filter((i) => i.unread).map((i) => i.id);
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    try {
      await Promise.all(unreadIds.map((id) => notificationsApi.markRead(id)));
      setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ah:notifications-updated'));
      }
      showToast(
        unreadIds.length === 1 ? 'Message marked as read' : 'All messages marked as read',
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to mark notifications as read', 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  const toggleRead = async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target || !target.unread || markingId === id) return;
    setMarkingId(id);
    try {
      await notificationsApi.markRead(id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, unread: false } : item)),
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ah:notifications-updated'));
      }
      showToast('Message marked as read', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to mark notification as read', 'error');
    } finally {
      setMarkingId(null);
    }
  };

  const renderIcon = (item: CustomerNotificationItem) => {
    if (item.tone === 'green') return <PackageCheck size={17} />;
    if (item.tone === 'amber') return <Clock size={17} />;
    if (item.tone === 'blue') return <Truck size={17} />;
    return <Sparkles size={17} />;
  };

  return (
    <main className="notif-shell" data-node-id="2:9900">
      <BackLink href="/account" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to account</span>
      </BackLink>

      <div className="notif-head">
        <div>
          <div className="eyebrow">Stay updated</div>
          <h1 className="notif-title">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="link"
            disabled={markingAll}
            aria-busy={markingAll || undefined}
            style={{ border: 0, background: 'transparent', padding: 0 }}
            onClick={markAllRead}
          >
            {markingAll ? 'Marking as read…' : `Mark all as read (${unreadCount})`}
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
              disabled={markingId === item.id}
              aria-busy={markingId === item.id || undefined}
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
