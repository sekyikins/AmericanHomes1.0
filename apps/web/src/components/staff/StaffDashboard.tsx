'use client';

import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  Clock,
  ShoppingBag,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DashboardSkeleton, ErrorState } from '@/components/ui';
import {
  adminApi,
  catalogueApi,
  paymentsApi,
  stocktakesApi,
} from '@/lib/api';
import { formatGhs } from '@/lib/staffUtils';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';
import { DashboardBottomGrid } from './dashboard/DashboardBottomGrid';
import {
  ReviewSensitiveActionModal,
  type SensitiveActionItem,
} from './ReviewSensitiveActionModal';

type ApprovalQueueItem = SensitiveActionItem & {
  id: string;
  kind: 'ADJUSTMENT' | 'PRICE' | 'PAYMENT';
  subtitle: string;
  age: string;
  tone: 'red' | 'amber';
};

type SalesBar = {
  day: string;
  amountCents: number;
  pct: number;
};

type DashboardSummary = {
  availableInventory: number;
  heldInventory: number;
  unavailableInventory: number;
  activeOrders: number;
  awaitingCollectionOrders: number;
  outstandingPaymentsCents: number | null;
  pendingApprovals: number;
  approvalQueue: ApprovalQueueItem[];
  salesActivity: {
    total7dCents: number;
    total30dCents: number;
    bars7d: SalesBar[];
    bars30d: SalesBar[];
  } | null;
  activeShipment: {
    id: string;
    reference: string;
    providerName: string;
    status: string;
    departureDate: string | null;
    estimatedArrival: string | null;
    manifestCount: number;
    receivedCount: number;
    discrepancyCount: number;
  } | null;
  operationalAlerts: {
    unexpectedHeldCount: number;
    expiringReservationsCount: number;
    expiringReservationsValueCents: number;
    failedInspectionCount: number;
  };
};

function formatCurrency(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return 'Restricted';
  return formatGhs(cents);
}

export function StaffDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesRange, setSalesRange] = useState<'7d' | '30d'>('7d');
  const [activeReview, setActiveReview] = useState<SensitiveActionItem | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = (await adminApi.dashboard()) as DashboardSummary;
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleDecision = async (
    item: SensitiveActionItem,
    decision: 'APPROVED' | 'REJECTED',
    note: string,
  ) => {
    if (!item.id) return;
    if (item.kind === 'ADJUSTMENT') {
      if (decision === 'APPROVED') {
        await stocktakesApi.approveAdjustment(item.id);
      } else {
        await stocktakesApi.rejectAdjustment(item.id, note.trim() || 'Rejected on dashboard');
      }
    } else if (item.kind === 'PRICE') {
      if (decision === 'APPROVED') {
        await catalogueApi.approvePrice(item.id);
      } else {
        throw new Error('Price proposal rejection is handled in Product Catalogue.');
      }
    } else if (item.kind === 'PAYMENT') {
      if (decision === 'APPROVED') {
        await paymentsApi.approveManual(item.id);
      } else {
        await paymentsApi.reverse(item.id, note.trim() || 'Rejected manual payment');
      }
    }
    showToast(
      `${item.title} (${item.reference}) ${decision === 'APPROVED' ? 'approved' : 'rejected'}`,
      decision === 'APPROVED' ? 'success' : 'warning',
    );
    await loadDashboard(true);
  };

  const todayLabel = new Date().toLocaleDateString('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const rawFirst = user?.name?.split(/[\s@]/)[0]?.replace(/\.+$/, '') || '';
  const firstName =
    rawFirst && /^(mr|mrs|ms|dr)$/i.test(rawFirst)
      ? user?.name?.replace(/\s*\([^)]*\)\s*$/, '').trim() || rawFirst
      : rawFirst || (user?.isOwner ? 'Owner' : 'Team');
  const approvals = summary?.approvalQueue ?? [];
  const totalNeedsAction =
    approvals.length +
    (summary?.operationalAlerts.unexpectedHeldCount ?? 0) +
    (summary?.operationalAlerts.expiringReservationsCount ?? 0) +
    (summary?.operationalAlerts.failedInspectionCount ?? 0);

  const bars =
    salesRange === '7d'
      ? (summary?.salesActivity?.bars7d ?? [])
      : (summary?.salesActivity?.bars30d ?? []);
  const salesTotalCents =
    salesRange === '7d'
      ? summary?.salesActivity?.total7dCents
      : summary?.salesActivity?.total30dCents;

  return (
    <div data-node-id="2:10186">
      <div className="dash-head">
        <div>
          <span className="dash-date">{todayLabel}</span>
          <h1 className="dash-title">Good morning, {firstName}.</h1>
          <p className="dash-sub">Here’s what needs your attention today.</p>
        </div>

        <div className="dash-actions">
          <button
            type="button"
            className="button"
            style={{ background: '#fff' }}
            onClick={() => setSalesRange((prev) => (prev === '7d' ? '30d' : '7d'))}
          >
            <Calendar size={14} />
            <span>{salesRange === '7d' ? 'Last 7 days' : 'Last 30 days'}</span>
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={loadDashboard} />
      ) : loading && !summary ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="dash-alert-bar">
            <div className="dash-alert-left">
              <AlertTriangle size={16} color="#b45309" />
              <span>
                <strong>
                  {totalNeedsAction} {totalNeedsAction === 1 ? 'item needs' : 'items need'} action
                </strong>{' '}
                · {approvals.length} approvals,{' '}
                {summary?.operationalAlerts.unexpectedHeldCount ?? 0} inventory exceptions and{' '}
                {summary?.operationalAlerts.expiringReservationsCount ?? 0} reservations expiring
                today.
              </span>
            </div>
            {approvals[0] ? (
              <button
                type="button"
                className="link"
                style={{ border: 0, background: 'transparent', padding: 0, color: '#92400e' }}
                onClick={() => setActiveReview(approvals[0])}
              >
                <span>Review queue</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <Link href="/staff/audit-logs" className="link" style={{ color: '#92400e' }}>
                <span>Audit logs</span>
                <ArrowRight size={14} />
              </Link>
            )}
          </div>

          <section className="dash-metrics" aria-label="Key metrics">
            <div className="dash-metric-card">
              <div className="dash-metric-head">
                <span className="dash-metric-icon green">
                  <Warehouse size={16} />
                </span>
                <span>Available inventory</span>
              </div>
              <strong>{summary?.availableInventory ?? 0}</strong>
              <small>{summary?.unavailableInventory ?? 0} unavailable</small>
            </div>

            <div className="dash-metric-card">
              <div className="dash-metric-head">
                <span className="dash-metric-icon green">
                  <Clock size={16} />
                </span>
                <span>Held inventory</span>
              </div>
              <strong>{summary?.heldInventory ?? 0}</strong>
              <small>Across reservations &amp; checkout</small>
            </div>

            <div className="dash-metric-card">
              <div className="dash-metric-head">
                <span className="dash-metric-icon green">
                  <ShoppingBag size={16} />
                </span>
                <span>Active orders</span>
              </div>
              <strong>{summary?.activeOrders ?? 0}</strong>
              <small>{summary?.awaitingCollectionOrders ?? 0} awaiting collection</small>
            </div>

            <div className="dash-metric-card">
              <div className="dash-metric-head">
                <span className="dash-metric-icon green">
                  <CircleDollarSign size={16} />
                </span>
                <span>Outstanding payments</span>
              </div>
              <strong>{formatCurrency(summary?.outstandingPaymentsCents)}</strong>
              <small>
                {summary?.outstandingPaymentsCents === null
                  ? 'Financial visibility restricted'
                  : 'Pending & partial balances'}
              </small>
            </div>
          </section>

          <div className="dash-grid">
            <section className="acct-panel">
              <div className="acct-panel-head">
                <div>
                  <h2>Sales activity</h2>
                  <p>Money received, not order value</p>
                </div>
                <select
                  className="dash-select"
                  aria-label="Sales range"
                  value={salesRange}
                  onChange={(e) => setSalesRange(e.target.value as '7d' | '30d')}
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </div>

              {summary?.salesActivity === null ? (
                <p style={{ color: 'var(--muted)', fontSize: 13, margin: '24px 0 8px' }}>
                  Financial totals are hidden for your account role.
                </p>
              ) : (
                <>
                  <div className="dash-sales-total">{formatCurrency(salesTotalCents ?? 0)}</div>
                  <div className="dash-sales-delta">
                    Verified receipts ({salesRange === '7d' ? 'last 7 days' : 'last 30 days'})
                  </div>

                  <div className="dash-bars" role="img" aria-label="Sales activity bar chart">
                    {bars.map((bar) => (
                      <div
                        key={bar.day}
                        className="dash-bar-col"
                        title={`${bar.day}: ${formatCurrency(bar.amountCents)}`}
                      >
                        <div className="dash-bar-track">
                          <div className="dash-bar-fill" style={{ height: `${bar.pct}%` }} />
                        </div>
                        <span>{bar.day}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="acct-panel">
              <div className="acct-panel-head">
                <div>
                  <h2>Pending approvals</h2>
                  <p>Actions requiring another user</p>
                </div>
                <Link href="/staff/audit-logs" className="link">
                  View all
                </Link>
              </div>

              {approvals.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13, margin: '24px 0 8px' }}>
                  All pending approvals have been reviewed.
                </p>
              ) : (
                <div className="dash-queue">
                  {approvals.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveReview(item)}
                      className="dash-queue-row"
                    >
                      <div className="dash-queue-left">
                        <span className={`dash-queue-icon ${item.tone}`}>
                          {item.tone === 'red' ? <AlertTriangle size={14} /> : <Clock size={14} />}
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.subtitle}</span>
                        </div>
                      </div>
                      <div className="dash-queue-right">
                        <span>{item.age}</span>
                        <ChevronRight size={14} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <DashboardBottomGrid
            activeShipment={summary?.activeShipment}
            operationalAlerts={summary?.operationalAlerts}
          />
        </>
      )}

      <ReviewSensitiveActionModal
        action={activeReview}
        onClose={() => setActiveReview(null)}
        onDecision={handleDecision}
      />
    </div>
  );
}
