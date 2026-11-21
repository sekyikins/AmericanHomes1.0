'use client';

import { EmptyState, ErrorState, PreparationSkeleton } from '@/components/ui';
import { catalogueApi, governanceApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Info,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type StageKey =
  | 'inspection'
  | 'cleaning'
  | 'photography'
  | 'wrapping'
  | 'pricing'
  | 'approval';

const STAGES: Array<{ key: StageKey; label: string; cta: string; apiStep?: string }> = [
  { key: 'inspection', label: 'Inspection', cta: 'Complete Inspection', apiStep: 'INSPECTION' },
  { key: 'cleaning', label: 'Cleaning', cta: 'Complete Cleaning', apiStep: 'CLEANING' },
  { key: 'photography', label: 'Photography', cta: 'Complete Photography', apiStep: 'PHOTOGRAPHY' },
  { key: 'wrapping', label: 'Wrapping', cta: 'Complete Wrapping', apiStep: 'WRAPPING' },
  { key: 'pricing', label: 'Pricing', cta: 'Submit Price Proposal' },
  { key: 'approval', label: 'Final approval', cta: 'Publish Product' },
];

type PrepProduct = {
  id: string;
  name: string;
  category?: string;
  published?: boolean;
  isPublished?: boolean;
  images?: string[];
  defectDisclosure?: string;
  preparationSteps?: Array<{
    step: string;
    status: string;
    notes?: string | null;
  }>;
  variants?: Array<{
    id: string;
    sku?: string;
    name?: string;
    priceCents?: number;
    stockLots?: Array<{ available?: number; unavailable?: number }>;
  }>;
};

export default function StaffPreparationPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<PrepProduct[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [condition, setCondition] = useState('Excellent');
  const [functionalTest, setFunctionalTest] = useState('Passed');
  const [notes, setNotes] = useState('');
  const [wrappedChecked, setWrappedChecked] = useState(false);
  const [wrappingNotes, setWrappingNotes] = useState('');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [pricingRationale, setPricingRationale] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<Array<{ id: string; name: string; meta: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCompletedCount = useCallback((p: PrepProduct | undefined) => {
    if (!p) return 0;
    if (p.published || p.isPublished) return 6;
    const doneSteps = new Set(
      (p.preparationSteps ?? []).filter((s) => s.status === 'COMPLETED').map((s) => s.step),
    );
    let c = 0;
    if (doneSteps.has('INSPECTION')) c++;
    if (doneSteps.has('CLEANING')) c++;
    if (doneSteps.has('PHOTOGRAPHY')) c++;
    if (doneSteps.has('WRAPPING')) c++;
    if (c === 4 && (p.variants?.[0]?.priceCents ?? 0) > 0) c = 5;
    return c;
  }, []);

  const syncStageFromProduct = useCallback(
    (p: PrepProduct | undefined) => {
      if (!p) return;
      const done = getCompletedCount(p);
      setActiveIndex(Math.min(done, 5));
      const latestNote = p.preparationSteps?.find((s) => s.notes)?.notes ?? '';
      setNotes(latestNote);
      setSellingPrice(String(((p.variants?.[0]?.priceCents ?? 0) / 100).toFixed(2)));
    },
    [getCompletedCount],
  );

  const loadProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const rows = (await catalogueApi.listAdmin()) as PrepProduct[];
      const list = Array.isArray(rows) ? rows : [];
      setProducts(list);
      setSelectedId((prevSelected) => {
        const current =
          list.find((p) => p.id === prevSelected) ??
          list.find((p) => !p.published) ??
          list[0];
        if (current) {
          syncStageFromProduct(current);
          return current.id;
        }
        return prevSelected;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load products for preparation.');
    } finally {
      setLoading(false);
    }
  }, [syncStageFromProduct]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const product = products.find((p) => p.id === selectedId);
  const primaryVariant = product?.variants?.[0];
  const completedCount = getCompletedCount(product);

  const activeStage = STAGES[activeIndex] ?? STAGES[0];
  const numericSelling = Number(sellingPrice.replace(/[^0-9.]/g, '')) || 0;

  const handleAddEvidenceFile = async (file?: File) => {
    if (!file) return;
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await governanceApi.uploadFile({
        folder: 'preparation',
        filename: file.name,
        mimetype: file.type || 'image/jpeg',
        base64,
      });
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setEvidenceFiles((prev) => [
        ...prev,
        { id: `ev-${Date.now()}`, name: file.name, meta: `Uploaded · ${sizeMb} MB` },
      ]);
      showToast(`Uploaded ${file.name}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to upload evidence file', 'error');
    }
  };

  const handleAdvance = async () => {
    if (!product || submitting) return;
    setSubmitting(true);
    try {
      if (activeStage.apiStep) {
        const stepNotes =
          activeStage.key === 'wrapping'
            ? wrappingNotes || notes
            : `${condition} · ${functionalTest}${notes ? ` — ${notes}` : ''}`;
        await catalogueApi.completePreparation(product.id, activeStage.apiStep, stepNotes);
        showToast(`${activeStage.label} completed`, 'success');
      } else if (activeStage.key === 'pricing') {
        if (!primaryVariant) {
          throw new Error('This product has no variant yet. Create a variant first.');
        }
        if (numericSelling <= 0) {
          throw new Error('Enter a positive selling price in GHS.');
        }
        await catalogueApi.proposePrice(primaryVariant.id, {
          proposedPriceCents: Math.round(numericSelling * 100),
          reason: pricingRationale.trim() || 'Initial retail pricing',
        });
        showToast('Price proposal submitted for manager approval', 'success');
      } else if (activeStage.key === 'approval') {
        await catalogueApi.publishProduct(product.id);
        showToast(`${product.name} published to storefront`, 'success');
      }
      await loadProducts(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to complete preparation step', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const availableQty = (product?.variants ?? []).reduce(
    (s, v) => s + (v.stockLots ?? []).reduce((ls, l) => ls + (l.available ?? 0), 0),
    0,
  );
  const unavailableQty = (product?.variants ?? []).reduce(
    (s, v) => s + (v.stockLots ?? []).reduce((ls, l) => ls + (l.unavailable ?? 0), 0),
    0,
  );

  return (
    <div data-node-id="26:65237">
      <div className="dash-head">
        <div>
          <span className="ship-eyebrow">
            {primaryVariant?.sku ?? product?.id.slice(-6).toUpperCase() ?? 'PREPARATION'} · PRODUCT PREPARATION
          </span>
          <h1 className="dash-title" style={{ marginTop: 4 }}>
            {product?.name ?? 'Product preparation'}
          </h1>
          <p className="dash-sub">
            {primaryVariant?.name ?? product?.category ?? 'Select a product to prepare'}
          </p>
        </div>

        <div className="dash-actions">
          {products.length > 0 && (
            <select
              className="dash-select"
              aria-label="Select product"
              value={selectedId}
              onChange={(e) => {
                const next = products.find((p) => p.id === e.target.value);
                setSelectedId(e.target.value);
                syncStageFromProduct(next);
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.published ? 'Published' : 'Draft'})
                </option>
              ))}
            </select>
          )}
          {product?.published ? (
            <span className="acct-pill green">● Published</span>
          ) : (
            <span className="acct-pill amber">● {completedCount} of 6 complete</span>
          )}
        </div>
      </div>

      {loading ? (
        <PreparationSkeleton />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadProducts} />
      ) : !product ? (
        <EmptyState
          title="No products to prepare"
          description="Create a product draft in Product Catalogue first."
        />
      ) : (
        <>
          <div className="prep-stepper">
            {STAGES.map((stage, idx) => {
              const isDone = idx < completedCount;
              const isActive = idx === activeIndex;
              const isLocked = idx > completedCount;
              const statusText = isDone ? 'Complete' : isActive ? 'In progress' : 'Locked';

              return (
                <button
                  key={stage.key}
                  type="button"
                  disabled={isLocked}
                  aria-disabled={isLocked || undefined}
                  aria-current={isActive ? 'step' : undefined}
                  className={`prep-step${isDone ? ' done' : ''}${isActive ? ' active' : ''}`}
                  onClick={() => {
                    if (!isLocked) setActiveIndex(idx);
                  }}
                >
                  <span className="prep-step-circle">
                    {isDone ? <Check size={13} /> : idx + 1}
                  </span>
                  <strong>{stage.label}</strong>
                  <small>{statusText}</small>
                </button>
              );
            })}
          </div>

          <div className="prep-grid">
            <section className="ship-card">
              <span className="ship-eyebrow">Stage {activeIndex + 1}</span>
              <h3 style={{ fontSize: 18, marginTop: 4 }}>
                {activeStage.key === 'pricing'
                  ? 'Pricing proposal'
                  : activeStage.key === 'approval'
                    ? 'Final publication approval'
                    : activeStage.label}
              </h3>

              {(activeStage.key === 'inspection' ||
                activeStage.key === 'cleaning' ||
                activeStage.key === 'photography') && (
                <>
                  <p className="ship-card-sub">
                    {activeStage.key === 'inspection'
                      ? 'Record condition, functional test results, and upload inspection evidence.'
                      : activeStage.key === 'cleaning'
                        ? 'Record cleaning and surface preparation notes before photography.'
                        : 'Upload showroom photos (front, angles, and any disclosed wear) before wrapping.'}
                  </p>

                  {activeStage.key === 'inspection' && (
                    <div className="req-row-2" style={{ marginTop: 16 }}>
                      <label className="login-field">
                        <span>Condition</span>
                        <select
                          className="staff-field-select"
                          value={condition}
                          onChange={(e) => setCondition(e.target.value)}
                        >
                          <option value="Excellent">Excellent</option>
                          <option value="Good">Good</option>
                          <option value="Minor cosmetic wear">Minor cosmetic wear</option>
                        </select>
                      </label>

                      <label className="login-field">
                        <span>Functional test</span>
                        <select
                          className="staff-field-select"
                          value={functionalTest}
                          onChange={(e) => setFunctionalTest(e.target.value)}
                        >
                          <option value="Passed">Passed</option>
                          <option value="Passed with notes">Passed with notes</option>
                          <option value="Needs follow-up">Needs follow-up</option>
                        </select>
                      </label>
                    </div>
                  )}

                  <label className="login-field" style={activeStage.key === 'inspection' ? undefined : { marginTop: 14 }}>
                    <span>
                      {activeStage.key === 'inspection'
                        ? 'Inspection notes'
                        : activeStage.key === 'cleaning'
                          ? 'Cleaning notes'
                          : 'Photography notes'}
                    </span>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={
                        activeStage.key === 'inspection'
                          ? 'Record inspection findings and defect details…'
                          : activeStage.key === 'cleaning'
                            ? 'Record cleaning, polishing, or treatment details…'
                            : 'Record photo angles, lighting, or gallery notes…'
                      }
                      style={{
                        width: '100%',
                        border: '0.8px solid var(--line)',
                        borderRadius: 3,
                        padding: 12,
                        fontSize: 13,
                      }}
                    />
                  </label>

                  {evidenceFiles.map((ev) => (
                    <div key={ev.id} className="prep-evidence-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ImageIcon size={18} color="var(--green)" />
                        <div>
                          <strong style={{ display: 'block', fontSize: 12.5, color: 'var(--ink)' }}>
                            {ev.name}
                          </strong>
                          <small style={{ color: 'var(--muted)', fontSize: 11 }}>{ev.meta}</small>
                        </div>
                      </div>
                    </div>
                  ))}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    aria-label="Upload evidence photo"
                    style={{ display: 'none' }}
                    onChange={(e) => handleAddEvidenceFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    className="ship-back-btn"
                    style={{ cursor: 'pointer', display: 'inline-flex', marginTop: 8 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={13} />
                    <span>
                      {activeStage.key === 'photography'
                        ? 'Upload product photo'
                        : 'Upload evidence photo'}
                    </span>
                  </button>
                </>
              )}

              {activeStage.key === 'wrapping' && (
                <>
                  <p className="ship-card-sub">
                    Confirm protective wrapping and storage labelling are complete.
                  </p>
                  <label className="req-checkbox-row" style={{ marginTop: 14 }}>
                    <input
                      type="checkbox"
                      checked={wrappedChecked}
                      onChange={(e) => setWrappedChecked(e.target.checked)}
                    />
                    <span>Item is wrapped, labelled, and ready for showroom/warehouse storage.</span>
                  </label>
                  <label className="login-field" style={{ marginTop: 14 }}>
                    <span>Wrapping notes</span>
                    <textarea
                      rows={3}
                      value={wrappingNotes}
                      onChange={(e) => setWrappingNotes(e.target.value)}
                      style={{
                        width: '100%',
                        border: '0.8px solid var(--line)',
                        borderRadius: 3,
                        padding: 12,
                        fontSize: 13,
                      }}
                    />
                  </label>
                </>
              )}

              {activeStage.key === 'pricing' && (
                <>
                  <p className="ship-card-sub">
                    Propose a retail selling price for manager approval.
                  </p>
                  <label className="login-field" style={{ marginTop: 14 }}>
                    <span>Proposed selling price (GHS)</span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                    />
                  </label>
                  <label className="login-field">
                    <span>Pricing rationale</span>
                    <textarea
                      rows={3}
                      value={pricingRationale}
                      onChange={(e) => setPricingRationale(e.target.value)}
                      placeholder="Explain basis for the proposed price…"
                      style={{
                        width: '100%',
                        border: '0.8px solid var(--line)',
                        borderRadius: 3,
                        padding: 12,
                        fontSize: 13,
                      }}
                    />
                  </label>
                  <div className="rec-info-banner" style={{ marginBottom: 0 }}>
                    <Info size={16} color="#49616e" style={{ flexShrink: 0 }} />
                    <span>
                      Pricing must be approved by a different authorised user. You cannot approve
                      your own submission.
                    </span>
                  </div>
                </>
              )}

              {activeStage.key === 'approval' && (
                <>
                  <div className="prep-check-grid">
                    {['Inspection', 'Cleaning', 'Photography', 'Wrapping', 'Pricing'].map((item) => (
                      <div key={item} className="prep-check-tile">
                        <CheckCircle2 size={16} color="var(--green)" />
                        <div>
                          <strong style={{ display: 'block', fontSize: 12.5, color: 'var(--ink)' }}>
                            {item}
                          </strong>
                          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Preparation step
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="prep-ready-banner">
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <strong style={{ display: 'block', fontSize: 12.5 }}>Ready to publish</strong>
                      <span>
                        Publishing makes this product visible in the customer storefront.
                      </span>
                    </div>
                  </div>
                </>
              )}
            </section>

            <aside className="ship-card">
              <img
                src={Array.isArray(product.images) && product.images[0] ? String(product.images[0]) : '/images/sofa.avif'}
                alt={product.name}
                className="prep-side-img"
              />

              <h3>Publication readiness</h3>

              <dl className="ship-dl">
                <div className="ship-dl-row">
                  <dt>Preparation steps</dt>
                  <dd>{completedCount} / 6</dd>
                </div>
                <div className="ship-dl-row">
                  <dt>Product images</dt>
                  <dd>{(product.images?.length ?? 0) + evidenceFiles.length}</dd>
                </div>
                <div className="ship-dl-row">
                  <dt>Available stock</dt>
                  <dd>{availableQty} units</dd>
                </div>
                <div className="ship-dl-row">
                  <dt>Unavailable stock</dt>
                  <dd>{unavailableQty} units</dd>
                </div>
                <div className="ship-dl-row">
                  <dt>Defect disclosure</dt>
                  <dd>{product.defectDisclosure || 'None'}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="button primary"
                disabled={submitting || (activeStage.key === 'wrapping' && !wrappedChecked)}
                aria-busy={submitting || undefined}
                style={{ width: '100%', marginTop: 16 }}
                onClick={handleAdvance}
              >
                <span>{submitting ? 'Saving…' : activeStage.cta}</span>
                <ArrowRight size={15} />
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
