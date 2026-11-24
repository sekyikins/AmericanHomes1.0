'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button, SearchableSelect } from '@/components/ui';
import { formatGhs } from '@/lib/staffUtils';
import { ArrowRight, Info, ShieldCheck } from 'lucide-react';
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
  customer: string;
  date: string;
  collectionStatus: string;
  collectorName: string;
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
  return (
    <StaffModal open={Boolean(detailRow)} label="Collection detail" onClose={onClose}>
      {detailRow && (
        <>
          <div className="ship-eyebrow">{detailRow.reference}</div>
          <h2 style={{ marginTop: 6 }}>Collection handover</h2>
          <p className="login-sub">
            {detailRow.customer} · Collected {detailRow.date}
          </p>
          <dl className="ship-dl">
            <div className="ship-dl-row">
              <dt>Status</dt>
              <dd>{detailRow.collectionStatus}</dd>
            </div>
            <div className="ship-dl-row">
              <dt>Collector / Representative</dt>
              <dd>{detailRow.collectorName}</dd>
            </div>
            <div className="ship-dl-row">
              <dt>Quantity</dt>
              <dd>{detailRow.quantity}</dd>
            </div>
            <div className="ship-dl-row">
              <dt>Notes</dt>
              <dd>{detailRow.product}</dd>
            </div>
          </dl>
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
  notes,
  submitting,
  onOrderChange,
  onUnpaidApprovedChange,
  onCollectorNameChange,
  onCollectorIdChange,
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
  notes: string;
  submitting: boolean;
  onOrderChange: (value: string) => void;
  onUnpaidApprovedChange: (checked: boolean) => void;
  onCollectorNameChange: (value: string) => void;
  onCollectorIdChange: (value: string) => void;
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
            <span>Collector name</span>
            <input
              value={collectorName}
              onChange={(e) => onCollectorNameChange(e.target.value)}
              placeholder="Full name"
              required
            />
          </label>
          <label className="login-field">
            <span>ID / Verification ref</span>
            <input
              value={collectorId}
              onChange={(e) => onCollectorIdChange(e.target.value)}
              placeholder="Ghana Card / Driver ID"
            />
          </label>
        </div>

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
