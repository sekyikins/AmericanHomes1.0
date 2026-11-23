'use client';

import {
  ProductVariantCombobox,
  type ProductVariantOption,
} from '@/components/staff/ProductVariantCombobox';
import { Button, SearchableSelect } from '@/components/ui';
import { ArrowLeft, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';

export type DraftManifestRow = {
  id: string;
  variantId?: string;
  product: string;
  variant: string;
  qty: number;
};

export type ApprovedRequestSuggestion = {
  id: string;
  reference: string;
  productName: string;
  category: string;
  quantity: number;
  customerName?: string;
};

type CreateShipmentViewProps = {
  submitting: boolean;
  newRef: string;
  setNewRef: (v: string) => void;
  newProvider: string;
  setNewProvider: (v: string) => void;
  providerOptions: string[];
  newTrackingRef: string;
  setNewTrackingRef: (v: string) => void;
  newDeparture: string;
  setNewDeparture: (v: string) => void;
  newArrival: string;
  setNewArrival: (v: string) => void;
  newConfidence: string;
  setNewConfidence: (v: string) => void;
  draftManifest: DraftManifestRow[];
  setDraftManifest: React.Dispatch<React.SetStateAction<DraftManifestRow[]>>;
  variantOptions: ProductVariantOption[];
  approvedRequests?: ApprovedRequestSuggestion[];
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onBack: () => void;
  onSubmit: (e: FormEvent) => void;
};

export function CreateShipmentView({
  submitting,
  newRef,
  setNewRef,
  newProvider,
  setNewProvider,
  providerOptions,
  newTrackingRef,
  setNewTrackingRef,
  newDeparture,
  setNewDeparture,
  newArrival,
  setNewArrival,
  newConfidence,
  setNewConfidence,
  draftManifest,
  setDraftManifest,
  variantOptions,
  approvedRequests = [],
  onAddRow,
  onRemoveRow,
  onBack,
  onSubmit,
}: CreateShipmentViewProps) {
  return (
    <div data-node-id="2:13419">
      <button type="button" className="ship-back-btn" onClick={onBack}>
        <ArrowLeft size={15} />
        <span>Shipments</span>
      </button>

      <form onSubmit={onSubmit}>
        <div className="ship-detail-head">
          <div>
            <h1 className="dash-title" style={{ marginTop: 0 }}>
              Create new shipment
            </h1>
            <p className="dash-sub">
              Record provider details and the expected manifest before departure.
            </p>
          </div>
          <Button type="submit" variant="primary" loading={submitting} loadingText="Saving…">
            Save shipment
          </Button>
        </div>

        <section className="ship-card" style={{ marginBottom: 14 }}>
          <h3>Shipment information</h3>
          <div className="ship-form-grid">
            <label className="login-field">
              <span>Shipment reference</span>
              <input value={newRef} onChange={(e) => setNewRef(e.target.value)} required />
            </label>

            <label className="login-field">
              <span>Shipping provider</span>
              <SearchableSelect
                value={newProvider}
                onChange={setNewProvider}
                options={providerOptions.map((prov) => ({
                  value: prov,
                  label: prov,
                }))}
                placeholder="Select shipping provider…"
                searchPlaceholder="Search providers…"
              />
            </label>

            <label className="login-field">
              <span>Tracking reference</span>
              <input
                value={newTrackingRef}
                onChange={(e) => setNewTrackingRef(e.target.value)}
                placeholder="Provider tracking number"
              />
            </label>

            <label className="login-field">
              <span>Expected departure</span>
              <input
                type="date"
                value={newDeparture}
                onChange={(e) => setNewDeparture(e.target.value)}
              />
            </label>

            <label className="login-field">
              <span>Estimated arrival</span>
              <input
                type="date"
                value={newArrival}
                onChange={(e) => setNewArrival(e.target.value)}
              />
            </label>

            <label className="login-field">
              <span>Arrival confidence</span>
              <select
                className="staff-field-select"
                value={newConfidence}
                onChange={(e) => setNewConfidence(e.target.value)}
              >
                <option value="Estimated timeframe">Estimated timeframe</option>
                <option value="Confirmed vessel schedule">Confirmed vessel schedule</option>
                <option value="Port clearance pending">Port clearance pending</option>
              </select>
            </label>
          </div>
        </section>

        <section className="ship-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div>
              <h3>Expected manifest</h3>
              <p className="ship-card-sub">Expected quantities are not physical inventory.</p>
            </div>
            <button
              type="button"
              className="ship-back-btn"
              style={{ color: 'var(--green)', fontWeight: 700 }}
              onClick={onAddRow}
            >
              <Plus size={14} />
              <span>Add item</span>
            </button>
          </div>

          {approvedRequests.length > 0 && (
            <div
              style={{
                marginTop: 12,
                marginBottom: 14,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(13, 99, 61, 0.22)',
                background: 'rgba(13, 99, 61, 0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--green)',
                  marginBottom: 8,
                }}
              >
                <Sparkles size={14} />
                <span>Suggested from approved customer product requests ({approvedRequests.length})</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {approvedRequests.map((req) => {
                  const alreadyAdded = draftManifest.some(
                    (row) => row.product.trim().toLowerCase() === req.productName.trim().toLowerCase(),
                  );
                  return (
                    <div
                      key={req.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: '#ffffff',
                        border: '1px solid var(--border-subtle)',
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--navy)' }}>{req.productName}</strong>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                          {req.reference} · Qty {req.quantity}
                          {req.customerName ? ` · ${req.customerName}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => {
                          setDraftManifest((prev) => {
                            const hasOnlyEmptyRow =
                              prev.length === 1 && !prev[0].product.trim() && !prev[0].variantId;
                            const newRow: DraftManifestRow = {
                              id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                              product: req.productName,
                              variant: req.category,
                              qty: Math.max(1, req.quantity || 1),
                            };
                            return hasOnlyEmptyRow ? [newRow] : [...prev, newRow];
                          });
                        }}
                        style={{
                          border: 'none',
                          borderRadius: 6,
                          padding: '4px 9px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: alreadyAdded ? 'default' : 'pointer',
                          background: alreadyAdded ? 'var(--bg-subtle)' : 'var(--green)',
                          color: alreadyAdded ? 'var(--text-muted)' : '#ffffff',
                        }}
                      >
                        {alreadyAdded ? 'Added' : '+ Add to manifest'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {draftManifest.map((row, idx) => (
            <div key={row.id} className="ship-manifest-row">
              <div className="ship-index-dot">{idx + 1}</div>
              <div className="login-field" style={{ margin: 0 }}>
                <span>Product (select existing or type new)</span>
                <ProductVariantCombobox
                  value={row.product}
                  variantId={row.variantId}
                  options={variantOptions}
                  onChange={(next) =>
                    setDraftManifest((prev) =>
                      prev.map((r) =>
                        r.id === row.id
                          ? {
                              ...r,
                              product: next.productName,
                              variantId: next.variantId,
                              variant: next.variantLabel ?? r.variant,
                            }
                          : r,
                      ),
                    )
                  }
                />
              </div>
              <label className="login-field" style={{ margin: 0 }}>
                <span>Variant</span>
                <input
                  value={row.variant}
                  onChange={(e) =>
                    setDraftManifest((prev) =>
                      prev.map((r) =>
                        r.id === row.id ? { ...r, variant: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder="Color / size"
                />
              </label>
              <label className="login-field" style={{ margin: 0 }}>
                <span>Expected qty</span>
                <input
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={(e) =>
                    setDraftManifest((prev) =>
                      prev.map((r) =>
                        r.id === row.id ? { ...r, qty: Number(e.target.value) || 1 } : r,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => onRemoveRow(row.id)}
                aria-label="Remove manifest item"
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
      </form>
    </div>
  );
}
