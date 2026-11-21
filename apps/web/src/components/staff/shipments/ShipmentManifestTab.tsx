'use client';

import {
  ProductVariantCombobox,
  type ProductVariantOption,
} from '@/components/staff/ProductVariantCombobox';
import { Button } from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import type { ShipmentRecord } from './shipmentMapper';

export type ManifestDraftRow = {
  id: string;
  variantId?: string;
  product: string;
  qty: number;
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
  onOpenManifestEditor,
  onSaveManifestRevision,
}: ShipmentManifestTabProps) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          {manifestDraftRows.map((row) => (
            <div
              key={row.id}
              style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 8, alignItems: 'center' }}
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
