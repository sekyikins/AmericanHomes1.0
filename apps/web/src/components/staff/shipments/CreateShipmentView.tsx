'use client';

import { CollectionCombobox } from '@/components/staff/CollectionCombobox';
import {
  ProductVariantCombobox,
  type ProductVariantOption,
} from '@/components/staff/ProductVariantCombobox';
import { StaffModal } from '@/components/staff/StaffModal';
import { Button, SearchableSelect } from '@/components/ui';
import { AlertTriangle, ArrowLeft, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export type DraftManifestRow = {
  id: string;
  variantId?: string;
  product: string;
  category?: string;
  variant: string;
  qty: number;
  unitCostGhs?: string;
};

export type ApprovedRequestSuggestion = {
  id: string;
  reference: string;
  productName: string;
  category: string;
  quantity: number;
  customerName?: string;
};

export type DemandRestockSuggestion = {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  category: string;
  demandScore: number;
  priorityTier: 'HIGH' | 'MEDIUM' | 'EMERGING';
  recommendedQty: number;
  dominantChannel: 'Walk-in mover' | 'Storefront demand' | 'Omnichannel (Online + Walk-in)';
  currentAvailable: number;
  inTransitQty: number;
  wishlistSaves: number;
  lastUnitCostCents: number;
  rationale: string;
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
  collectionOptions?: string[];
  approvedRequests?: ApprovedRequestSuggestion[];
  demandRecommendations?: DemandRestockSuggestion[];
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
  collectionOptions = ['Living room', 'Office', 'Kitchen', 'Outdoors', 'Dining', 'Electronics'],
  approvedRequests = [],
  demandRecommendations = [],
  onAddRow,
  onRemoveRow,
  onBack,
  onSubmit,
}: CreateShipmentViewProps) {
  const [recsModalOpen, setRecsModalOpen] = useState(false);

  const totalRecommendations = approvedRequests.length + demandRecommendations.length;

  // Detect duplicate rows sharing the same product name + variant (case-insensitive)
  const manifestKeyCounts = new Map<string, number>();
  for (const r of draftManifest) {
    const p = r.product.trim().toLowerCase();
    if (!p) continue;
    const key = `${p}|${r.variant.trim().toLowerCase()}`;
    manifestKeyCounts.set(key, (manifestKeyCounts.get(key) ?? 0) + 1);
  }
  const hasDuplicates = Array.from(manifestKeyCounts.values()).some((c) => c > 1);

  const handleMergeDuplicates = () => {
    setDraftManifest((prev) => {
      const merged: DraftManifestRow[] = [];
      const byKey = new Map<string, number>();
      for (const row of prev) {
        const p = row.product.trim().toLowerCase();
        if (!p) {
          merged.push(row);
          continue;
        }
        const key = `${p}|${row.variant.trim().toLowerCase()}`;
        const existingIdx = byKey.get(key);
        if (existingIdx !== undefined) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            qty: merged[existingIdx].qty + row.qty,
            unitCostGhs: merged[existingIdx].unitCostGhs || row.unitCostGhs,
          };
        } else {
          byKey.set(key, merged.length);
          merged.push({ ...row });
        }
      }
      return merged;
    });
  };
  const includeManifestSuggestion = (item: {
    variantId?: string;
    product: string;
    variant: string;
    qty: number;
    unitCostGhs?: string;
  }) => {
    setDraftManifest((prev) => {
      const emptyIdx = prev.findIndex((r) => !r.product.trim());
      if (emptyIdx >= 0) {
        return prev.map((r, i) =>
          i === emptyIdx
            ? {
                ...r,
                variantId: item.variantId,
                product: item.product,
                variant: item.variant,
                qty: item.qty,
                unitCostGhs: item.unitCostGhs ?? r.unitCostGhs,
              }
            : r,
        );
      }
      return [
        ...prev,
        {
          id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          variantId: item.variantId,
          product: item.product,
          variant: item.variant,
          qty: item.qty,
          unitCostGhs: item.unitCostGhs,
        },
      ];
    });
  };
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {totalRecommendations > 0 && (
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
          </div>

          {hasDuplicates && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: '#fffbeb',
                border: '1px solid #f59e0b',
                borderRadius: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                fontSize: 12.5,
                color: '#92400e',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} color="#d97706" />
                <strong>Duplicate manifest items detected</strong> (same product name and variant).
              </span>
              <button
                type="button"
                className="button"
                style={{ minHeight: 28, padding: '0 10px', fontSize: 11.5, background: '#fff' }}
                onClick={handleMergeDuplicates}
              >
                Merge duplicates
              </button>
            </div>
          )}

          {draftManifest.map((row, idx) => {
            const pKey = row.product.trim().toLowerCase();
            const isDuplicate =
              Boolean(pKey) &&
              (manifestKeyCounts.get(`${pKey}|${row.variant.trim().toLowerCase()}`) ?? 0) > 1;
            return (
            <div
              key={row.id}
              className="ship-manifest-row"
              style={
                isDuplicate
                  ? {
                      borderLeft: '3px solid #f59e0b',
                      paddingLeft: 10,
                      background: '#fffdf7',
                    }
                  : undefined
              }
            >
              <div className="ship-index-dot">{idx + 1}</div>
              <div className="login-field" style={{ margin: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Product (select existing or type new)</span>
                  {isDuplicate && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#92400e',
                        background: '#fef3c7',
                        padding: '1px 6px',
                        borderRadius: 3,
                      }}
                    >
                      Duplicate
                    </span>
                  )}
                </span>
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
                              category: next.category ?? r.category,
                            }
                          : r,
                      ),
                    )
                  }
                />
              </div>
              <div className="login-field" style={{ margin: 0 }}>
                <span>Collection</span>
                <CollectionCombobox
                  value={row.category ?? ''}
                  options={collectionOptions}
                  placeholder="Select or type…"
                  onChange={(val) =>
                    setDraftManifest((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, category: val } : r)),
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
              <label className="login-field" style={{ margin: 0 }}>
                <span>Unit cost (GHS)</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={row.unitCostGhs ?? ''}
                  placeholder="Acquisition cost"
                  onChange={(e) =>
                    setDraftManifest((prev) =>
                      prev.map((r) =>
                        r.id === row.id ? { ...r, unitCostGhs: e.target.value } : r,
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
          );
          })}

          <StaffModal
            open={recsModalOpen}
            label="Smart Manifest Recommendations"
            onClose={() => setRecsModalOpen(false)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Sparkles size={15} color="var(--green)" />
              <span className="ship-eyebrow" style={{ color: 'var(--green)' }}>
                STOREFRONT + WALK-IN INTELLIGENCE
              </span>
            </div>
            <h2 style={{ marginTop: 4 }}>Smart Manifest Recommendations</h2>
            <p className="login-sub">
              Click any approved customer request or high-demand restock to add it directly to your
              expected manifest.
            </p>

            <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'grid', gap: 14 }}>
              {approvedRequests.length > 0 && (
                <div>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--green)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 8,
                    }}
                  >
                    Approved Customer Requests ({approvedRequests.length})
                  </span>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {approvedRequests.map((req) => {
                      const alreadyAdded = draftManifest.some(
                        (m) => m.product.trim().toLowerCase() === req.productName.trim().toLowerCase(),
                      );
                      return (
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
                            borderRadius: 3,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>
                              {req.productName}
                            </strong>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                              {req.category} · Requested qty: {req.quantity}
                              {req.customerName ? ` · ${req.customerName}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="button"
                            disabled={alreadyAdded}
                            style={{ minHeight: 30, padding: '0 10px', fontSize: 11.5, background: '#fff' }}
                            onClick={() =>
                              includeManifestSuggestion({
                                product: req.productName,
                                variant: req.category,
                                qty: req.quantity,
                              })
                            }
                          >
                            {alreadyAdded ? 'Added to manifest' : `+ Include (${req.quantity})`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {demandRecommendations.length > 0 && (
                <div>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--green)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 8,
                    }}
                  >
                    Predicted High-Demand Restocks — Storefront + Walk-in ({demandRecommendations.length})
                  </span>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {demandRecommendations.map((rec) => {
                      const alreadyAdded = draftManifest.some(
                        (m) =>
                          m.variantId === rec.variantId ||
                          (m.product.trim().toLowerCase() === rec.productName.trim().toLowerCase() &&
                            m.variant.trim().toLowerCase() === rec.variantName.trim().toLowerCase()),
                      );
                      return (
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
                            borderRadius: 3,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>
                                {rec.productName}
                              </strong>
                              <span
                                className={`acct-pill ${
                                  rec.priorityTier === 'HIGH'
                                    ? 'green'
                                    : rec.priorityTier === 'MEDIUM'
                                      ? 'amber'
                                      : 'gray'
                                }`}
                                style={{ fontSize: 10 }}
                              >
                                ● {rec.priorityTier} DEMAND
                              </span>
                              <span className="acct-pill blue" style={{ fontSize: 10 }}>
                                {rec.dominantChannel}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                              {rec.rationale}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="button"
                            disabled={alreadyAdded}
                            style={{ minHeight: 30, padding: '0 10px', fontSize: 11.5, background: '#fff' }}
                            onClick={() =>
                              includeManifestSuggestion({
                                variantId: rec.variantId,
                                product: rec.productName,
                                variant: rec.variantName,
                                qty: rec.recommendedQty,
                                unitCostGhs:
                                  rec.lastUnitCostCents > 0
                                    ? String((rec.lastUnitCostCents / 100).toFixed(2))
                                    : undefined,
                              })
                            }
                          >
                            {alreadyAdded
                              ? 'Added to manifest'
                              : `+ Add (${rec.recommendedQty})`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </StaffModal>
        </section>
      </form>
    </div>
  );
}
