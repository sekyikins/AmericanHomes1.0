'use client';

import {
  RecordPaymentModal,
  ReviewPaymentModal,
  type PaymentAccountsInfo,
} from '@/components/staff/payments/PaymentModals';
import { StaffFilterDropdown } from '@/components/staff/StaffFilterDropdown';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { governanceApi, ordersApi, paymentsApi } from '@/lib/api';
import { downloadCsv, formatStatusLabel, shortRef } from '@/lib/staffUtils';
import { useToast } from '@/providers/toast.provider';
import {
  ChevronRight,
  Download,
  Plus,
  Search,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';

type PaymentRow = {
  id: string;
  reference: string;
  orderReference: string;
  orderPaymentStatus: string;
  customer: string;
  source: 'Online' | 'Walk-in';
  amount: string;
  status: string;
  paymentTone: 'amber' | 'gray' | 'green';
  method: string;
  date: string;
};

type OrderOption = {
  id: string;
  reference: string;
  customer: string;
  totalCents: number;
  verifiedPaidCents: number;
  remainingCents: number;
  paymentStatus: string;
};

function StaffPaymentsContent() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Online' | 'Walk-in'>('All');
  const [modalMode, setModalMode] = useState<'create' | 'review' | null>(null);
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'APPROVE' | 'REVERSE' | null>(null);

  const [orderId, setOrderId] = useState('');
  const [amountGhs, setAmountGhs] = useState('');
  const [method, setMethod] = useState('MOBILE_MONEY');
  const [providerRef, setProviderRef] = useState('');
  const [reverseReason, setReverseReason] = useState('');

  const loadOrders = useCallback(async (preferredOrderId?: string | null) => {
    const [ordList, accounts] = await Promise.all([
      ordersApi.list().catch(() => []),
      governanceApi.getPaymentAccounts().catch(() => null),
    ]);
    if (accounts) setPaymentAccounts(accounts);
    const opts: OrderOption[] = (Array.isArray(ordList) ? ordList : [])
      .filter((o: Record<string, unknown>) => String(o.orderStatus ?? '').toUpperCase() !== 'CANCELLED')
      .map((o: Record<string, unknown>) => {
        const customer = o.customer as { user?: { name?: string; phone?: string } } | undefined;
        const totalCents = Number(o.totalCents ?? 0);
        const orderPayments = (Array.isArray(o.payments) ? o.payments : []) as Array<{
          status?: string;
          amountCents?: number;
        }>;
        const verifiedPaidCents = orderPayments
          .filter((p) => p.status === 'VERIFIED')
          .reduce((s, p) => s + Number(p.amountCents ?? 0), 0);
        const remainingCents = Math.max(0, totalCents - verifiedPaidCents);
        return {
          id: String(o.id),
          reference: shortRef(String(o.reference || o.id), 'ORD'),
          customer: customer?.user?.name || customer?.user?.phone || 'Walk-in',
          totalCents,
          verifiedPaidCents,
          remainingCents,
          paymentStatus: String(o.paymentStatus || 'PENDING'),
        };
      })
      .filter((o) => o.remainingCents > 0);
    setOrders(opts);
    const chosen = (preferredOrderId ? opts.find((o) => o.id === preferredOrderId) : undefined) ?? opts[0];
    if (chosen) {
      setOrderId(chosen.id);
      setAmountGhs((chosen.remainingCents / 100).toFixed(2));
    } else {
      setOrderId('');
      setAmountGhs('');
    }
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const payList = await paymentsApi.list();
      const mapped: PaymentRow[] = (
        Array.isArray(payList) ? payList : []
      ).map((p: Record<string, unknown>) => {
        const order = p.order as {
          reference?: string;
          source?: string;
          paymentStatus?: string;
          customer?: { user?: { name?: string; phone?: string } };
        } | undefined;
        const status = String(p.status || 'PENDING');
        return {
          id: String(p.id),
          reference: shortRef(String(p.reference || `PAY-${String(p.id).slice(-6).toUpperCase()}`), 'PAY'),
          orderReference: shortRef(order?.reference || String(p.orderId), 'ORD'),
          orderPaymentStatus: String(order?.paymentStatus || 'PENDING'),
          customer:
            String(p.payerName || '') ||
            order?.customer?.user?.name ||
            order?.customer?.user?.phone ||
            'Customer',
          source: String(order?.source ?? 'ONLINE').toUpperCase() === 'WALK_IN' ? 'Walk-in' : 'Online',
          amount: `GHS ${(Number(p.amountCents ?? 0) / 100).toLocaleString()}`,
          status,
          paymentTone:
            status === 'VERIFIED' ? 'green' : status === 'PENDING' || status === 'PARTIAL' ? 'amber' : 'gray',
          method: String(p.method || 'MANUAL').replace(/_/g, ' '),
          date: p.createdAt ? new Date(String(p.createdAt)).toLocaleDateString('en-GH') : 'Recent',
        };
      });
      setRows(mapped);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const recordOrderId = searchParams.get('recordOrderId');
    if (recordOrderId) {
      loadOrders(recordOrderId).then(() => setModalMode('create'));
    }
  }, [searchParams, loadOrders]);

  const visible = rows.filter((r) => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (sourceFilter !== 'All' && r.source !== sourceFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.reference.toLowerCase().includes(q) ||
      r.orderReference.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q)
    );
  });

  const selectedOrderOption = orders.find((o) => o.id === orderId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !orderId) return;
    const numeric = Number(amountGhs.replace(/[^0-9.]/g, '')) || 0;
    if (numeric <= 0) {
      showToast('Enter a positive payment amount in GHS', 'warning');
      return;
    }
    const amountCents = Math.round(numeric * 100);
    if (selectedOrderOption && amountCents > selectedOrderOption.remainingCents) {
      showToast(
        `Amount exceeds remaining balance of GHS ${(selectedOrderOption.remainingCents / 100).toLocaleString()}. Refund any excess cash to the customer.`,
        'warning',
      );
      return;
    }
    setSubmitting(true);
    try {
      await paymentsApi.recordManual({
        orderId,
        amountCents,
        method,
        reference: providerRef.trim() || undefined,
      });
      setModalMode(null);
      setAmountGhs('');
      setProviderRef('');
      showToast('Manual payment recorded for approval', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record manual payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!selected || !confirmAction || submitting) return;
    setSubmitting(true);
    try {
      if (confirmAction === 'APPROVE') {
        await paymentsApi.approveManual(selected.id);
        showToast(`Payment ${selected.reference} approved`, 'success');
      } else {
        await paymentsApi.reverse(selected.id, reverseReason.trim() || 'Reversed by manager');
        showToast(`Payment ${selected.reference} reversed`, 'warning');
      }
      setConfirmAction(null);
      setModalMode(null);
      setReverseReason('');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to process payment action', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-node-id="26:65243">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Payments
          </h1>
          <p className="dash-sub">
            Verify Paystack payments and approve manual entries.
          </p>
        </div>

        <button
          type="button"
          className="button primary"
          onClick={() => {
            setModalMode('create');
            loadOrders();
          }}
        >
          <Plus size={15} />
          <span>Record manual payment</span>
        </button>
      </div>

      <div className="ship-tabs-bar" style={{ marginBottom: 16 }}>
        {(['All', 'Online', 'Walk-in'] as const).map((ch) => (
          <button
            key={ch}
            type="button"
            className={`ship-tab-btn${sourceFilter === ch ? ' active' : ''}`}
            onClick={() => setSourceFilter(ch)}
          >
            {ch === 'All' ? 'All payments' : `${ch}`}
          </button>
        ))}
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payment ref, order or customer…"
            aria-label="Search payment ref, order or customer"
          />
        </label>

        <StaffFilterDropdown
          label="Status"
          value={statusFilter}
          options={['All', 'PENDING', 'PARTIAL', 'VERIFIED', 'FAILED', 'REFUNDED', 'EXCEPTION']}
          onChange={setStatusFilter}
        />

        <button
          type="button"
          className="button"
          style={{ background: '#fff' }}
          onClick={() =>
            downloadCsv(
              'payments.csv',
              ['Reference', 'Order', 'Customer', 'Amount', 'Method', 'Status', 'Date'],
              visible.map((r) => [
                r.reference,
                r.orderReference,
                r.customer,
                r.amount,
                r.method,
                r.status,
                r.date,
              ]),
            )
          }
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>

      <section className="acct-panel" style={{ padding: 0 }}>
        <div className="staff-table-head staff-sales-cols">
          <span>REFERENCE</span>
          <span>CUSTOMER</span>
          <span>AMOUNT</span>
          <span>STATUS</span>
          <span>METHOD</span>
          <span>DATE</span>
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadData} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No payments found"
            description="No payment records match your current search or filter."
          />
        ) : (
          visible.map((r) => (
            <button
              key={r.id}
              type="button"
              className="staff-table-row staff-sales-cols"
              onClick={() => {
                setSelected(r);
                setModalMode('review');
              }}
            >
              <div>
                <strong>{r.reference}</strong>
                <small>
                  {r.orderReference} · Order {formatStatusLabel(r.orderPaymentStatus)}
                </small>
              </div>
              <div>
                <span className="staff-cell-text">{r.customer}</span>
                <small style={{ display: 'block', marginTop: 2 }}>
                  <span className={`acct-pill ${r.source === 'Online' ? 'green' : 'blue'}`}>
                    {r.source}
                  </span>
                </small>
              </div>
              <span className="staff-cell-text">{r.amount}</span>
              <div>
                <span className={`acct-pill ${r.paymentTone}`}>● {formatStatusLabel(r.status)}</span>
              </div>
              <span className="staff-cell-muted">{formatStatusLabel(r.method)}</span>
              <span className="staff-cell-muted">{r.date}</span>
              <ChevronRight size={15} color="var(--green)" />
            </button>
          ))
        )}
      </section>

      <RecordPaymentModal
        open={modalMode === 'create'}
        orders={orders}
        orderId={orderId}
        selectedOrderOption={selectedOrderOption}
        amountGhs={amountGhs}
        method={method}
        providerRef={providerRef}
        paymentAccounts={paymentAccounts}
        submitting={submitting}
        onOrderChange={(nextId) => {
          const nextOrd = orders.find((o) => o.id === nextId);
          setOrderId(nextId);
          if (nextOrd) {
            setAmountGhs(
              nextOrd.remainingCents > 0
                ? (nextOrd.remainingCents / 100).toFixed(2)
                : '',
            );
          }
        }}
        onAmountChange={setAmountGhs}
        onMethodChange={(nextMethod) => {
          setMethod(nextMethod);
          if (nextMethod === 'CASH') setProviderRef('');
        }}
        onProviderRefChange={setProviderRef}
        onSubmit={handleSubmit}
        onClose={() => setModalMode(null)}
      />

      <ReviewPaymentModal
        open={modalMode === 'review'}
        selected={selected}
        reverseReason={reverseReason}
        onReverseReasonChange={setReverseReason}
        onConfirmAction={(action) => setConfirmAction(action)}
        onClose={() => setModalMode(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmAction && selected)}
        title={
          confirmAction === 'APPROVE'
            ? 'Approve manual payment?'
            : 'Reverse verified payment?'
        }
        targetName={selected ? `${selected.reference} · ${selected.amount}` : undefined}
        description={
          confirmAction === 'APPROVE'
            ? 'Approving marks this payment verified and updates the order payment status.'
            : 'Reversing this payment marks it refunded/reversed and updates the order balance.'
        }
        reversible={false}
        destructive={confirmAction === 'REVERSE'}
        confirmLabel={confirmAction === 'APPROVE' ? 'Approve payment' : 'Reverse payment'}
        loading={submitting}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

export default function StaffPaymentsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <StaffPaymentsContent />
    </Suspense>
  );
}
