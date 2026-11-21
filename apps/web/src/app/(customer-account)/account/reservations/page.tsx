'use client';

import { ArrowLeft, Clock, CreditCard, Info, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { ordersApi, paymentsApi, reservationsApi } from '@/lib/api';
import {
  mapCustomerReservations,
  type CustomerReservationRecord,
} from '@/lib/customerAccount';
import { formatGHS } from '@/lib/formatting/currency';
import { useToast } from '@/providers/toast.provider';

const FILTERS = ['All', 'Approved', 'Pending review', 'Expired'] as const;

export default function ReservationsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<CustomerReservationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [confirmCancel, setConfirmCancel] = useState<CustomerReservationRecord | null>(null);
  const [payReservation, setPayReservation] = useState<CustomerReservationRecord | null>(null);
  const [payChannel, setPayChannel] = useState<'paystack_momo' | 'paystack_card'>('paystack_momo');
  const [submitting, setSubmitting] = useState(false);

  const loadReservations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await reservationsApi.getMy();
      setItems(mapCustomerReservations(res));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your reservations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    if (!payReservation) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPayReservation(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [payReservation]);

  const visible =
    filter === 'All' ? items : items.filter((item) => item.status === filter);

  const cancelReservation = async (res: CustomerReservationRecord) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await reservationsApi.cancel(res.id);
      showToast(`Hold ${res.reference} cancelled and stock released`, 'warning');
      setConfirmCancel(null);
      await loadReservations(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to cancel reservation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayReservation = async (e: FormEvent) => {
    e.preventDefault();
    if (!payReservation || submitting) return;
    setSubmitting(true);
    try {
      const { order } = await ordersApi.checkout({
        items: [{ variantId: payReservation.variantId, quantity: payReservation.quantity }],
        disclosedDefectsAcknowledged: true,
        notes: `Reservation ${payReservation.reference}`,
      });
      const res = await paymentsApi.initialize({
        orderId: order.id,
        amountCents: order.totalCents,
        channel: payChannel,
      });
      if (res.authorizationUrl && res.authorizationUrl !== 'stub') {
        window.location.href = res.authorizationUrl;
        return;
      }
      showToast(
        `Order ${order.reference || payReservation.reference} created. Check My Orders for collection status.`,
        'success',
      );
      setPayReservation(null);
      await loadReservations(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to process reservation payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const pillTone = (status: CustomerReservationRecord['status']) => {
    if (status === 'Approved') return 'green';
    if (status === 'Pending review') return 'amber';
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
          <h1 className="acct-title">Reservations</h1>
        </div>
        <Link href="/shop" className="button primary">
          Browse available stock
        </Link>
      </div>

      <div className="request-info-banner" style={{ marginBottom: 22 }}>
        <Info size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Approved reservations hold stock for 48 hours. Unpaid holds expire automatically and
          return items to shared availability.
        </span>
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
          <ErrorState message={error} onRetry={() => loadReservations()} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No reservations found"
            description={
              filter === 'All'
                ? 'Reserve any available product from the shop to hold stock while arranging payment.'
                : 'No reservations match this status filter.'
            }
            action={
              <Link href="/shop" className="button primary">
                Browse shop
              </Link>
            }
          />
        ) : (
          visible.map((res, idx) => (
            <article
              key={res.id}
              className="acct-order-row"
              style={{ borderTop: idx === 0 ? 0 : '0.8px solid var(--line)' }}
            >
              <img src={res.image} alt="" className="acct-order-img" />
              <div className="acct-order-info">
                <span className="acct-order-ref">{res.reference}</span>
                <Link href={`/shop/${res.productId}`}>
                  <h3>{res.productName}</h3>
                </Link>
                <span className="acct-order-meta">
                  Qty: {res.quantity} · {formatGHS(res.pricePesewas)}
                </span>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>{res.note}</p>
                <div className="acct-pills">
                  <span className={`acct-pill ${pillTone(res.status)}`}>● {res.status}</span>
                  {res.countdown && (
                    <span className="acct-pill amber">
                      <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      {res.countdown}
                    </span>
                  )}
                </div>
              </div>

              <div className="acct-order-pay" style={{ justifyContent: 'center', gap: 8 }}>
                {res.status === 'Approved' && (
                  <button
                    type="button"
                    className="button primary"
                    style={{ minHeight: 38 }}
                    onClick={() => setPayReservation(res)}
                  >
                    <CreditCard size={14} /> Pay {formatGHS(res.pricePesewas)}
                  </button>
                )}
                {(res.status === 'Approved' || res.status === 'Pending review') && (
                  <button
                    type="button"
                    className="button"
                    style={{ minHeight: 36, fontSize: 12 }}
                    onClick={() => setConfirmCancel(res)}
                  >
                    Cancel hold
                  </button>
                )}
                {(res.status === 'Expired' || res.status === 'Cancelled') && (
                  <Link
                    href={`/shop/${res.productId}`}
                    className="button"
                    style={{ minHeight: 36, fontSize: 12 }}
                  >
                    View item
                  </Link>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmCancel)}
        title="Cancel reservation hold?"
        targetName={confirmCancel ? `${confirmCancel.reference} · ${confirmCancel.productName}` : undefined}
        description="Cancelling this hold will immediately release the reserved stock back to shared inventory."
        reversible={false}
        destructive={true}
        confirmLabel="Cancel hold"
        loading={submitting}
        onCancel={() => setConfirmCancel(null)}
        onConfirm={() => {
          if (confirmCancel) cancelReservation(confirmCancel);
        }}
      />

      {payReservation && (
        <div
          className="login-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Pay reservation"
          onClick={() => setPayReservation(null)}
        >
          <div className="login-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="login-close"
              aria-label="Close payment modal"
              onClick={() => setPayReservation(null)}
            >
              <X size={17} />
            </button>
            <div className="login-inner">
              <div className="eyebrow">Paystack checkout</div>
              <h2 className="login-title" style={{ fontSize: 24 }}>
                Complete reservation payment
              </h2>
              <p className="login-subtitle">
                {payReservation.reference} · {payReservation.productName} ·{' '}
                <strong>{formatGHS(payReservation.pricePesewas)}</strong>
              </p>
              <form onSubmit={handlePayReservation} className="login-form">
                <label className="req-checkbox-row" style={{ marginBottom: 10 }}>
                  <input
                    type="radio"
                    name="res-pay-channel"
                    checked={payChannel === 'paystack_momo'}
                    onChange={() => setPayChannel('paystack_momo')}
                  />
                  <span>Mobile Money (MTN, Telecel, AT)</span>
                </label>
                <label className="req-checkbox-row" style={{ marginBottom: 18 }}>
                  <input
                    type="radio"
                    name="res-pay-channel"
                    checked={payChannel === 'paystack_card'}
                    onChange={() => setPayChannel('paystack_card')}
                  />
                  <span>Debit / Credit Card</span>
                </label>
                <button
                  type="submit"
                  className="button primary login-submit"
                  disabled={submitting}
                >
                  {submitting ? 'Processing…' : `Pay ${formatGHS(payReservation.pricePesewas)}`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
