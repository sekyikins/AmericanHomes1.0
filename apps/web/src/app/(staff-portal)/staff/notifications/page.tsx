'use client';

import { Button, ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { governanceApi, notificationsApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';
import {
  AlertTriangle,
  Bell,
  Check,
  Megaphone,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';

type MainView = 'Inbox' | 'Product polls' | 'Announcements & Incidents';

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

function StaffNotificationsContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const canViewAnnouncements = Boolean(user?.isOwner || user?.permissions?.includes('catalogue.view'));
  const canViewIncidents = Boolean(user?.isOwner || user?.permissions?.includes('inventory.view'));
  const canViewPolls = Boolean(user?.isOwner || user?.permissions?.includes('product_requests.review'));
  const canViewGovernanceTab = canViewAnnouncements || canViewIncidents || canViewPolls;
  const [mainView, setMainView] = useState<MainView>(() =>
    searchParams.get('tab') === 'polls' ? 'Product polls' : 'Inbox',
  );

  useEffect(() => {
    if (searchParams.get('tab') === 'polls') {
      setMainView('Product polls');
    }
  }, [searchParams]);
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [polls, setPolls] = useState<Array<{ id: string; title: string; description?: string | null; status: string; closesAt?: string | null; yesVotes?: number; noVotes?: number; _count?: { votes?: number } }>>([]);
  const [pollTitle, setPollTitle] = useState('');
  const [pollDesc, setPollDesc] = useState('');
  const [pollClosesAt, setPollClosesAt] = useState('');
  const [confirmClosePoll, setConfirmClosePoll] = useState<{ id: string; title: string } | null>(null);
  const [closingPoll, setClosingPoll] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [notifs, anns, incs, pollRows] = await Promise.all([
        notificationsApi.getMy(),
        canViewAnnouncements ? governanceApi.listAnnouncements().catch(() => []) : Promise.resolve([]),
        canViewIncidents ? governanceApi.listIncidents().catch(() => []) : Promise.resolve([]),
        canViewGovernanceTab ? governanceApi.listPolls().catch(() => []) : Promise.resolve([]),
      ]);
      setPolls(
        Array.isArray(pollRows)
          ? (pollRows as Array<{ id: string; title: string; description?: string | null; status: string; _count?: { votes?: number } }>)
          : [],
      );
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
          {(['Inbox', 'Product polls', 'Announcements & Incidents'] as const).map((view) => (
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
      ) : mainView === 'Product polls' ? (
        <section className="acct-panel">
          <div className="acct-panel-head">
            <div>
              <h2>Product polls</h2>
              <p>Create polls, review customer votes, and close completed polls</p>
            </div>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pollTitle.trim() || submitting) return;
              setSubmitting(true);
              try {
                await governanceApi.createPoll({
                  title: pollTitle.trim(),
                  description: pollDesc.trim() || undefined,
                  closesAt: pollClosesAt ? new Date(pollClosesAt).toISOString() : undefined,
                });
                setPollTitle('');
                setPollDesc('');
                setPollClosesAt('');
                showToast('Product poll created and customers notified', 'success');
                loadData(true);
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'Failed to create poll', 'error');
              } finally {
                setSubmitting(false);
              }
            }}
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}
          >
            <input
              value={pollTitle}
              onChange={(e) => setPollTitle(e.target.value)}
              placeholder="Poll question (e.g. Should we source Dyson V15 vacuums?)"
              required
              style={{ flex: '2 1 240px', padding: '10px 12px', border: '0.8px solid var(--line)', borderRadius: 4 }}
            />
            <input
              value={pollDesc}
              onChange={(e) => setPollDesc(e.target.value)}
              placeholder="Optional details / target price range"
              style={{ flex: '2 1 200px', padding: '10px 12px', border: '0.8px solid var(--line)', borderRadius: 4 }}
            />
            <input
              type="datetime-local"
              aria-label="Closing date and time"
              title="Closing date and time (optional)"
              value={pollClosesAt}
              onChange={(e) => setPollClosesAt(e.target.value)}
              style={{ flex: '1 1 190px', padding: '9px 10px', border: '0.8px solid var(--line)', borderRadius: 4, fontSize: 12.5 }}
            />
            <Button type="submit" variant="primary" loading={submitting} loadingText="Creating…">
              Create poll
            </Button>
          </form>
          {polls.length === 0 ? (
            <EmptyState
              title="No product polls yet"
              description="Create a poll above to gather customer demand before sourcing."
            />
          ) : (
            polls.map((poll) => (
              <div
                key={poll.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderTop: '0.8px solid var(--line)',
                }}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>{poll.title}</strong>
                  {poll.description && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{poll.description}</div>
                  )}
                  <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    {poll.yesVotes ?? 0} Yes · {poll.noVotes ?? 0} No ({poll._count?.votes ?? 0} total)
                    {poll.closesAt
                      ? ` · Closes ${new Date(poll.closesAt).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}`
                      : ''}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`acct-pill ${poll.status === 'OPEN' ? 'green' : 'gray'}`}>
                    {poll.status}
                  </span>
                  {poll.status === 'OPEN' && (
                    <Button
                      type="button"
                      variant="secondary"
                      style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}
                      onClick={() => setConfirmClosePoll({ id: poll.id, title: poll.title })}
                    >
                      Close
                    </Button>
                  )}
                </div>
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

          <section className="acct-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="acct-panel-head">
              <div>
                <h2>Product polls</h2>
                <p>Gauge customer demand before sourcing</p>
              </div>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!pollTitle.trim() || submitting) return;
                setSubmitting(true);
                try {
                  await governanceApi.createPoll({
                    title: pollTitle.trim(),
                    description: pollDesc.trim() || undefined,
                  });
                  setPollTitle('');
                  setPollDesc('');
                  showToast('Product poll created', 'success');
                  loadData(true);
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Failed to create poll', 'error');
                } finally {
                  setSubmitting(false);
                }
              }}
              style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}
            >
              <input
                value={pollTitle}
                onChange={(e) => setPollTitle(e.target.value)}
                placeholder="Poll question (e.g. Should we source Dyson V15 vacuums?)"
                required
                style={{ flex: '2 1 240px', padding: '10px 12px', border: '0.8px solid var(--line)', borderRadius: 4 }}
              />
              <input
                value={pollDesc}
                onChange={(e) => setPollDesc(e.target.value)}
                placeholder="Optional details / target price range"
                style={{ flex: '2 1 200px', padding: '10px 12px', border: '0.8px solid var(--line)', borderRadius: 4 }}
              />
              <button type="submit" className="button primary" disabled={submitting}>
                Create poll
              </button>
            </form>
            {polls.map((poll) => (
              <div
                key={poll.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderTop: '0.8px solid var(--line)',
                }}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>{poll.title}</strong>
                  {poll.description && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{poll.description}</div>
                  )}
                  <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {poll.yesVotes ?? 0} Yes · {poll.noVotes ?? 0} No ({poll._count?.votes ?? 0} total)
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`acct-pill ${poll.status === 'OPEN' ? 'green' : 'gray'}`}>
                    {poll.status}
                  </span>
                  {poll.status === 'OPEN' && (
                    <button
                      type="button"
                      className="button"
                      style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}
                      onClick={async () => {
                        try {
                          await governanceApi.closePoll(poll.id);
                          showToast('Poll closed', 'info');
                          loadData(true);
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : 'Failed to close poll', 'error');
                        }
                      }}
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmClosePoll)}
        title="Close product poll?"
        targetName={confirmClosePoll?.title}
        description="Customers will no longer be able to vote on this poll once closed."
        reversible={false}
        destructive={true}
        confirmLabel="Close poll"
        loading={closingPoll}
        onCancel={() => setConfirmClosePoll(null)}
        onConfirm={async () => {
          if (!confirmClosePoll || closingPoll) return;
          setClosingPoll(true);
          try {
            await governanceApi.closePoll(confirmClosePoll.id);
            showToast('Poll closed', 'info');
            setConfirmClosePoll(null);
            await loadData(true);
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to close poll', 'error');
          } finally {
            setClosingPoll(false);
          }
        }}
      />
    </div>
  );
}

export default function StaffNotificationsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <StaffNotificationsContent />
    </Suspense>
  );
}
