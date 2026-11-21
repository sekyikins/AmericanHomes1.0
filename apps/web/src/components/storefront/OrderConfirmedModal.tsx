'use client';

import { Check, Clock, X } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/store/cart.store';

export function OrderConfirmedCard({
  orderRef,
  onClose,
}: {
  orderRef: string;
  onClose?: () => void;
}) {
  return (
    <div className="order-confirm-card" data-node-id="1:6569" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button
          type="button"
          className="login-close"
          onClick={onClose}
          aria-label="Close confirmation"
        >
          <X size={17} strokeWidth={2} />
        </button>
      )}

      <div className="order-confirm-inner">
        <div className="order-confirm-check" aria-hidden="true">
          <Check size={26} strokeWidth={2.5} />
        </div>

        <div className="eyebrow" style={{ textAlign: 'center' }}>
          Payment being verified
        </div>

        <h2 className="order-confirm-title">Thanks, your order is confirmed.</h2>

        <p className="order-confirm-sub">
          Order <strong>{orderRef}</strong> has been created. We’ll independently verify your
          Paystack payment before marking it paid.
        </p>

        <div className="order-pending-box">
          <Clock size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Verification pending</strong>
            <span>Usually completed within a few minutes.</span>
          </div>
        </div>

        <Link
          href="/account/orders"
          onClick={onClose}
          className="button primary"
          style={{ width: '100%', minHeight: 46 }}
        >
          View order
        </Link>
      </div>
    </div>
  );
}

export function OrderConfirmedModal() {
  const { confirmedOrderRef, setConfirmedOrderRef } = useCart();
  if (!confirmedOrderRef) return null;

  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Order confirmed"
      onClick={() => setConfirmedOrderRef(null)}
    >
      <OrderConfirmedCard
        orderRef={confirmedOrderRef}
        onClose={() => setConfirmedOrderRef(null)}
      />
    </div>
  );
}
