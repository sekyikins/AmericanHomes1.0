'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { requestsApi } from '@/lib/api';
import { mapCustomerRequests, type CustomerRequestRecord } from '@/lib/customerAccount';
import { formatGHS } from '@/lib/formatting/currency';
import { useToast } from '@/providers/toast.provider';

const FILTERS = ['All', 'Under review', 'Sourcing', 'Allocated', 'Declined'] as const;

export default function ProductRequestsPage() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<CustomerRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [confirmWithdraw, setConfirmWithdraw] = useState<CustomerRequestRecord | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await requestsApi.getMy();
      setRequests(mapCustomerRequests(res));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your product requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const visible =
    filter === 'All' ? requests : requests.filter((req) => req.status === filter);

  const handleWithdraw = async () => {
    if (!confirmWithdraw || withdrawing) return;
    setWithdrawing(true);
    try {
      const res = await requestsApi.withdraw(confirmWithdraw.id, 'Withdrawn by customer');
      showToast(
        res?.message ?? `Request ${confirmWithdraw.reference} withdrawn`,
        res?.requiresManagementReview ? 'info' : 'warning',
      );
      setConfirmWithdraw(null);
      await loadRequests();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to withdraw request', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  const pillTone = (status: CustomerRequestRecord['status']) => {
    if (status === 'Allocated' || status === 'Accepted') return 'green';
    if (status === 'Sourcing') return 'blue';
    if (status === 'Under review') return 'amber';
    return 'gray';
  };

  return (
    <main className="acct-shell">
      <Link href="/account" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to account</span>
      </Link>

      <div className="acct-head">
        <div>
          <div className="eyebrow">My AmericanHomes</div>
          <h1 className="acct-title">Product requests</h1>
        </div>
        <Link href="/request-product" className="button primary">
          <Plus size={15} />
          <span>New request</span>
        </Link>
      </div>

      <div className="notif-tabs" role="tablist">
        {FILTERS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filter === tab}
            onClick={() => setFilter(tab)}
            className={`notif-tab ${filter === tab ? 'active' : ''}`}
          >
            <span>{tab}</span>
          </button>
        ))}
      </div>

      <section className="acct-panel" style={{ padding: '8px 24px' }}>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadRequests} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No product requests found"
            description={
              filter === 'All'
                ? 'Submit a request for any product you want us to source from the US.'
                : 'No product requests match this status filter.'
            }
            action={
              <Link href="/request-product" className="button primary">
                New request
              </Link>
            }
          />
        ) : (
          visible.map((req, idx) => (
            <article
              key={req.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 20,
                padding: '20px 0',
                borderTop: idx === 0 ? 0 : '0.8px solid var(--line)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 260 }}>
                <span className="acct-order-ref">
                  {req.reference} · Submitted {req.submittedAt}
                </span>
                <h3 style={{ fontSize: 16, margin: '4px 0', color: 'var(--ink)' }}>
                  {req.productName}
                </h3>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
                  {req.description}
                </p>
                <div className="acct-pills" style={{ marginTop: 10 }}>
                  <span className={`acct-pill ${pillTone(req.status)}`}>● {req.status}</span>
                  <span className="acct-pill gray">Qty: {req.quantity}</span>
                  {req.budgetPesewas && (
                    <span className="acct-pill gray">
                      Budget: {formatGHS(req.budgetPesewas)}
                    </span>
                  )}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--nav-muted)' }}>
                  {req.updateNote}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {req.status === 'Under review' && (
                  <button
                    type="button"
                    className="button"
                    style={{ fontSize: 12 }}
                    onClick={() => setConfirmWithdraw(req)}
                  >
                    Withdraw request
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmWithdraw)}
        title="Withdraw product request?"
        targetName={
          confirmWithdraw ? `${confirmWithdraw.reference} · ${confirmWithdraw.productName}` : undefined
        }
        description="This will withdraw your sourcing request if sourcing has not yet committed."
        reversible={false}
        destructive={true}
        confirmLabel="Withdraw request"
        loading={withdrawing}
        onCancel={() => setConfirmWithdraw(null)}
        onConfirm={handleWithdraw}
      />
    </main>
  );
}
