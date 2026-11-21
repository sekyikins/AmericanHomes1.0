'use client';

import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { ordersApi } from '@/lib/api';
import { mapCustomerOrders, type CustomerPaymentItem } from '@/lib/customerAccount';
import { formatGHS } from '@/lib/formatting/currency';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<CustomerPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orders = mapCustomerOrders(await ordersApi.getMy());
      setPayments(orders.flatMap((o) => o.payments));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your payment history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  return (
    <main className="acct-shell">
      <Link href="/account" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to account</span>
      </Link>

      <div className="acct-head">
        <div>
          <div className="eyebrow">My AmericanHomes</div>
          <h1 className="acct-title">Payments</h1>
        </div>
        <Link href="/account/orders" className="button" style={{ background: '#fff' }}>
          View orders
        </Link>
      </div>

      <section className="acct-panel" style={{ padding: '8px 24px' }}>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadPayments} />
        ) : payments.length === 0 ? (
          <EmptyState
            title="No payments recorded yet"
            description="Your verified and pending payments will appear here once you place an order."
            action={
              <Link href="/shop" className="button primary">
                Browse products
              </Link>
            }
          />
        ) : (
          payments.map((pay, idx) => (
            <div
              key={pay.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                padding: '18px 0',
                borderTop: idx === 0 ? 0 : '0.8px solid var(--line)',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <span className="acct-order-ref">
                  {pay.reference} · Order {pay.orderReference} · {pay.date}
                </span>
                <strong style={{ display: 'block', fontSize: 15, marginTop: 4, color: 'var(--ink)' }}>
                  {pay.method}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span
                  className={`acct-pill ${pay.tone}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  {pay.tone === 'green' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                  {pay.status}
                </span>
                <strong style={{ fontSize: 15, color: 'var(--ink)' }}>
                  {formatGHS(pay.amountPesewas)}
                </strong>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
