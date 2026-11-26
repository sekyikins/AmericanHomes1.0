'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button, SearchableSelect } from '@/components/ui';
import { formatGhs } from '@/lib/staffUtils';
import { ArrowRight, CheckCircle2, Info, Printer, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';

export interface CollectionOrderOption {
  id: string;
  reference: string;
  customer: string;
  paymentStatus: string;
  remainingCents: number;
}

export interface CollectionDetailRow {
  reference: string;
  gatePassCode?: string;
  customer: string;
  date: string;
  collectionStatus: string;
  collectorName: string;
  collectorPhone?: string;
  quantity: number;
  product: string;
}

export function CollectionDetailModal({
  detailRow,
  onClose,
}: {
  detailRow: CollectionDetailRow | null;
  onClose: () => void;
}) {
  const gatePass =
    detailRow?.gatePassCode ||
    (detailRow ? `AH-GP-${new Date().getFullYear()}-${detailRow.reference.slice(-6).toUpperCase()}` : '');

  return (
    <StaffModal open={Boolean(detailRow)} label="Warehouse collection & exit gate pass" onClose={onClose}>
      {detailRow && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span className="ship-eyebrow">{gatePass} · EXIT GATE PASS</span>
            <span className="acct-pill green">● Cleared for Exit</span>
          </div>
          <h2 style={{ marginTop: 6 }}>Warehouse Exit Gate Pass</h2>
          <p className="login-sub">
            Order {detailRow.reference} · {detailRow.customer} · Issued {detailRow.date}
          </p>

          <div
            style={{
              padding: '12px 14px',
              background: '#f7faf8',
              border: '1px solid #cce0d4',
              borderRadius: 4,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <CheckCircle2 size={18} color="var(--green)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12 }}>
              <strong style={{ display: 'block', color: 'var(--ink)' }}>
                Gate Pass Code: {gatePass}
              </strong>
              <span style={{ color: 'var(--muted)' }}>
                Security personnel at Tema warehouse exit must verify this pass and collector ID
                before goods leave the premises.
              </span>
            </div>
          </div>

          <dl className="ship-dl">
            <div className="ship-dl-row">
              <dt>Gate pass reference</dt>
              <dd><strong>{gatePass}</strong></dd>
            </div>
            <div className="ship-dl-row">
              <dt>Order reference</dt>
              <dd>{detailRow.reference}</dd>
            </div>
            <div className="ship-dl-row">
              <dt>Customer</dt>
              <dd>{detailRow.customer}</dd>
            </div>
            <div className="ship-dl-row">
              <dt>Status</dt>
              <dd>{detailRow.collectionStatus}</dd>
            </div>
            <div className="ship-dl-row">
              <dt>Verified collector / Representative</dt>
              <dd>
                {detailRow.collectorName}
                {detailRow.collectorPhone ? ` (${detailRow.collectorPhone})` : ''}
              </dd>
            </div>
            <div className="ship-dl-row">
              <dt>Released quantity</dt>
              <dd>{detailRow.quantity} {detailRow.quantity === 1 ? 'unit' : 'units'}</dd>
            </div>
            <div className="ship-dl-row">
              <dt>Handover / Item notes</dt>
              <dd>{detailRow.product}</dd>
            </div>
          </dl>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 16 }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
            >
              <Printer size={14} />
              <span>Print Gate Pass</span>
            </Button>
          </div>
        </>
      )}
    </StaffModal>
  );
}

export function RecordCollectionModal({
  open,
  orderOptions,
  selectedOrderId,
  selectedOrderOpt,
  needsUnpaidApproval,
  isOwner,
  unpaidApproved,
  collectorName,
  collectorId,
  fulfilmentMode,
  vehiclePlate,
  releasePin,
  sendingPin,
  sentPinHint,
  notes,
  submitting,
  onOrderChange,
  onUnpaidApprovedChange,
  onCollectorNameChange,
  onCollectorIdChange,
  onFulfilmentModeChange,
  onVehiclePlateChange,
  onReleasePinChange,
  onSendReleasePin,
  onNotesChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  orderOptions: CollectionOrderOption[];
  selectedOrderId: string;
  selectedOrderOpt: CollectionOrderOption | undefined;
  needsUnpaidApproval: boolean;
  isOwner: boolean;
  unpaidApproved: boolean;
  collectorName: string;
  collectorId: string;
  fulfilmentMode?: string;
  vehiclePlate?: string;
  releasePin?: string;
  sendingPin?: boolean;
  sentPinHint?: string | null;
  notes: string;
  submitting: boolean;
  onOrderChange: (value: string) => void;
  onUnpaidApprovedChange: (checked: boolean) => void;
  onCollectorNameChange: (value: string) => void;
  onCollectorIdChange: (value: string) => void;
  onFulfilmentModeChange?: (value: string) => void;
  onVehiclePlateChange?: (value: string) => void;
  onReleasePinChange?: (value: string) => void;
  onSendReleasePin?: () => void;
  onNotesChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <StaffModal open={open} label="Record warehouse collection" onClose={onClose}>
      <div className="res-head-row">
        <span className="ship-eyebrow">COLLECTIONS</span>
        <span className="res-guard-pill">
          <ShieldCheck size={12} /> Handover verification
        </span>
      </div>

      <h2 style={{ marginTop: 8 }}>Record warehouse collection</h2>
      <p className="login-sub">
        Verify collector identity before releasing goods from Tema warehouse.
      </p>

      <form onSubmit={onSubmit}>
        <div className="login-field">
          <span>Order</span>
          <SearchableSelect
            options={orderOptions.map((o) => ({
              value: o.id,
              label: `${o.reference} · ${o.customer}`,
              sublabel:
                o.paymentStatus === 'PAID'
                  ? 'Paid in full'
                  : `${o.paymentStatus} (Rem: ${formatGhs(o.remainingCents)})`,
              searchText: `${o.reference} ${o.customer} ${o.paymentStatus}`,
            }))}
            value={selectedOrderId}
            onChange={onOrderChange}
            placeholder="Search order by reference or customer…"
            searchPlaceholder="Type order ref or customer name…"
          />
        </div>

        {needsUnpaidApproval && (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              background: '#fffbeb',
              border: '0.8px solid #f59e0b',
              fontSize: 12,
              color: '#92400e',
              display: 'grid',
              gap: 8,
            }}
          >
            <strong>
              Restricted collection: {formatGhs(selectedOrderOpt?.remainingCents ?? 0)} balance unpaid
            </strong>
            <span>
              {isOwner
                ? 'Owner override applies automatically if you proceed with release.'
                : 'Partial or unpaid orders require management or Owner authorization before release.'}
            </span>
            {!isOwner && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={unpaidApproved}
                  onChange={(e) => onUnpaidApprovedChange(e.target.checked)}
                />
                <span>Management / Owner authorized release with unpaid balance</span>
              </label>
            )}
          </div>
        )}

        <div className="req-row-2">
          <label className="login-field">
            <span>Fulfilment / Gate Release Mode</span>
            <select
              className="staff-field-select"
              value={fulfilmentMode ?? 'SELF_COLLECTION'}
              onChange={(e) => onFulfilmentModeChange?.(e.target.value)}
            >
              <option value="SELF_COLLECTION">Self-Collection (Customer in person)</option>
              <option value="CUSTOMER_COURIER">Representative / Customer Truck Driver</option>
              <option value="WAREHOUSE_DISPATCH">AmericanHomes Delivery Dispatch</option>
            </select>
          </label>
          <label className="login-field">
            <span>Vehicle License Plate (Optional)</span>
            <input
              value={vehiclePlate ?? ''}
              onChange={(e) => onVehiclePlateChange?.(e.target.value)}
              placeholder="e.g. GR-4821-24"
            />
          </label>
        </div>

        <div className="req-row-2">
          <label className="login-field">
            <span>Collector / Driver name</span>
            <input
              value={collectorName}
              onChange={(e) => onCollectorNameChange(e.target.value)}
              placeholder="Full name"
              required
            />
          </label>
          <label className="login-field">
            <span>Collector Phone / Ghana Card ID</span>
            <input
              value={collectorId}
              onChange={(e) => onCollectorIdChange(e.target.value)}
              placeholder="Phone or Ghana Card ID"
            />
          </label>
        </div>

        {onSendReleasePin && onReleasePinChange && (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              background: '#f7faf8',
              border: '1px solid #cce0d4',
              borderRadius: 4,
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12 }}>
                <strong style={{ display: 'block', color: 'var(--ink)' }}>
                  Customer 6-Digit Gate Release PIN Verification
                </strong>
                <span style={{ color: 'var(--muted)' }}>
                  Send a release PIN to the customer&apos;s account/phone to verify representative or driver pickup.
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                loading={sendingPin}
                loadingText="Sending PIN…"
                disabled={!selectedOrderId || sendingPin}
                onClick={onSendReleasePin}
              >
                Send Release PIN
              </Button>
            </div>
            {sentPinHint && (
              <div style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 600 }}>
                {sentPinHint}
              </div>
            )}
            <input
              value={releasePin ?? ''}
              onChange={(e) => onReleasePinChange(e.target.value)}
              placeholder="Enter 6-digit release PIN presented by collector (optional if customer in person)"
              maxLength={6}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '0.8px solid var(--line)',
                borderRadius: 3,
                fontSize: 13,
                background: '#fff',
              }}
            />
          </div>
        )}

        <label className="login-field">
          <span>Handover notes</span>
          <textarea
            rows={2}
            value={notes}
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

        <div className="rec-info-banner" style={{ marginBottom: 14 }}>
          <Info size={16} color="#49616e" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11.5 }}>
            Recording collection updates the order collection status and audit trail.
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            loadingText="Recording…"
            disabled={!selectedOrderId}
          >
            <span>Confirm handover</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}
