'use client';

import { X } from 'lucide-react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui';
import type { CustomerOrderRecord } from '@/lib/customerAccount';
import { formatGHS } from '@/lib/formatting/currency';

export function OrderReceiptModal({
  order,
  onClose,
}: {
  order: CustomerOrderRecord;
  onClose: () => void;
}) {
  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Digital receipt"
      onClick={onClose}
    >
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-close" aria-label="Close receipt" onClick={onClose}>
          <X size={17} />
        </button>
        <div className="login-inner">
          <div className="eyebrow">Digital receipt</div>
          <h2 className="login-title" style={{ fontSize: 24 }}>
            {order.reference}
          </h2>
          <p className="login-subtitle">Issued {order.date} · AmericanHomes Ghana</p>
          <div style={{ marginTop: 20, borderTop: '0.8px solid var(--line)', paddingTop: 14 }}>
            <div className="pdp-detail-row">
              <span>Item</span>
              <strong>{order.productName}</strong>
            </div>
            <div className="pdp-detail-row">
              <span>Agreed order total</span>
              <strong>{formatGHS(order.totalPesewas)}</strong>
            </div>
            <div className="pdp-detail-row">
              <span>Total paid</span>
              <strong>{formatGHS(order.paidPesewas)}</strong>
            </div>
            <div className="pdp-detail-row">
              <span>Balance remaining</span>
              <strong>{formatGHS(Math.max(0, order.totalPesewas - order.paidPesewas))}</strong>
            </div>
            <div className="pdp-detail-row">
              <span>Payment status</span>
              <strong>{order.paymentStatus}</strong>
            </div>
            <div className="pdp-detail-row">
              <span>Collection</span>
              <strong>{order.collectionStatus}</strong>
            </div>
          </div>
          <button
            type="button"
            className="button primary"
            style={{ width: '100%', minHeight: 42, marginTop: 22 }}
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderReturnModal({
  order,
  submitted,
  reason,
  setReason,
  selectedLines,
  onToggleLine,
  onLineQtyChange,
  submitting,
  onSubmit,
  onClose,
}: {
  order: CustomerOrderRecord;
  submitted: boolean;
  reason: string;
  setReason: (v: string) => void;
  selectedLines?: Record<string, number>;
  onToggleLine?: (variantId: string, maxQty: number) => void;
  onLineQtyChange?: (variantId: string, qty: number) => void;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Request return or exchange"
      onClick={onClose}
    >
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="login-close"
          aria-label="Close return request"
          onClick={onClose}
        >
          <X size={17} />
        </button>
        <div className="login-inner">
          {submitted ? (
            <div style={{ textAlign: 'center' }}>
              <div className="eyebrow">Return request submitted</div>
              <h2 className="login-title" style={{ fontSize: 24 }}>
                Under management review
              </h2>
              <p className="login-subtitle" style={{ marginTop: 10 }}>
                Return request for <strong>{order.productName}</strong> ({order.reference}) has been
                logged against your collection record.
              </p>
              <button
                type="button"
                className="button primary"
                style={{ width: '100%', minHeight: 42, marginTop: 22 }}
                onClick={onClose}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="eyebrow">Returns &amp; exchanges</div>
              <h2 className="login-title" style={{ fontSize: 24 }}>
                Request return
              </h2>
              <p className="login-subtitle">
                {order.productName} ({order.reference}). Returns are reviewed within 7 days of
                collection.
              </p>
              <form onSubmit={onSubmit} className="login-form">
                {order.lines && order.lines.length > 0 && selectedLines && onToggleLine && onLineQtyChange && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="login-label" style={{ marginBottom: 6 }}>
                      Select item(s) &amp; quantity to return
                    </div>
                    <div
                      style={{
                        border: '0.8px solid var(--line)',
                        borderRadius: 4,
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        background: '#f8fafc',
                      }}
                    >
                      {order.lines.map((line) => {
                        const qtySelected = selectedLines[line.variantId] ?? 0;
                        const checked = qtySelected > 0;
                        return (
                          <div
                            key={line.variantId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              fontSize: 13,
                            }}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggleLine(line.variantId, line.quantity)}
                              />
                              <span>
                                <strong>{line.name}</strong> (Purchased: {line.quantity})
                              </span>
                            </label>
                            {checked && (
                              <input
                                type="number"
                                min={1}
                                max={line.quantity}
                                value={qtySelected}
                                onChange={(e) =>
                                  onLineQtyChange(
                                    line.variantId,
                                    Math.min(line.quantity, Math.max(1, Number(e.target.value) || 1)),
                                  )
                                }
                                style={{
                                  width: 64,
                                  padding: '4px 8px',
                                  border: '0.8px solid var(--line)',
                                  borderRadius: 4,
                                  background: '#fff',
                                  fontSize: 13,
                                }}
                                aria-label={`Return quantity for ${line.name}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <label className="login-label" htmlFor="return-reason">
                  Reason for return or exchange
                </label>
                <textarea
                  id="return-reason"
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the issue or exchange preference..."
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '0.8px solid var(--line)',
                    borderRadius: 4,
                    marginBottom: 18,
                  }}
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="login-submit"
                  loading={submitting}
                  loadingText="Submitting…"
                  disabled={!reason.trim()}
                >
                  Submit return request
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrderPayBalanceModal({
  order,
  channel,
  setChannel,
  submitting,
  onSubmit,
  onClose,
}: {
  order: CustomerOrderRecord;
  channel: 'paystack_momo' | 'paystack_card';
  setChannel: (c: 'paystack_momo' | 'paystack_card') => void;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Pay order balance"
      onClick={onClose}
    >
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="login-close"
          aria-label="Close payment modal"
          onClick={onClose}
        >
          <X size={17} />
        </button>
        <div className="login-inner">
          <div className="eyebrow">Paystack checkout</div>
          <h2 className="login-title" style={{ fontSize: 24 }}>
            Pay remaining balance
          </h2>
          <p className="login-subtitle">
            {order.reference} · {order.productName} · Balance{' '}
            <strong>{formatGHS(Math.max(0, order.totalPesewas - order.paidPesewas))}</strong>
          </p>
          <form onSubmit={onSubmit} className="login-form">
            <label className="req-checkbox-row" style={{ marginBottom: 10 }}>
              <input
                type="radio"
                name="order-pay-channel"
                checked={channel === 'paystack_momo'}
                onChange={() => setChannel('paystack_momo')}
              />
              <span>Mobile Money (MTN, Telecel, AT)</span>
            </label>
            <label className="req-checkbox-row" style={{ marginBottom: 18 }}>
              <input
                type="radio"
                name="order-pay-channel"
                checked={channel === 'paystack_card'}
                onChange={() => setChannel('paystack_card')}
              />
              <span>Debit / Credit Card</span>
            </label>
            <Button
              type="submit"
              variant="primary"
              className="login-submit"
              loading={submitting}
              loadingText="Initializing…"
            >
              Pay {formatGHS(Math.max(0, order.totalPesewas - order.paidPesewas))}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
