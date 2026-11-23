'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button, SearchableSelect, TableSkeleton } from '@/components/ui';
import type { FormEvent } from 'react';

export interface StockInventoryOption {
  id: string;
  product: string;
  variant: string;
  identifier: string;
  physical: number;
  available: number;
  held: number;
}

export interface StockMovementRow {
  id: string;
  quantity: number;
  reason: string;
  createdAt: string;
}

export function StockLedgerModal({
  ledgerRow,
  movements,
  loadingMovements,
  onClose,
}: {
  ledgerRow: StockInventoryOption | null;
  movements: StockMovementRow[];
  loadingMovements: boolean;
  onClose: () => void;
}) {
  return (
    <StaffModal open={Boolean(ledgerRow)} label="Stock movement ledger" onClose={onClose}>
      {ledgerRow && (
        <>
          <div className="ship-eyebrow">{ledgerRow.identifier}</div>
          <h2 style={{ marginTop: 6 }}>{ledgerRow.product}</h2>
          <p className="login-sub">
            {ledgerRow.variant} · Physical {ledgerRow.physical} · Available {ledgerRow.available} · Held {ledgerRow.held}
          </p>
          <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 12 }}>
            {loadingMovements ? (
              <TableSkeleton rows={3} />
            ) : movements.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                No stock movements recorded for this variant yet.
              </p>
            ) : (
              movements.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '0.8px solid var(--line)',
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <strong>{m.reason}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                      {new Date(m.createdAt).toLocaleString('en-GH')}
                    </div>
                  </div>
                  <strong style={{ color: m.quantity >= 0 ? 'var(--green)' : '#b42318' }}>
                    {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                  </strong>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </StaffModal>
  );
}

export function StockActionModal({
  modalOpen,
  rows,
  selectedAdjRow,
  adjVariantId,
  adjCount,
  adjReason,
  adjNotes,
  stkRef,
  stkNotes,
  submitting,
  onAdjVariantChange,
  onAdjCountChange,
  onAdjReasonChange,
  onAdjNotesChange,
  onStkRefChange,
  onStkNotesChange,
  onSubmit,
  onClose,
}: {
  modalOpen: 'adjustment' | 'stocktake' | null;
  rows: StockInventoryOption[];
  selectedAdjRow: StockInventoryOption | undefined;
  adjVariantId: string;
  adjCount: string;
  adjReason: string;
  adjNotes: string;
  stkRef: string;
  stkNotes: string;
  submitting: boolean;
  onAdjVariantChange: (variantId: string) => void;
  onAdjCountChange: (value: string) => void;
  onAdjReasonChange: (value: string) => void;
  onAdjNotesChange: (value: string) => void;
  onStkRefChange: (value: string) => void;
  onStkNotesChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <StaffModal
      open={Boolean(modalOpen)}
      label={modalOpen === 'adjustment' ? 'Propose adjustment' : 'Create stocktake'}
      onClose={onClose}
    >
      <div className="ship-eyebrow">
        {modalOpen === 'adjustment' ? 'STOCK ADJUSTMENT' : 'STOCKTAKE'}
      </div>

      {modalOpen === 'adjustment' ? (
        <>
          <h2 style={{ marginTop: 6 }}>Propose stock adjustment</h2>
          <p className="login-sub">
            Adjustments require separate manager approval before official
            balances change.
          </p>
          <form onSubmit={onSubmit}>
            <div className="login-field">
              <span>Product variant</span>
              <SearchableSelect
                ariaLabel="Product variant"
                options={rows.map((r) => ({
                  value: r.id,
                  label: `${r.product} · ${r.variant} (${r.identifier})`,
                  searchText: `${r.product} ${r.variant} ${r.identifier}`,
                }))}
                value={adjVariantId}
                onChange={onAdjVariantChange}
                placeholder="Select product variant…"
                searchPlaceholder="Type product name or SKU…"
              />
            </div>

            <div className="req-row-2">
              <label className="login-field">
                <span>System quantity</span>
                <input
                  value={selectedAdjRow?.physical ?? 0}
                  readOnly
                  style={{ background: '#f7f8f7' }}
                />
              </label>
              <label className="login-field">
                <span>Physical count</span>
                <input
                  type="number"
                  min={0}
                  value={adjCount}
                  onChange={(e) => onAdjCountChange(e.target.value)}
                />
              </label>
            </div>

            <label className="login-field">
              <span>Reason</span>
              <select
                className="staff-field-select"
                value={adjReason}
                onChange={(e) => onAdjReasonChange(e.target.value)}
              >
                <option value="Stocktake variance">Stocktake variance</option>
                <option value="Damaged in storage">Damaged in storage</option>
                <option value="Miscount correction">Miscount correction</option>
              </select>
            </label>

            <label className="login-field">
              <span>Supporting notes</span>
              <textarea
                rows={3}
                value={adjNotes}
                onChange={(e) => onAdjNotesChange(e.target.value)}
                placeholder="Explain the variance…"
                style={{
                  width: '100%',
                  border: '0.8px solid var(--line)',
                  borderRadius: 3,
                  padding: 12,
                  fontSize: 13,
                }}
              />
            </label>

            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!selectedAdjRow}
              style={{ width: '100%' }}
            >
              {submitting ? 'Submitting…' : 'Submit for approval'}
            </Button>
          </form>
        </>
      ) : (
        <>
          <h2 style={{ marginTop: 6 }}>Create stocktake</h2>
          <p className="login-sub">
            Create a physical stocktake session. Variances will require
            separate approval.
          </p>

          <form onSubmit={onSubmit}>
            <label className="login-field">
              <span>Stocktake reference</span>
              <input
                value={stkRef}
                onChange={(e) => onStkRefChange(e.target.value)}
                required
              />
            </label>

            <label className="login-field">
              <span>Count instructions</span>
              <textarea
                rows={3}
                value={stkNotes}
                onChange={(e) => onStkNotesChange(e.target.value)}
                placeholder="Optional instructions for the counter…"
                style={{
                  width: '100%',
                  border: '0.8px solid var(--line)',
                  borderRadius: 3,
                  padding: 12,
                  fontSize: 13,
                }}
              />
            </label>

            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              style={{ width: '100%' }}
            >
              {submitting ? 'Creating…' : 'Create & start counting'}
            </Button>
          </form>
        </>
      )}
    </StaffModal>
  );
}
