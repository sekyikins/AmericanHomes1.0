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
