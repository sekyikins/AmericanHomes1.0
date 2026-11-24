'use client';

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  OrderPayBalanceModal,
  OrderReceiptModal,
  OrderReturnModal,
} from '@/components/customer/OrderActionModals';
import { BackLink, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { ordersApi, paymentsApi, returnsApi } from '@/lib/api';
import { mapCustomerOrders, type CustomerOrderRecord } from '@/lib/customerAccount';
import { formatGHS } from '@/lib/formatting/currency';
import { useToast } from '@/providers/toast.provider';

const FILTERS = ['All', 'Part paid', 'Paid', 'Ready for collection', 'Collected'] as const;

export default function OrdersPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<CustomerOrderRecord | null>(null);
  const [returnOrder, setReturnOrder] = useState<CustomerOrderRecord | null>(null);
  const [payOrder, setPayOrder] = useState<CustomerOrderRecord | null>(null);
  const [payChannel, setPayChannel] = useState<'paystack_momo' | 'paystack_card'>('paystack_momo');
  const [returnReason, setReturnReason] = useState('');
  const [returnLines, setReturnLines] = useState<Record<string, number>>({});
  const [returnSubmitted, setReturnSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const mapped = mapCustomerOrders(await ordersApi.getMy());
      setOrders(mapped);
      setExpandedId((prev) => prev ?? mapped[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!receiptOrder && !returnOrder && !payOrder) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReceiptOrder(null);
        setReturnOrder(null);
        setPayOrder(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [receiptOrder, returnOrder, payOrder]);

  const visible = orders.filter((o) => {
    if (filter === 'All') return true;
    return o.paymentStatus === filter || o.collectionStatus === filter;
  });

  const handlePayBalance = async (e: FormEvent) => {
    e.preventDefault();
    if (!payOrder || submitting) return;
    const outstanding = Math.max(0, payOrder.totalPesewas - payOrder.paidPesewas);
    if (outstanding <= 0) return;
    setSubmitting(true);
    try {
      const res = await paymentsApi.initialize({
        orderId: payOrder.id,
        amountCents: outstanding,
        channel: payChannel,
      });
      if (res.authorizationUrl && res.authorizationUrl !== 'stub') {
        window.location.href = res.authorizationUrl;
        return;
      }
      showToast(`Payment initialized for ${payOrder.reference}`, 'success');
      setPayOrder(null);
      await loadOrders(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to initialize payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!returnOrder || !returnReason.trim() || submitting) return;
    const lines = Object.entries(returnLines)
      .filter(([, q]) => q > 0)
      .map(([variantId, quantity]) => ({ variantId, quantity }));
    if (returnOrder.lines.length > 0 && lines.length === 0) {
      showToast('Please select at least one item to return', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await returnsApi.create({
        orderId: returnOrder.id,
        reason: returnReason.trim(),
        ...(lines.length > 0 ? { lines } : {}),
      });
      setReturnSubmitted(true);
      showToast(`Return request submitted for ${returnOrder.reference}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit return request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="acct-shell">
      <BackLink href="/account" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to account</span>
      </BackLink>

      <div className="acct-head">
        <div>
          <div className="eyebrow">My AmericanHomes</div>
          <h1 className="acct-title">Orders</h1>
        </div>
        <Link href="/shop" className="button primary">
          Continue shopping
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

      <section className="acct-panel" style={{ padding: '4px 24px' }}>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadOrders()} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No orders found"
            description={
              filter === 'All'
                ? 'Orders you place at checkout will appear here.'
                : 'No orders match this status filter.'
            }
            action={
              <Link href="/shop" className="button primary">
                Browse shop
              </Link>
            }
          />
        ) : (
          visible.map((order, idx) => {
            const outstanding = Math.max(0, order.totalPesewas - order.paidPesewas);
            const pct =
              order.totalPesewas > 0
                ? Math.min(100, Math.round((order.paidPesewas / order.totalPesewas) * 100))
                : 0;
            const isExpanded = expandedId === order.id;
            return (
              <div
                key={order.id}
                style={{
                  borderTop: idx === 0 ? 0 : '0.8px solid var(--line)',
                  padding: '22px 0',
                }}
              >
                <article className="acct-order-row" style={{ padding: 0, borderTop: 0 }}>
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

                  <div className="acct-order-pay">
                    <div className="acct-pay-line">
                      <span>Amount paid</span>
                      <strong>{formatGHS(order.paidPesewas)}</strong>
                    </div>
                    <div className="acct-progress">
                      <div className="acct-progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="acct-pay-line">
                      <span>Outstanding</span>
                      <strong>{formatGHS(outstanding)}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {outstanding > 0 && order.collectionStatus !== 'Cancelled' ? (
                        <button
                          type="button"
                          className="button primary"
                          style={{ flex: 1, minHeight: 36, fontSize: 12 }}
                          onClick={() => setPayOrder(order)}
                        >
                          <CreditCard size={13} /> Pay balance
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button"
                          style={{ flex: 1, minHeight: 36, fontSize: 12 }}
                          onClick={() => setReceiptOrder(order)}
                        >
                          <FileText size={13} /> Receipt
                        </button>
                      )}
                      {order.collectionStatus === 'Collected' && (
                        <button
                          type="button"
                          className="button"
                          style={{ minHeight: 36, padding: '0 10px', fontSize: 12 }}
                          onClick={() => {
                            setReturnSubmitted(false);
                            setReturnReason('');
                            const initLines: Record<string, number> = {};
                            if (order.lines[0]?.variantId) initLines[order.lines[0].variantId] = 1;
                            setReturnLines(initLines);
                            setReturnOrder(order);
                          }}
                        >
                          <RotateCcw size={13} /> Request return / exchange
                        </button>
                      )}
                      <button
                        type="button"
                        className="button"
                        aria-expanded={isExpanded}
                        style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }}
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      >
                        <span>Details</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                </article>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: '12px 16px',
                      background: 'var(--paper)',
                      border: '0.8px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12.5,
                      color: 'var(--nav-muted)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={15} color="var(--green)" />
                      {order.collectionNote}
                    </span>
                    <Link href="/policies/collection" className="link" style={{ fontSize: 12 }}>
                      Collection guide
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {receiptOrder && (
        <OrderReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}

      {returnOrder && (
        <OrderReturnModal
          order={returnOrder}
          submitted={returnSubmitted}
          reason={returnReason}
          setReason={setReturnReason}
          selectedLines={returnLines}
          onToggleLine={(variantId, maxQty) => {
            setReturnLines((prev) => {
              const cur = prev[variantId] ?? 0;
              if (cur > 0) {
                const next = { ...prev };
                delete next[variantId];
                return next;
              }
              return { ...prev, [variantId]: Math.min(1, maxQty) };
            });
          }}
          onLineQtyChange={(variantId, qty) => {
            setReturnLines((prev) => ({ ...prev, [variantId]: qty }));
          }}
          submitting={submitting}
          onSubmit={handleReturnSubmit}
          onClose={() => setReturnOrder(null)}
        />
      )}

      {payOrder && (
        <OrderPayBalanceModal
          order={payOrder}
          channel={payChannel}
          setChannel={setPayChannel}
          submitting={submitting}
          onSubmit={handlePayBalance}
          onClose={() => setPayOrder(null)}
        />
      )}
    </main>
  );
}
