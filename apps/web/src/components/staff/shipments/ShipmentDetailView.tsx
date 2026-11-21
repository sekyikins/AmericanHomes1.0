'use client';

import type { ProductVariantOption } from '@/components/staff/ProductVariantCombobox';
import { Button, ConfirmDialog } from '@/components/ui';
import { ArrowLeft, ArrowRight, Ship } from 'lucide-react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { ShipmentManifestTab, type ManifestDraftRow } from './ShipmentManifestTab';
import { ShipmentOperationsTabs } from './ShipmentOperationsTabs';
import { statusTone, type DetailTab, type ShipmentRecord } from './shipmentMapper';

export type { ManifestDraftRow };

type ShipmentDetailViewProps = {
  selectedShipment: ShipmentRecord;
  activeTab: DetailTab;
  setActiveTab: (t: DetailTab) => void;
  submitting: boolean;
  statusUpdating: string | null;
  showRevisionNote: boolean;
  setShowRevisionNote: React.Dispatch<React.SetStateAction<boolean>>;
  editingManifest: boolean;
  setEditingManifest: (v: boolean) => void;
  manifestDraftRows: ManifestDraftRow[];
  setManifestDraftRows: React.Dispatch<React.SetStateAction<ManifestDraftRow[]>>;
  manifestRevisionNote: string;
  setManifestRevisionNote: (v: string) => void;
  savingManifest: boolean;
  variantOptions: ProductVariantOption[];
  showTrackingForm: boolean;
  setShowTrackingForm: React.Dispatch<React.SetStateAction<boolean>>;
  newMilestone: string;
  setNewMilestone: (v: string) => void;
  showExpenseForm: boolean;
  setShowExpenseForm: React.Dispatch<React.SetStateAction<boolean>>;
  newExpCategory: string;
  setNewExpCategory: (v: string) => void;
  newExpSupplier: string;
  setNewExpSupplier: (v: string) => void;
  newExpAmount: string;
  setNewExpAmount: (v: string) => void;
  confirmCloseOpen: boolean;
  setConfirmCloseOpen: (v: boolean) => void;
  onBack: () => void;
  onAdvanceStatus: (status: string) => void;
  onCompleteShipment: () => void;
  onOpenManifestEditor: () => void;
  onSaveManifestRevision: (e: FormEvent) => void;
  onAddTrackingMilestone: (e: FormEvent) => void;
  onUpdateDisposition: (discrepancyId: string, disposition: string) => void;
  onAddShipmentExpense: (e: FormEvent) => void;
};

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'manifest', label: 'Manifest' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'discrepancies', label: 'Discrepancies' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'activity', label: 'Activity' },
];

export function ShipmentDetailView({
  selectedShipment,
  activeTab,
  setActiveTab,
  submitting,
  statusUpdating,
  showRevisionNote,
  setShowRevisionNote,
  editingManifest,
  setEditingManifest,
  manifestDraftRows,
  setManifestDraftRows,
  manifestRevisionNote,
  setManifestRevisionNote,
  savingManifest,
  variantOptions,
  showTrackingForm,
  setShowTrackingForm,
  newMilestone,
  setNewMilestone,
  showExpenseForm,
  setShowExpenseForm,
  newExpCategory,
  setNewExpCategory,
  newExpSupplier,
  setNewExpSupplier,
  newExpAmount,
  setNewExpAmount,
  confirmCloseOpen,
  setConfirmCloseOpen,
  onBack,
  onAdvanceStatus,
  onCompleteShipment,
  onOpenManifestEditor,
  onSaveManifestRevision,
  onAddTrackingMilestone,
  onUpdateDisposition,
  onAddShipmentExpense,
}: ShipmentDetailViewProps) {
  const progressPct = Math.min(
    100,
    Math.round((selectedShipment.receivedCount / Math.max(1, selectedShipment.manifestCount)) * 100),
  );
  const discrepancyCount = selectedShipment.discrepancies.length;
  const canEditManifest = ['PLANNED', 'IN_TRANSIT', 'ARRIVED'].includes(selectedShipment.rawStatus);

  return (
    <div data-node-id="9:54783">
      <button type="button" className="ship-back-btn" onClick={onBack}>
        <ArrowLeft size={15} />
        <span>Shipments</span>
      </button>

      <div className="ship-detail-head">
        <div>
          <span className="ship-eyebrow">Shipment detail</span>
          <h1 className="dash-title" style={{ marginTop: 4 }}>
            {selectedShipment.reference}
          </h1>
          <p className="dash-sub">
            {selectedShipment.providerShort} · {selectedShipment.routeFull}
          </p>
        </div>

        <div className="ship-detail-actions">
          <span className={`acct-pill ${statusTone(selectedShipment.status)}`}>
            ● {selectedShipment.status}
          </span>
          {selectedShipment.rawStatus === 'PLANNED' && (
            <Button
              type="button"
              variant="primary"
              loading={statusUpdating === 'IN_TRANSIT'}
              loadingText="Updating…"
              disabled={submitting || Boolean(statusUpdating)}
              onClick={() => onAdvanceStatus('IN_TRANSIT')}
            >
              Mark in transit
            </Button>
          )}
          {selectedShipment.rawStatus === 'IN_TRANSIT' && (
            <Button
              type="button"
              variant="primary"
              loading={statusUpdating === 'ARRIVED'}
              loadingText="Updating…"
              disabled={submitting || Boolean(statusUpdating)}
              onClick={() => onAdvanceStatus('ARRIVED')}
            >
              Mark arrived
            </Button>
          )}
          {selectedShipment.rawStatus === 'RECONCILIATION_PENDING' && (
            <Button
              type="button"
              variant="primary"
              disabled={submitting || Boolean(statusUpdating)}
              onClick={() => setConfirmCloseOpen(true)}
            >
              Close &amp; reconcile
            </Button>
          )}
          {['ARRIVED', 'RECEIVING', 'RECONCILIATION_PENDING', 'CLOSED'].includes(
            selectedShipment.rawStatus,
          ) && (
            <Link
              href={`/staff/receiving?shipmentId=${selectedShipment.id}`}
              className={
                selectedShipment.rawStatus === 'ARRIVED' ||
                selectedShipment.rawStatus === 'RECEIVING'
                  ? 'button primary'
                  : 'button'
              }
              style={
                selectedShipment.rawStatus === 'RECONCILIATION_PENDING' ||
                selectedShipment.rawStatus === 'CLOSED'
                  ? { background: '#fff' }
                  : undefined
              }
            >
              <span>
                {selectedShipment.status === 'Reconciled' ||
                selectedShipment.rawStatus === 'RECONCILIATION_PENDING'
                  ? 'View receiving'
                  : selectedShipment.receivingSessionStatus === 'OPEN'
                    ? 'Continue receiving'
                    : 'Start receiving'}
              </span>
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>

      <div className="ship-tabs-bar" role="tablist" aria-label="Shipment detail tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`ship-tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.label}</span>
            {t.id === 'discrepancies' && discrepancyCount > 0 && (
              <span className="ship-tab-count">{discrepancyCount}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="ship-overview-grid" data-node-id="9:54831">
          <section className="ship-card">
            <h2 style={{ fontSize: 16, margin: 0 }}>Shipment progress</h2>
            <p className="ship-card-sub">{selectedShipment.lastUpdate}</p>
            <div className="ship-route-row">
              <div className="ship-route-point">
                <strong>{selectedShipment.origin}</strong>
                <span>{selectedShipment.originDate}</span>
              </div>
              <div className="ship-route-line">
                <span className="ship-route-dash" />
                <Ship size={18} />
                <span className="ship-route-dash" />
              </div>
              <div className="ship-route-point">
                <strong>{selectedShipment.destination}</strong>
                <span>{selectedShipment.destinationDate}</span>
              </div>
            </div>
            <div className="ship-overview-bar">
              <div className="ship-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="ship-overview-stats">
              <div className="ship-overview-stat">
                <strong>{selectedShipment.manifestCount}</strong>
                <span>Manifest items</span>
              </div>
              <div className="ship-overview-stat">
                <strong>{selectedShipment.receivedCount}</strong>
                <span>Received</span>
              </div>
              <div className="ship-overview-stat">
                <strong>{discrepancyCount}</strong>
                <span>Discrepancies</span>
              </div>
            </div>
          </section>

          <section className="ship-card">
            <h3>Shipment information</h3>
            <p className="ship-card-sub">
              Approved manifest revision {selectedShipment.manifestRevision}
            </p>
            <dl className="ship-dl">
              <div className="ship-dl-row">
                <dt>Provider</dt>
                <dd>{selectedShipment.providerFull}</dd>
              </div>
              <div className="ship-dl-row">
                <dt>Tracking reference</dt>
                <dd>{selectedShipment.trackingRef}</dd>
              </div>
              <div className="ship-dl-row">
                <dt>Expected arrival</dt>
                <dd>{selectedShipment.expectedArrivalRange}</dd>
              </div>
              <div className="ship-dl-row">
                <dt>Recorded expenses</dt>
                <dd>{selectedShipment.expensesTotal}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {activeTab === 'manifest' && (
        <ShipmentManifestTab
          selectedShipment={selectedShipment}
          canEditManifest={canEditManifest}
          editingManifest={editingManifest}
          setEditingManifest={setEditingManifest}
          showRevisionNote={showRevisionNote}
          setShowRevisionNote={setShowRevisionNote}
          manifestDraftRows={manifestDraftRows}
          setManifestDraftRows={setManifestDraftRows}
          manifestRevisionNote={manifestRevisionNote}
          setManifestRevisionNote={setManifestRevisionNote}
          savingManifest={savingManifest}
          variantOptions={variantOptions}
          onOpenManifestEditor={onOpenManifestEditor}
          onSaveManifestRevision={onSaveManifestRevision}
        />
      )}

      <ShipmentOperationsTabs
        selectedShipment={selectedShipment}
        activeTab={activeTab}
        submitting={submitting}
        statusUpdating={statusUpdating}
        showTrackingForm={showTrackingForm}
        setShowTrackingForm={setShowTrackingForm}
        newMilestone={newMilestone}
        setNewMilestone={setNewMilestone}
        showExpenseForm={showExpenseForm}
        setShowExpenseForm={setShowExpenseForm}
        newExpCategory={newExpCategory}
        setNewExpCategory={setNewExpCategory}
        newExpSupplier={newExpSupplier}
        setNewExpSupplier={setNewExpSupplier}
        newExpAmount={newExpAmount}
        setNewExpAmount={setNewExpAmount}
        onAdvanceStatus={onAdvanceStatus}
        onAddTrackingMilestone={onAddTrackingMilestone}
        onUpdateDisposition={onUpdateDisposition}
        onAddShipmentExpense={onAddShipmentExpense}
      />

      <ConfirmDialog
        open={confirmCloseOpen}
        title="Close & reconcile shipment?"
        targetName={selectedShipment.reference}
        description="Closing this shipment finalizes receiving, closes any open receiving session, and marks the shipment Reconciled (CLOSED). All discrepancies must be resolved first."
        consequence={
          selectedShipment.discrepancies.length > 0
            ? 'Note: Any unresolved discrepancies will block closure until resolved in the Discrepancies tab.'
            : undefined
        }
        reversible={false}
        destructive={false}
        confirmLabel="Close shipment"
        loading={submitting}
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={onCompleteShipment}
      />
    </div>
  );
}
