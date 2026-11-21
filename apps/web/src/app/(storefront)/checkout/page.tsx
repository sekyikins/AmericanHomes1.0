'use client';

import { ArrowLeft, ArrowRight, Clock, CreditCard, ShieldCheck, User, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OrderConfirmedCard } from '@/components/storefront/OrderConfirmedModal';
import { ordersApi, paymentsApi } from '@/lib/api';
import { formatGHS } from '@/lib/formatting/currency';
import { useAuth } from '@/store/auth.store';
import { useCart } from '@/store/cart.store';

export default function CheckoutPage() {
  const { items, subtotalPesewas, clearCart } = useCart();
  const { user, setLoginOpen } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const [channel, setChannel] = useState<'paystack_momo' | 'paystack_card'>('paystack_momo');
  const [confirmedRef, setConfirmedRef] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [defectsAcknowledged, setDefectsAcknowledged] = useState(false);

  const disclosedDefectItems = Array.from(
    new Map(
      items
        .filter((item) => Boolean(item.defectDisclosures?.trim()))
        .map((item) => [item.id, item]),
    ).values(),
  );
  const hasDisclosedDefects = disclosedDefectItems.length > 0;

  useEffect(() => {
    if (items.length === 0 || confirmedRef) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [items.length, confirmedRef]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  if (confirmedRef) {
    return (
      <main className="page-shell" style={{ display: 'flex', justifyContent: 'center' }}>
        <OrderConfirmedCard orderRef={confirmedRef} />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="acct-shell" style={{ maxWidth: 640, textAlign: 'center' }}>
        <div className="eyebrow">Checkout</div>
        <h1 className="acct-title" style={{ marginTop: 10 }}>
          Your bag is empty
        </h1>
        <p style={{ color: 'var(--muted)', margin: '12px 0 24px' }}>
          Add inspected products from the shop before proceeding to checkout.
        </p>
        <Link href="/shop" className="button primary">
          Browse products <ArrowRight size={15} />
        </Link>
      </main>
    );
  }

  const handlePay = async () => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (hasDisclosedDefects && !defectsAcknowledged) {
      setCheckoutError('Please acknowledge the disclosed item conditions before paying.');
      return;
    }
    setCheckoutError(null);
    setSubmitting(true);
    try {
      const counts = new Map<string, number>();
      for (const item of items) {
        counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
      }
      const { order } = await ordersApi.checkout({
        items: Array.from(counts.entries()).map(([variantId, quantity]) => ({ variantId, quantity })),
        disclosedDefectsAcknowledged: hasDisclosedDefects ? defectsAcknowledged : false,
      });
      const res = await paymentsApi.initialize({
        orderId: order.id,
        amountCents: order.totalCents,
        channel,
      });
      if (res.authorizationUrl && res.authorizationUrl !== 'stub') {
        clearCart();
        window.location.href = res.authorizationUrl;
        return;
      }
      clearCart();
      setConfirmedRef(order.reference || res.reference);
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Unable to complete checkout. Please verify stock and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="acct-shell">
      <Link href="/shop" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to shop</span>
      </Link>

      <div className="acct-head">
        <div>
          <div className="eyebrow">Checkout</div>
          <h1 className="acct-title">Review &amp; pay</h1>
        </div>
        <span className="acct-pill amber" style={{ fontSize: 12, padding: '6px 12px' }}>
          <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Stock hold expires in {mins}:{secs}
        </span>
      </div>

      <div className="acct-main-grid">
        <div className="acct-side-col">
          <section className="acct-panel">
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>1. Customer account</h2>
            {user ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: 14 }}>{user.name ?? 'Customer'}</strong>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{user.phone}</span>
                </div>
                <span className="bag-stock-pill" style={{ marginTop: 0 }}>
                  ● Verified
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  Sign in with your phone number to link this order and receive collection updates.
                </p>
                <button type="button" className="button primary" onClick={() => setLoginOpen(true)}>
                  <User size={15} /> Sign in
                </button>
              </div>
            )}
          </section>

          <section className="acct-panel">
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>2. Warehouse collection</h2>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Warehouse size={18} color="var(--green)" style={{ marginTop: 2 }} />
              <div>
                <strong style={{ display: 'block', fontSize: 13.5 }}>
                  AmericanHomes Tema Warehouse (Free)
                </strong>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  Community 25, Tema · Mon–Sat, 9am–6pm. Collection is tracked separately after
                  payment verification.
                </span>
              </div>
            </div>
          </section>

          <section className="acct-panel">
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>3. Payment method (Paystack)</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  border: `1px solid ${channel === 'paystack_momo' ? 'var(--green)' : 'var(--line)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="paystack-channel"
                  checked={channel === 'paystack_momo'}
                  onChange={() => setChannel('paystack_momo')}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: 13 }}>Mobile Money (MTN / Telecel / AT)</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    Verified server-side via Paystack
                  </span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  border: `1px solid ${channel === 'paystack_card' ? 'var(--green)' : 'var(--line)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="paystack-channel"
                  checked={channel === 'paystack_card'}
                  onChange={() => setChannel('paystack_card')}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: 13 }}>Debit / Credit Card</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    Visa &amp; Mastercard processed via Paystack
                  </span>
                </div>
              </label>
            </div>
          </section>
        </div>

        <aside className="bag-summary" style={{ border: '0.8px solid var(--line)' }}>
          <h3>Order summary ({items.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {Array.from(
              items.reduce((map, item) => {
                const key = `${item.id}::${item.variant}`;
                const existing = map.get(key);
                if (existing) {
                  existing.qty += 1;
                } else {
                  map.set(key, { item, qty: 1 });
                }
                return map;
              }, new Map<string, { item: (typeof items)[number]; qty: number }>()).entries(),
            ).map(([key, { item, qty }]) => (
              <div
                key={key}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}
              >
                <span>
                  {qty > 1 ? `${qty} × ` : ''}
                  {item.name} ({item.variant})
                </span>
                <strong>{formatGHS(item.pricePesewas * qty)}</strong>
              </div>
            ))}
          </div>

          <div className="bag-summary-row">
            <span>Subtotal</span>
            <strong>{formatGHS(subtotalPesewas)}</strong>
          </div>
          <div className="bag-summary-row">
            <span>Warehouse collection</span>
            <strong>Free</strong>
          </div>
          <div className="bag-summary-total">
            <span>Total</span>
            <strong>{formatGHS(subtotalPesewas)}</strong>
          </div>

          {hasDisclosedDefects && (
            <div
              style={{
                border: '1px solid #f0c36d',
                background: '#fffaf0',
                padding: '12px 14px',
                marginBottom: 14,
                fontSize: 12.5,
              }}
            >
              <strong style={{ display: 'block', marginBottom: 6, color: '#7a4f01' }}>
                Disclosed item conditions
              </strong>
              <ul style={{ margin: '0 0 10px 16px', padding: 0, color: '#5c3c00' }}>
                {disclosedDefectItems.map((item) => (
                  <li key={item.id} style={{ marginBottom: 4 }}>
                    <strong>{item.name}:</strong> {item.defectDisclosures}
                  </li>
                ))}
              </ul>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={defectsAcknowledged}
                  onChange={(e) => setDefectsAcknowledged(e.target.checked)}
                />
                <span>
                  I have read and accept the disclosed condition notes for these items.
                </span>
              </label>
            </div>
          )}

          {checkoutError && (
            <div style={{ color: '#b42318', fontSize: 13, marginBottom: 12 }}>
              {checkoutError}
            </div>
          )}

          <button
            type="button"
            onClick={handlePay}
            disabled={submitting || (hasDisclosedDefects && !defectsAcknowledged)}
            className="button primary bag-checkout-btn"
          >
            <CreditCard size={15} />
            <span>
              {submitting
                ? 'Preparing checkout...'
                : user
                  ? `Pay ${formatGHS(subtotalPesewas)}`
                  : 'Sign in to pay'}
            </span>
          </button>

          <div className="bag-secure-note">
            <ShieldCheck size={13} />
            <span>Independent Paystack verification before marking paid</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
