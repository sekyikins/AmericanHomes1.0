'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import { formatGhs } from '@/lib/staffUtils';
import { ArrowRight, Info, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';

export interface PaymentOrderOption {
  id: string;
  reference: string;
  customer: string;
  totalCents: number;
  verifiedPaidCents: number;
  remainingCents: number;
  paymentStatus: string;
}

export interface PaymentDetailSummary {
  id: string;
  reference: string;
  orderReference: string;
  customer: string;
  amount: string;
  status: string;
  paymentTone: 'amber' | 'gray' | 'green';
  method: string;
}

export function RecordPaymentModal({
  open,
  orders,
  orderId,
  selectedOrderOption,
  amountGhs,
  method,
  providerRef,
  submitting,
  onOrderChange,
  onAmountChange,
  onMethodChange,
  onProviderRefChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  orders: PaymentOrderOption[];
  orderId: string;
  selectedOrderOption: PaymentOrderOption | undefined;
  amountGhs: string;
  method: string;
  providerRef: string;
  submitting: boolean;
  onOrderChange: (orderId: string) => void;
  onAmountChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onProviderRefChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <StaffModal open={open} label="Record manual payment" onClose={onClose}>
      <div className="res-head-row">
        <span className="ship-eyebrow">PAYMENTS</span>
        <span className="res-guard-pill">
          <ShieldCheck size={12} /> Approval required
        </span>
      </div>

      <h2 style={{ marginTop: 8 }}>Record manual payment</h2>
      <p className="login-sub">
        Manual payments require approval by another authorised manager.
      </p>

      <form onSubmit={onSubmit}>
        <label className="login-field">
          <span>Order</span>
          <select
            className="staff-field-select"
            value={orderId}
            onChange={(e) => onOrderChange(e.target.value)}
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.reference} · {o.customer} · Rem: {formatGhs(o.remainingCents)} / Orig: {formatGhs(o.totalCents)} ({o.paymentStatus})
              </option>
            ))}
          </select>
        </label>

        {selectedOrderOption && (
          <div className="rec-info-banner" style={{ marginBottom: 12 }}>
            <Info size={15} color="#49616e" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>
              Remainder: <strong>{formatGhs(selectedOrderOption.remainingCents)}</strong> · Original:{' '}
              <strong>{formatGhs(selectedOrderOption.totalCents)}</strong>
              {selectedOrderOption.remainingCents === 0 &&
                ' — Order is paid in full; refund any excess payment.'}
            </span>
          </div>
        )}

        <div className="req-row-2">
          <label className="login-field">
            <span>Amount (GHS)</span>
            <input
              type="number"
              step="0.01"
              min={0.01}
              max={
                selectedOrderOption && selectedOrderOption.remainingCents > 0
                  ? selectedOrderOption.remainingCents / 100
                  : undefined
              }
              required
              value={amountGhs}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="4200.00"
            />
          </label>
          <label className="login-field">
            <span>Payment method</span>
            <select
              className="staff-field-select"
              value={method}
              onChange={(e) => onMethodChange(e.target.value)}
            >
              <option value="MANUAL">Manual / Mobile money</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Cash</option>
            </select>
          </label>
        </div>

        <label className="login-field">
          <span>Provider / bank reference</span>
          <input
            value={providerRef}
            onChange={(e) => onProviderRefChange(e.target.value)}
            placeholder="Optional transaction ID"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button type="submit" variant="primary" loading={submitting} disabled={!orderId}>
            <span>{submitting ? 'Submitting…' : 'Submit for approval'}</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}

export function ReviewPaymentModal({
  open,
  selected,
  reverseReason,
  onReverseReasonChange,
  onConfirmAction,
  onClose,
}: {
  open: boolean;
  selected: PaymentDetailSummary | null;
  reverseReason: string;
  onReverseReasonChange: (value: string) => void;
  onConfirmAction: (action: 'APPROVE' | 'REVERSE') => void;
  onClose: () => void;
}) {
  return (
    <StaffModal open={open && Boolean(selected)} label="Payment detail" onClose={onClose}>
      {selected && (
        <>
          <div className="res-head-row">
            <span className="ship-eyebrow">{selected.reference}</span>
            <span className={`acct-pill ${selected.paymentTone}`}>● {selected.status}</span>
          </div>

          <h2 style={{ marginTop: 8 }}>{selected.amount}</h2>
          <p className="login-sub">
            Order {selected.orderReference} · {selected.customer} · {selected.method}
          </p>

          <div className="rec-info-banner" style={{ marginBottom: 14 }}>
            <Info size={16} color="#49616e" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11.5 }}>
              Self-approval is disabled. Reversing a payment updates the order balance and audit log.
            </span>
          </div>

          {selected.status === 'VERIFIED' && (
            <label className="login-field">
              <span>Reversal reason</span>
              <input
                value={reverseReason}
                onChange={(e) => onReverseReasonChange(e.target.value)}
                placeholder="Reason if reversing this payment…"
              />
            </label>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            {selected.status === 'PENDING' && (
              <Button
                type="button"
                variant="primary"
                onClick={() => onConfirmAction('APPROVE')}
              >
                Approve manual payment
              </Button>
            )}
            {selected.status === 'VERIFIED' && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onConfirmAction('REVERSE')}
              >
                Reverse payment
              </Button>
            )}
          </div>
        </>
      )}
    </StaffModal>
  );
}
