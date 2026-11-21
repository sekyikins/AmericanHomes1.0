'use client';

import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { governanceApi, notificationsApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';
import {
  AlertTriangle,
  Bell,
  Check,
  Megaphone,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type MainView = 'Inbox' | 'Announcements & Incidents';

type StaffNotification = {
  id: string;
  title: string;
  body: string;
  meta: string;
  unread: boolean;
};

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

type IncidentItem = {
  id: string;
  reference: string;
  description: string;
  status: string;
};

export default function StaffNotificationsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canViewAnnouncements = Boolean(user?.isOwner || user?.permissions?.includes('catalogue.view'));
  const canViewIncidents = Boolean(user?.isOwner || user?.permissions?.includes('inventory.view'));
  const canViewGovernanceTab = canViewAnnouncements || canViewIncidents;
  const [mainView, setMainView] = useState<MainView>('Inbox');
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [incDesc, setIncDesc] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [notifs, anns, incs] = await Promise.all([
        notificationsApi.getMy(),
        canViewAnnouncements ? governanceApi.listAnnouncements().catch(() => []) : Promise.resolve([]),
        canViewIncidents ? governanceApi.listIncidents().catch(() => []) : Promise.resolve([]),
      ]);
      setItems(
        (Array.isArray(notifs) ? notifs : []).map((n: Record<string, unknown>) => ({
          id: String(n.id),
          title: String(n.title || 'Notification'),
          body: String(n.body || n.message || ''),
          meta: n.createdAt ? new Date(String(n.createdAt)).toLocaleString('en-GH') : 'Recent',
          unread: !n.readAt,
        })),
      );
      setAnnouncements(
        (Array.isArray(anns) ? anns : []).map((a: Record<string, unknown>) => ({
          id: String(a.id),
          title: String(a.title || 'Announcement'),
          body: String(a.body || ''),
          publishedAt: a.createdAt
            ? new Date(String(a.createdAt)).toLocaleDateString('en-GH')
            : 'Published',
        })),
      );
      setIncidents(
        (Array.isArray(incs) ? incs : []).map((i: Record<string, unknown>) => ({
          id: String(i.id),
          reference: `INC-${String(i.id).slice(-5).toUpperCase()}`,
          description: String(i.title || i.notes || 'Incident'),
          status: String(i.status || 'OPEN'),
        })),
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [canViewAnnouncements, canViewIncidents]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unreadCount = items.filter((i) => i.unread).length;

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to mark read', 'error');
    }
  };

  const markAllRead = async () => {
    const unread = items.filter((i) => i.unread);
    await Promise.all(unread.map((i) => notificationsApi.markRead(i.id).catch(() => null)));
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
    showToast('All notifications marked read', 'info');
  };

  const handlePublishAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !annTitle.trim() || !annBody.trim()) return;
    setSubmitting(true);
    try {
      await governanceApi.createAnnouncement({
        title: annTitle.trim(),
        body: annBody.trim(),
      });
      setAnnTitle('');
      setAnnBody('');
      showToast('Announcement published', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to publish announcement', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportIncident = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !incDesc.trim()) return;
    setSubmitting(true);
    try {
      await governanceApi.createIncident({
        title: incDesc.trim(),
        severity: 'MEDIUM',
      });
      setIncDesc('');
      showToast('Incident logged', 'warning');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to log incident', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-node-id="9:60855" style={{ maxWidth: '100%', minWidth: 0 }}>
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Staff notifications &amp; communications
          </h1>
          <p className="dash-sub">
            {unreadCount} unread notifications · Announcements &amp; operational incidents.
          </p>
        </div>

        <div className="dash-actions">
          {unreadCount > 0 && mainView === 'Inbox' && (
            <button type="button" className="button" onClick={markAllRead}>
              <Check size={14} />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {canViewGovernanceTab && (
        <div className="ship-tabs-bar" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          {(['Inbox', 'Announcements & Incidents'] as const).map((view) => (
            <button
              key={view}
              type="button"
              className={`ship-tab-btn${mainView === view ? ' active' : ''}`}
              onClick={() => setMainView(view)}
            >
              {view}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadData} />
      ) : mainView === 'Inbox' ? (
        <section className="acct-panel" style={{ padding: 0, maxWidth: '100%', minWidth: 0 }}>
          {items.length === 0 ? (
            <EmptyState
              title="No notifications"
              description="You are all caught up on staff notifications."
            />
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 18px',
                  width: '100%',
                  minWidth: 0,
                  borderBottom: idx < items.length - 1 ? '0.8px solid var(--line)' : 0,
                  background: item.unread ? '#f7fbf9' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: '1 1 220px', minWidth: 0 }}>
                  <Bell size={16} color={item.unread ? 'var(--green)' : 'var(--muted)'} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <strong style={{ display: 'block', fontSize: 13.5 }}>{item.title}</strong>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-body)' }}>{item.body}</span>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      {item.meta}
                    </div>
                  </div>
                </div>
                {item.unread && (
                  <button
                    type="button"
                    className="button"
                    style={{ minHeight: 32, padding: '0 10px', fontSize: 12, flexShrink: 0 }}
                    onClick={() => markRead(item.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))
          )}
        </section>
      ) : (
        <div className="dash-grid" style={{ maxWidth: '100%', minWidth: 0 }}>
          <section className="acct-panel" style={{ minWidth: 0 }}>
            <div className="acct-panel-head">
              <div>
                <h2>Announcements</h2>
                <p>Storefront &amp; operations updates</p>
              </div>
              <Megaphone size={16} color="var(--green)" />
            </div>
            <form onSubmit={handlePublishAnnouncement} style={{ marginBottom: 16 }}>
              <label className="login-field">
                <span>Title</span>
                <input
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Announcement headline"
                  required
                />
              </label>
              <label className="login-field">
                <span>Message</span>
                <textarea
                  rows={2}
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  placeholder="Details for staff and customers…"
                  required
                  style={{
                    width: '100%',
                    border: '0.8px solid var(--line)',
                    borderRadius: 3,
                    padding: 10,
                    fontSize: 13,
                  }}
                />
              </label>
              <button type="submit" className="button primary" disabled={submitting}>
                Publish announcement
              </button>
            </form>
            {announcements.map((a) => (
              <div key={a.id} style={{ padding: '10px 0', borderTop: '0.8px solid var(--line)' }}>
                <strong style={{ fontSize: 13 }}>{a.title}</strong>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0' }}>{a.body}</p>
                <small style={{ fontSize: 11, color: 'var(--muted)' }}>{a.publishedAt}</small>
              </div>
            ))}
          </section>

          <section className="acct-panel">
            <div className="acct-panel-head">
              <div>
                <h2>Operational incidents</h2>
                <p>Report &amp; track warehouse incidents</p>
              </div>
              <AlertTriangle size={16} color="#b45309" />
            </div>
            <form onSubmit={handleReportIncident} style={{ marginBottom: 16 }}>
              <label className="login-field">
                <span>Incident summary</span>
                <textarea
                  rows={2}
                  value={incDesc}
                  onChange={(e) => setIncDesc(e.target.value)}
                  placeholder="Describe what happened…"
                  required
                  style={{
                    width: '100%',
                    border: '0.8px solid var(--line)',
                    borderRadius: 3,
                    padding: 10,
                    fontSize: 13,
                  }}
                />
              </label>
              <button type="submit" className="button primary" disabled={submitting}>
                Log incident
              </button>
            </form>
            {incidents.map((inc) => (
              <div
                key={inc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderTop: '0.8px solid var(--line)',
                }}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>{inc.reference}</strong>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{inc.description}</div>
                </div>
                <span className="acct-pill amber">● {inc.status}</span>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
