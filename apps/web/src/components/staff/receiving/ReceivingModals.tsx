'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button, SearchableSelect } from '@/components/ui';
import { formatStatusLabel } from '@/lib/staffUtils';

export interface ReceivingShipmentOption {
  id: string;
  reference: string;
  providerName?: string;
  status: string;
}

export function StartReceivingSessionModal({
  open,
  eligibleShipments,
  selectedShipmentId,
  startingSession,
  onSelectShipment,
  onStartSession,
  onClose,
}: {
  open: boolean;
  eligibleShipments: ReceivingShipmentOption[];
  selectedShipmentId: string;
  startingSession: boolean;
  onSelectShipment: (shipmentId: string) => void;
  onStartSession: () => void;
  onClose: () => void;
}) {
  return (
    <StaffModal open={open} label="Open receiving session" onClose={onClose}>
      <div className="ship-eyebrow">NEW RECEIVING SESSION</div>
      <h2 style={{ marginTop: 6 }}>Select shipment</h2>
      <p className="login-sub">
        Open a receiving session to record received quantities and flag discrepancies.
      </p>
      <div className="login-field">
        <span>Shipment</span>
        {eligibleShipments.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 0' }}>
            All open shipments already have an active receiving session.
          </p>
        ) : (
          <SearchableSelect
            ariaLabel="Select shipment"
            options={eligibleShipments.map((s) => ({
              value: s.id,
              label: `${s.reference} — ${s.providerName ?? 'Provider'} (${formatStatusLabel(s.status)})`,
              searchText: `${s.reference} ${s.providerName ?? ''} ${s.status}`,
            }))}
            value={selectedShipmentId}
            onChange={onSelectShipment}
            placeholder="Search shipment by reference or provider…"
            searchPlaceholder="Type shipment reference or provider…"
          />
        )}
      </div>
      <div className="review-actions" style={{ borderTop: 0, paddingTop: 10 }}>
        <Button
          type="button"
          variant="primary"
          loading={startingSession}
          loadingText="Opening…"
          disabled={!selectedShipmentId || eligibleShipments.length === 0}
          onClick={onStartSession}
        >
          Open session
        </Button>
      </div>
    </StaffModal>
  );
}

export function ReceivingNoteModal({
  open,
  draftNote,
  onDraftChange,
  onSave,
  onClose,
}: {
  open: boolean;
  draftNote: string;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <StaffModal open={open} label="Item receiving note" onClose={onClose}>
      <div className="ship-eyebrow">RECEIVING NOTE</div>
      <h2 style={{ marginTop: 6 }}>Record inspection note</h2>
      <textarea
        rows={4}
        value={draftNote}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder="Document condition, packaging issues, or variance details…"
        style={{
          width: '100%',
          border: '0.8px solid var(--line)',
          borderRadius: 3,
          padding: 12,
          fontSize: 13,
          marginTop: 10,
        }}
      />
      <div className="review-actions" style={{ borderTop: 0, paddingTop: 10 }}>
        <Button type="button" variant="primary" onClick={onSave}>
          Save note
        </Button>
      </div>
    </StaffModal>
  );
}
