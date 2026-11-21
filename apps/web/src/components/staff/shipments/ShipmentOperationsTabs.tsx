'use client';

import { Button } from '@/components/ui';
import { Check, Clock, Package, Plus } from 'lucide-react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import type { DetailTab, ShipmentRecord } from './shipmentMapper';

type ShipmentOperationsTabsProps = {
  selectedShipment: ShipmentRecord;
  activeTab: DetailTab;
  submitting: boolean;
  statusUpdating: string | null;
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
  onAdvanceStatus: (status: string) => void;
  onAddTrackingMilestone: (e: FormEvent) => void;
  onUpdateDisposition: (discrepancyId: string, disposition: string) => void;
  onAddShipmentExpense: (e: FormEvent) => void;
};

export function ShipmentOperationsTabs({
  selectedShipment,
  activeTab,
  submitting,
  statusUpdating,
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
  onAdvanceStatus,
  onAddTrackingMilestone,
  onUpdateDisposition,
  onAddShipmentExpense,
}: ShipmentOperationsTabsProps) {
  if (activeTab === 'tracking') {
    return (
      <section className="ship-card" data-node-id="9:56381">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3>Provider tracking history</h3>
          <button
            type="button"
            className="ship-back-btn"
            style={{ color: 'var(--green)', fontWeight: 700 }}
            onClick={() => setShowTrackingForm((v) => !v)}
          >
            <Plus size={14} />
            <span>Add tracking update</span>
          </button>
        </div>
        {showTrackingForm && (
          <form onSubmit={onAddTrackingMilestone} style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <input
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              placeholder="Enter milestone update (e.g., Customs clearance completed)…"
              style={{ flex: 1, height: 40, border: '0.8px solid var(--line)', padding: '0 12px', fontSize: 12.5 }}
            />
            <Button type="submit" variant="primary" loading={submitting} loadingText="Saving…">
              Save update
            </Button>
          </form>
        )}
        <div className="ship-timeline-box">
          {selectedShipment.tracking.map((ev) => (
            <div key={ev.id} className="ship-timeline-item">
              <div className={`ship-timeline-dot${ev.active ? ' active' : ''}`}>
                {ev.active && <Check size={13} />}
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: 15, color: 'var(--ink)' }}>{ev.title}</strong>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                  {ev.timestamp}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === 'receiving') {
    return (
      <section
        className="ship-card"
        data-node-id="9:57080"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 20px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Package size={20} color="var(--green)" />
          <div>
            <strong style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)' }}>
              {selectedShipment.rawStatus === 'PLANNED' || selectedShipment.rawStatus === 'IN_TRANSIT'
                ? 'Shipment has not arrived yet'
                : selectedShipment.receivingSessionStatus === 'OPEN'
                  ? `Receiving session ${selectedShipment.receivingSessionId} is open`
                  : selectedShipment.receivingSessionStatus === 'CLOSED'
                    ? `Receiving session ${selectedShipment.receivingSessionId} is closed`
                    : 'No receiving session started yet'}
            </strong>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>
              {selectedShipment.rawStatus === 'PLANNED'
                ? 'Mark the shipment as In transit and then Arrived before opening a receiving session.'
                : selectedShipment.rawStatus === 'IN_TRANSIT'
                  ? 'Mark the shipment as Arrived before opening a receiving session.'
                  : `${selectedShipment.receivedCount} of ${selectedShipment.manifestCount} expected units have been physically counted.`}
            </span>
          </div>
        </div>
        {selectedShipment.rawStatus === 'PLANNED' ? (
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
        ) : selectedShipment.rawStatus === 'IN_TRANSIT' ? (
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
        ) : (
          <Link href={`/staff/receiving?shipmentId=${selectedShipment.id}`} className="button primary">
            {selectedShipment.receivingSessionStatus === 'OPEN'
              ? 'Continue receiving'
              : selectedShipment.receivingSessionStatus === 'CLOSED'
                ? 'View session'
                : 'Start receiving'}
          </Link>
        )}
      </section>
    );
  }

  if (activeTab === 'discrepancies') {
    return (
      <section className="acct-panel" style={{ padding: 0 }} data-node-id="9:57727">
        <div className="staff-table-head staff-discrepancy-cols">
          <span>PRODUCT</span>
          <span>EXPECTED</span>
          <span>RECEIVED</span>
          <span>VARIANCE</span>
          <span>DISPOSITION</span>
        </div>
        {selectedShipment.discrepancies.length === 0 ? (
          <div style={{ padding: '24px 22px', fontSize: 13, color: 'var(--muted)' }}>
            No discrepancies recorded for this shipment.
          </div>
        ) : (
          selectedShipment.discrepancies.map((d) => (
            <div key={d.id} className="staff-table-row staff-discrepancy-cols">
              <strong>{d.product}</strong>
              <span className="staff-cell-text">{d.expected}</span>
              <span className="staff-cell-text">{d.received}</span>
              <div>
                <span className={`acct-pill ${d.varianceTone}`}>● {d.varianceLabel}</span>
              </div>
              <select
                className="rec-select"
                value={d.disposition}
                aria-label={`Disposition for ${d.product}`}
                onChange={(e) => onUpdateDisposition(d.id, e.target.value)}
              >
                <option value="Provider review">Provider review</option>
                <option value="Management hold">Management hold</option>
                <option value="Onboarding blocked">Onboarding blocked</option>
                <option value="Accepted to inventory">Accepted to inventory</option>
                <option value="Claim filed">Claim filed</option>
              </select>
            </div>
          ))
        )}
      </section>
    );
  }

  if (activeTab === 'expenses') {
    return (
      <section className="acct-panel" style={{ padding: 0 }} data-node-id="9:58449">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 22px',
            borderBottom: '0.8px solid var(--line)',
          }}
        >
          <strong style={{ fontSize: 14, color: 'var(--ink)' }}>Shipment expenses</strong>
          <button
            type="button"
            className="ship-back-btn"
            style={{ color: 'var(--green)', fontWeight: 700 }}
            onClick={() => setShowExpenseForm((v) => !v)}
          >
            <Plus size={14} />
            <span>Add expense</span>
          </button>
        </div>
        {showExpenseForm && (
          <form
            onSubmit={onAddShipmentExpense}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.2fr 1fr auto',
              gap: 10,
              padding: '14px 22px',
              background: '#f9faf9',
              borderBottom: '0.8px solid var(--line)',
            }}
          >
            <select
              value={newExpCategory}
              onChange={(e) => setNewExpCategory(e.target.value)}
              className="rec-select"
              style={{ maxWidth: 'none', height: 38 }}
            >
              <option value="Customs">Customs</option>
              <option value="Clearing">Clearing</option>
              <option value="Port-to-warehouse">Port-to-warehouse</option>
            </select>
            <input
              value={newExpSupplier}
              onChange={(e) => setNewExpSupplier(e.target.value)}
              placeholder="Supplier name"
              style={{ height: 38, border: '0.8px solid var(--line)', padding: '0 10px', fontSize: 12.5 }}
            />
            <input
              value={newExpAmount}
              onChange={(e) => setNewExpAmount(e.target.value)}
              placeholder="GHS 0"
              style={{ height: 38, border: '0.8px solid var(--line)', padding: '0 10px', fontSize: 12.5 }}
            />
            <Button type="submit" variant="primary" loading={submitting} loadingText="Saving…">
              Save
            </Button>
          </form>
        )}
        <div className="staff-table-head staff-expense-cols">
          <span>CATEGORY</span>
          <span>SUPPLIER</span>
          <span>AMOUNT</span>
          <span>STATUS</span>
        </div>
        {selectedShipment.expenses.length === 0 ? (
          <div style={{ padding: '24px 22px', fontSize: 13, color: 'var(--muted)' }}>
            No expenses recorded yet.
          </div>
        ) : (
          selectedShipment.expenses.map((ex) => (
            <div key={ex.id} className="staff-table-row staff-expense-cols">
              <strong>{ex.category}</strong>
              <span className="staff-cell-text">{ex.supplier}</span>
              <span className="staff-cell-text">{ex.amount}</span>
              <div>
                <span className={`acct-pill ${ex.status === 'Approved' ? 'green' : 'amber'}`}>
                  ● {ex.status}
                </span>
              </div>
            </div>
          ))
        )}
      </section>
    );
  }

  if (activeTab === 'activity') {
    return (
      <section className="ship-card" data-node-id="9:59155">
        <h3 style={{ marginBottom: 14 }}>Activity history</h3>
        {selectedShipment.activity.map((act) => (
          <div key={act.id} className="ship-activity-row">
            <Clock size={16} color="var(--muted)" />
            <div>
              <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)' }}>
                {act.message}
              </strong>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                {act.timeAgo}
              </span>
            </div>
          </div>
        ))}
      </section>
    );
  }

  return null;
}
