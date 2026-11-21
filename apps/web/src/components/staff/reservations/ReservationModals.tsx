'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import { formatStatusLabel } from '@/lib/staffUtils';
import { ArrowRight, Clock, Info, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';

export interface ReservationDetailSummary {
  id: string;
  reference: string;
  customer: string;
  product: string;
  status: string;
  paymentTone: 'amber' | 'gray' | 'green';
  holdExpires: string;
  requestedQty: number;
}

export function CreateReservationModal({
  open,
  variants,
  newCustomer,
  newVariantId,
  newQty,
  newNotes,
  submitting,
  onCustomerChange,
  onVariantChange,
  onQtyChange,
  onNotesChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  variants: Array<{ id: string; label: string }>;
  newCustomer: string;
  newVariantId: string;
  newQty: string;
  newNotes: string;
  submitting: boolean;
  onCustomerChange: (value: string) => void;
  onVariantChange: (value: string) => void;
  onQtyChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <StaffModal open={open} label="Create reservation" onClose={onClose}>
      <div className="ship-eyebrow">RESERVATIONS</div>
      <h2 style={{ marginTop: 6 }}>Create reservation</h2>
      <p className="login-sub">
        Holds eligible available stock pending approval and payment.
      </p>
      <form onSubmit={onSubmit}>
        <label className="login-field">
          <span>Customer name or phone</span>
          <input
            value={newCustomer}
            onChange={(e) => onCustomerChange(e.target.value)}
            placeholder="e.g. Ama Mensah (+233 24 000 0000)"
          />
        </label>
        <label className="login-field">
          <span>Product variant</span>
          <select
            className="staff-field-select"
            value={newVariantId}
            onChange={(e) => onVariantChange(e.target.value)}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="login-field">
          <span>Quantity</span>
          <input
            type="number"
            min={1}
            value={newQty}
            onChange={(e) => onQtyChange(e.target.value)}
          />
        </label>
        <label className="login-field">
          <span>Notes</span>
          <textarea
            rows={2}
            value={newNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            style={{
              width: '100%',
              border: '0.8px solid var(--line)',
              borderRadius: 3,
              padding: 10,
              fontSize: 13,
            }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button type="submit" variant="primary" loading={submitting} disabled={!newVariantId}>
            <span>{submitting ? 'Submitting…' : 'Create reservation'}</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}

export function ReviewReservationModal({
  open,
  selected,
  decisionNote,
  submitting,
  onDecisionNoteChange,
  onDeclineClick,
  onApprove,
  onClose,
}: {
  open: boolean;
  selected: ReservationDetailSummary | null;
  decisionNote: string;
  submitting: boolean;
  onDecisionNoteChange: (value: string) => void;
  onDeclineClick: () => void;
  onApprove: () => void;
  onClose: () => void;
}) {
  const isPending = selected?.status === 'PENDING';
  const unitWord = selected?.requestedQty === 1 ? 'unit' : 'units';

  return (
    <StaffModal
      open={open && Boolean(selected)}
      label={isPending ? 'Review reservation request' : 'Reservation details'}
      onClose={onClose}
    >
      {selected && (
        <>
          <div className="res-head-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ship-eyebrow">{selected.reference}</span>
              <span className={`acct-pill ${selected.paymentTone}`}>
                ● {formatStatusLabel(selected.status)}
              </span>
            </div>
          </div>

          <h2 style={{ marginTop: 8 }}>
            {isPending ? 'Review reservation request' : 'Reservation details'}
          </h2>
          <p className="login-sub">
            {isPending
              ? 'Approve to hold eligible available stock or decline to release the request.'
              : selected.status === 'APPROVED'
                ? 'This reservation is approved and holds stock until checkout or expiry.'
                : 'This reservation is closed and no longer holds inventory.'}
          </p>

          <div className="res-summary-box">
            <div className="res-summary-grid">
              <div>
                <span>Customer</span>
                <strong>{selected.customer}</strong>
              </div>
              <div>
                <span>Product</span>
                <strong>{selected.product}</strong>
              </div>
              <div>
                <span>Requested quantity</span>
                <strong>
                  {selected.requestedQty} {unitWord}
                </strong>
              </div>
              <div>
                <span>Hold expiry</span>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={13} color="var(--muted)" />
                  {selected.holdExpires}
                </strong>
              </div>
            </div>
          </div>

          {isPending ? (
            <>
              <div className="rec-info-banner" style={{ marginBottom: 14 }}>
                <Info size={16} color="#49616e" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11.5 }}>
                  Approving this reservation moves {selected.requestedQty} {unitWord} to held stock.
                </span>
              </div>

              <label className="login-field">
                <span>Decision note</span>
                <textarea
                  rows={2}
                  value={decisionNote}
                  onChange={(e) => onDecisionNoteChange(e.target.value)}
                  placeholder="Reason for approval or decline…"
                  style={{
                    width: '100%',
                    border: '0.8px solid var(--line)',
                    borderRadius: 3,
                    padding: 10,
                    fontSize: 13,
                  }}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  style={{ flex: 1, background: '#fff' }}
                  onClick={onDeclineClick}
                >
                  Decline
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={submitting}
                  loadingText="Approving…"
                  style={{ flex: 1.4 }}
                  onClick={onApprove}
                >
                  <ShieldCheck size={15} />
                  <span>Approve &amp; hold stock</span>
                </Button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </>
      )}
    </StaffModal>
  );
}
