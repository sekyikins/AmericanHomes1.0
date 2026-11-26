'use client';

import {
  ProductVariantCombobox,
  type ProductVariantOption,
} from '@/components/staff/ProductVariantCombobox';
import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import { AlertTriangle, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type {
  ApprovedRequestSuggestion,
  DemandRestockSuggestion,
} from './CreateShipmentView';
import type { ShipmentRecord } from './shipmentMapper';

export type ManifestDraftRow = {
  id: string;
  variantId?: string;
  product: string;
  qty: number;
  unitCostGhs?: string;
};

type ShipmentManifestTabProps = {
  selectedShipment: ShipmentRecord;
  canEditManifest: boolean;
  editingManifest: boolean;
  setEditingManifest: (v: boolean) => void;
  showRevisionNote: boolean;
  setShowRevisionNote: React.Dispatch<React.SetStateAction<boolean>>;
  manifestDraftRows: ManifestDraftRow[];
  setManifestDraftRows: React.Dispatch<React.SetStateAction<ManifestDraftRow[]>>;
  manifestRevisionNote: string;
  setManifestRevisionNote: (v: string) => void;
  savingManifest: boolean;
  variantOptions: ProductVariantOption[];
  approvedRequests?: ApprovedRequestSuggestion[];
  demandRecommendations?: DemandRestockSuggestion[];
  onOpenManifestEditor: () => void;
  onSaveManifestRevision: (e: FormEvent) => void;
};

export function ShipmentManifestTab({
  selectedShipment,
  canEditManifest,
  editingManifest,
  setEditingManifest,
  showRevisionNote,
  setShowRevisionNote,
  manifestDraftRows,
  setManifestDraftRows,
  manifestRevisionNote,
  setManifestRevisionNote,
  savingManifest,
  variantOptions,
  approvedRequests = [],
  demandRecommendations = [],
  onOpenManifestEditor,
  onSaveManifestRevision,
}: ShipmentManifestTabProps) {
  const [recsModalOpen, setRecsModalOpen] = useState(false);
  const isPlanned = selectedShipment.rawStatus === 'PLANNED';
  const totalRecommendations = approvedRequests.length + demandRecommendations.length;

  const revDupCounts = new Map<string, number>();
  for (const r of manifestDraftRows) {
    const p = r.product.trim().toLowerCase();
    if (!p) continue;
    const key = `${p}|${r.variantId ?? ''}`;
    revDupCounts.set(key, (revDupCounts.get(key) ?? 0) + 1);
  }
  const hasRevDuplicates = Array.from(revDupCounts.values()).some((c) => c > 1);

  const handleAddRecommendedToRevision = (item: {
    variantId?: string;
    product: string;
    qty: number;
    unitCostGhs?: string;
  }) => {
    if (!editingManifest) {
      onOpenManifestEditor();
    }
    setManifestDraftRows((prev) => {
      const base =
        prev.length > 0
          ? prev
          : selectedShipment.manifest.map((m) => ({
              id: m.id,
              variantId: m.variantId,
              product: m.product,
              qty: m.expectedQty,
            }));
      const emptyIdx = base.findIndex((r) => !r.product.trim());
      if (emptyIdx >= 0) {
        return base.map((r, i) =>
          i === emptyIdx
            ? { ...r, variantId: item.variantId, product: item.product, qty: item.qty, unitCostGhs: item.unitCostGhs }
            : r,
        );
      }
      return [
        ...base,
        {
          id: `mr-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          variantId: item.variantId,
          product: item.product,
          qty: item.qty,
          unitCostGhs: item.unitCostGhs,
        },
      ];
    });
  };
  return (
    <section className="acct-panel" style={{ padding: 0 }} data-node-id="9:55610">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          padding: '18px 22px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>
            Approved manifest · revision {selectedShipment.manifestRevision}
          </h3>
          <p className="ship-card-sub">Expected quantities remain separate from inventory.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {isPlanned && totalRecommendations > 0 && (
            <button
              type="button"
              className="button"
              style={{
                minHeight: 34,
                padding: '0 12px',
                fontSize: 12,
                background: '#f2f8f4',
                borderColor: '#cce0d4',
                color: 'var(--green)',
                fontWeight: 600,
              }}
              onClick={() => setRecsModalOpen(true)}
            >
              <Sparkles size={13} />
              <span>Smart recommendations ({totalRecommendations})</span>
            </button>
          )}
          {canEditManifest && (
            <button
              type="button"
              className="button"
              style={{ minHeight: 34, padding: '0 12px', fontSize: 12, background: '#fff' }}
              onClick={() => (editingManifest ? setEditingManifest(false) : onOpenManifestEditor())}
            >
              {editingManifest ? 'Cancel edit' : 'Update manifest'}
            </button>
          )}
          <button
            type="button"
            className="ship-back-btn"
            style={{ color: 'var(--green)', fontWeight: 700 }}
            onClick={() => setShowRevisionNote((v) => !v)}
          >
            {showRevisionNote ? 'Hide revision history' : 'View revision history'}
          </button>
        </div>
      </div>

      {editingManifest && (
        <form
          onSubmit={onSaveManifestRevision}
          style={{
            margin: '0 22px 16px',
            padding: '14px 16px',
            background: '#f9faf9',
            border: '0.8px solid var(--line)',
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13 }}>
              New manifest revision (Revision {selectedShipment.manifestRevision + 1})
            </strong>
            <button
              type="button"
              className="button"
              style={{ minHeight: 30, padding: '0 10px', fontSize: 12, background: '#fff' }}
              onClick={() =>
                setManifestDraftRows((prev) => [
                  ...prev,
                  { id: `mr-${Date.now()}-${prev.length}`, product: '', qty: 1 },
                ])
              }
            >
              <Plus size={13} />
              <span>Add item</span>
            </button>
          </div>
          {hasRevDuplicates && (
            <div
              style={{
                padding: '8px 12px',
                background: '#fffbeb',
                border: '1px solid #f59e0b',
                borderRadius: 4,
                fontSize: 12,
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={14} color="#d97706" />
              <span>Duplicate manifest items detected (same product &amp; variant). Consider combining quantities.</span>
            </div>
          )}

          {manifestDraftRows.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 95px 125px 32px',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <ProductVariantCombobox
                value={row.product}
                variantId={row.variantId}
                options={variantOptions}
                onChange={(next) =>
                  setManifestDraftRows((prev) =>
                    prev.map((r) =>
                      r.id === row.id
                        ? { ...r, product: next.productName, variantId: next.variantId }
                        : r,
                    ),
                  )
                }
              />
              <input
                type="number"
                min={1}
                value={row.qty}
                onChange={(e) =>
                  setManifestDraftRows((prev) =>
                    prev.map((r) =>
                      r.id === row.id ? { ...r, qty: Math.max(1, Number(e.target.value) || 1) } : r,
                    ),
                  )
                }
                aria-label="Expected quantity"
                placeholder="Qty"
                style={{
                  height: 36,
                  border: '0.8px solid var(--line)',
                  padding: '0 10px',
                  fontSize: 12.5,
                  background: '#fff',
                }}
              />
              <input
                type="number"
                step="0.01"
                min={0}
                value={row.unitCostGhs ?? ''}
                onChange={(e) =>
                  setManifestDraftRows((prev) =>
                    prev.map((r) =>
                      r.id === row.id ? { ...r, unitCostGhs: e.target.value } : r,
                    ),
                  )
                }
                aria-label="Unit cost in GHS"
                placeholder="Unit cost (GHS)"
                style={{
                  height: 36,
                  border: '0.8px solid var(--line)',
                  padding: '0 10px',
                  fontSize: 12.5,
                  background: '#fff',
                }}
              />
              <button
                type="button"
                aria-label="Remove item"
                onClick={() =>
                  setManifestDraftRows((prev) =>
                    prev.length > 1 ? prev.filter((r) => r.id !== row.id) : prev,
                  )
                }
                style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              value={manifestRevisionNote}
              onChange={(e) => setManifestRevisionNote(e.target.value)}
              placeholder="Revision note (optional, e.g., Supplier updated packing list)"
              style={{
                flex: 1,
                height: 36,
                border: '0.8px solid var(--line)',
                padding: '0 10px',
                fontSize: 12.5,
                background: '#fff',
              }}
            />
            <Button type="submit" variant="primary" loading={savingManifest} loadingText="Saving revision…">
              Save revision
            </Button>
          </div>
        </form>
      )}

      <StaffModal
        open={recsModalOpen}
        label="Smart Manifest Recommendations"
        onClose={() => setRecsModalOpen(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Sparkles size={15} color="var(--green)" />
          <span className="ship-eyebrow" style={{ color: 'var(--green)' }}>
            PLANNED SHIPMENT RECOMMENDATIONS
          </span>
        </div>
        <h2 style={{ marginTop: 4 }}>Smart Manifest Recommendations</h2>
        <p className="login-sub">
          Click any approved customer request or predicted high-demand restock to add it to this
          planned shipment&apos;s manifest before marking it In Transit.
        </p>
        <div style={{ display: 'grid', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {approvedRequests.map((req) => (
            <div
              key={req.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: '#f9faf9',
                border: '0.8px solid var(--line)',
                borderRadius: 4,
              }}
            >
              <div style={{ fontSize: 12.5 }}>
                <strong>{req.productName}</strong>
                <small style={{ display: 'block', color: 'var(--muted)' }}>
                  Approved Customer Request · Qty {req.quantity}
                </small>
              </div>
              <button
                type="button"
                className="button"
                style={{ background: '#fff', fontSize: 11.5, minHeight: 30, padding: '0 10px' }}
                onClick={() => {
                  handleAddRecommendedToRevision({
                    product: req.productName,
                    qty: req.quantity,
                  });
                  setRecsModalOpen(false);
                }}
              >
                <Plus size={12} /> Include (×{req.quantity})
              </button>
            </div>
          ))}
          {demandRecommendations.map((rec) => (
            <div
              key={rec.variantId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: '#f9faf9',
                border: '0.8px solid var(--line)',
                borderRadius: 4,
              }}
            >
              <div style={{ fontSize: 12.5 }}>
                <strong>{rec.productName}</strong>{' '}
                <span className="acct-pill green" style={{ fontSize: 10 }}>
                  Score {rec.demandScore}
                </span>
                <small style={{ display: 'block', color: 'var(--muted)' }}>{rec.rationale}</small>
              </div>
              <button
                type="button"
                className="button"
                style={{ background: '#fff', fontSize: 11.5, minHeight: 30, padding: '0 10px' }}
                onClick={() => {
                  handleAddRecommendedToRevision({
                    variantId: rec.variantId,
                    product: rec.productName,
                    qty: rec.recommendedQty,
                    unitCostGhs:
                      rec.lastUnitCostCents > 0
                        ? (rec.lastUnitCostCents / 100).toFixed(2)
                        : undefined,
                  });
                  setRecsModalOpen(false);
                }}
              >
                <Plus size={12} /> Add (+{rec.recommendedQty})
              </button>
            </div>
          ))}
        </div>
      </StaffModal>

      {showRevisionNote && (
        <div
          style={{
            margin: '0 22px 14px',
            padding: '10px 14px',
            background: '#f7f8f7',
            border: '0.8px solid var(--line)',
            fontSize: 12,
            color: 'var(--ink-body)',
          }}
        >
          Revision {selectedShipment.manifestRevision} · {selectedShipment.manifest.length} line item(s) on current expected manifest.
        </div>
      )}

      <div className="staff-table-head staff-manifest-cols">
        <span>EXPECTED PRODUCT</span>
        <span>VARIANT</span>
        <span>EXPECTED QTY</span>
        <span>RECEIVED</span>
        <span>REQUEST ASSOCIATION</span>
      </div>
      {selectedShipment.manifest.map((item) => (
        <div key={item.id} className="staff-table-row staff-manifest-cols">
          <strong>{item.product}</strong>
          <span className="staff-cell-text">{item.variant}</span>
          <span className="staff-cell-text">{item.expectedQty}</span>
          <span className="staff-cell-text">{item.receivedQty}</span>
          <span className="staff-cell-text">{item.requestAssociation}</span>
        </div>
      ))}
    </section>
  );
}
