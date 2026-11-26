'use client';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PreparationSkeleton,
  SearchableSelect,
} from '@/components/ui';
import { catalogueApi, governanceApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  RotateCcw,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

type StageKey =
  | 'inspection'
  | 'cleaning'
  | 'photography'
  | 'wrapping'
  | 'pricing'
  | 'approval';

const STAGES: Array<{
  key: StageKey;
  label: string;
  cta: string;
  updateCta: string;
  apiStep?: string;
}> = [
  {
    key: 'inspection',
    label: 'Inspection',
    cta: 'Complete Inspection',
    updateCta: 'Update Inspection',
    apiStep: 'INSPECTION',
  },
  {
    key: 'cleaning',
    label: 'Cleaning',
    cta: 'Complete Cleaning',
    updateCta: 'Update Cleaning',
    apiStep: 'CLEANING',
  },
  {
    key: 'photography',
    label: 'Photography',
    cta: 'Complete Photography',
    updateCta: 'Update Photography',
    apiStep: 'PHOTOGRAPHY',
  },
  {
    key: 'wrapping',
    label: 'Wrapping',
    cta: 'Complete Wrapping',
    updateCta: 'Update Wrapping',
    apiStep: 'WRAPPING',
  },
  {
    key: 'pricing',
    label: 'Pricing',
    cta: 'Submit Price Proposal',
    updateCta: 'Update Price Proposal',
  },
  {
    key: 'approval',
    label: 'Final approval',
    cta: 'Approve & Publish Product',
    updateCta: 'Approve & Publish Product',
  },
];

type PrepProduct = {
  id: string;
  name: string;
  category?: string;
  published?: boolean;
  isPublished?: boolean;
  shipmentReference?: string;
  unitAcquisitionCostCents?: number;
  allocatedFreightAndDutyCents?: number;
  estimatedLandedCostCents?: number;
  completedStageCount?: number;
  preparationStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'PREPARED';
  images?: string[];
  media?: Array<{ id?: string; url?: string; position?: number }>;
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

type PhotoDraftItem = {
  key: string;
  existingMediaId?: string;
  url: string;
  filename?: string;
  mimetype?: string;
  isNew: boolean;
};

function parseInspectionNotes(rawNotes?: string | null): {
  condition: string;
  functionalTest: string;
  notes: string;
} {
  const defaultRes = { condition: 'Excellent', functionalTest: 'Passed', notes: '' };
  if (!rawNotes) return defaultRes;
  const [prefix, ...rest] = rawNotes.split(' — ');
  const parts = (prefix ?? '').split(' · ').map((s) => s.trim());
  const validConditions = ['Excellent', 'Good', 'Minor cosmetic wear'];
  const validTests = ['Passed', 'Passed with notes', 'Needs follow-up'];
  if (parts.length >= 2 && validConditions.includes(parts[0]) && validTests.includes(parts[1])) {
    return {
      condition: parts[0],
      functionalTest: parts[1],
      notes: rest.join(' — ').trim(),
    };
  }
  return { ...defaultRes, notes: rawNotes };
}

function StaffPreparationContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const requestedProductId = searchParams.get('productId') ?? '';

  const [products, setProducts] = useState<PrepProduct[]>([]);
  const [selectedId, setSelectedId] = useState<string>(requestedProductId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revertAction, setRevertAction] = useState<'stage' | 'last' | 'resetAll' | null>(null);
  const [confirmPrepReset, setConfirmPrepReset] = useState<
    | null
    | { kind: 'restartAll' }
    | { kind: 'revert'; stepKey: string; stepLabel: string; source: 'stage' | 'last' }
  >(null);
  const isBusy = submitting || revertAction !== null;

  const [activeIndex, setActiveIndex] = useState(0);

  // Per-stage independent states
  const [condition, setCondition] = useState('Excellent');
  const [functionalTest, setFunctionalTest] = useState('Passed');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [cleaningNotes, setCleaningNotes] = useState('');
  const [photographyNotes, setPhotographyNotes] = useState('');
  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraftItem[]>([]);
  const [primaryPhotoKey, setPrimaryPhotoKey] = useState<string>('');
  const [wrappedChecked, setWrappedChecked] = useState(false);
  const [wrappingNotes, setWrappingNotes] = useState('');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [pricingRationale, setPricingRationale] = useState('');

  // Serialized / Individual Tracked Units (Appliances, Electronics, Open-Box items)
  const [trackedUnits, setTrackedUnits] = useState<
    Array<{
      id: string;
      unitCode: string;
      condition: string;
      status: string;
      defectNotes?: string | null;
    }>
  >([]);
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitCondition, setNewUnitCondition] = useState('GOOD');
  const [newUnitDefectNotes, setNewUnitDefectNotes] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);
  const [floorTagModalOpen, setFloorTagModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTrackedUnits = useCallback(async (productId: string) => {
    if (!productId) {
      setTrackedUnits([]);
      return;
    }
    try {
      const list = await catalogueApi.listTrackedUnits(productId);
      setTrackedUnits(Array.isArray(list) ? list : []);
    } catch {
      setTrackedUnits([]);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadTrackedUnits(selectedId);
    }
  }, [selectedId, loadTrackedUnits]);

  const handleAddTrackedUnit = async () => {
    if (!selectedId || addingUnit) return;
    setAddingUnit(true);
    try {
      await catalogueApi.addTrackedUnit(selectedId, {
        unitCode: newUnitCode.trim() || undefined,
        condition: newUnitCondition,
        defectNotes: newUnitDefectNotes.trim() || undefined,
      });
      setNewUnitCode('');
      setNewUnitDefectNotes('');
      showToast('Registered serialized unit tag', 'success');
      await loadTrackedUnits(selectedId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to register unit tag', 'error');
    } finally {
      setAddingUnit(false);
    }
  };

  const getCompletedCount = useCallback((p: PrepProduct | undefined) => {
    if (!p) return 0;
    const doneSteps = new Set(
      (p.preparationSteps ?? []).filter((s) => s.status === 'COMPLETED').map((s) => s.step),
    );
    let c = 0;
    if (doneSteps.has('INSPECTION')) c = 1;
    if (c === 1 && doneSteps.has('CLEANING')) c = 2;
    if (c === 2 && doneSteps.has('PHOTOGRAPHY')) c = 3;
    if (c === 3 && doneSteps.has('WRAPPING')) c = 4;
    const hasPrice = (p.variants ?? []).some((v) => (v.priceCents ?? 0) > 0);
    if (c === 4 && (doneSteps.has('PRICING') || hasPrice)) c = 5;
    if (c === 5 && (doneSteps.has('FINAL_REVIEW') || Boolean(p.isPublished ?? p.published))) {
      c = 6;
    }
    return c;
  }, []);

  const syncStageFromProduct = useCallback(
    (p: PrepProduct | undefined, preserveActiveIndex?: number) => {
      if (!p) return;
      const done = getCompletedCount(p);
      if (typeof preserveActiveIndex === 'number' && preserveActiveIndex <= Math.min(done, 5)) {
        setActiveIndex(preserveActiveIndex);
      } else {
        setActiveIndex(Math.min(done, 5));
      }

      const stepMap = new Map(
        (p.preparationSteps ?? []).map((s) => [s.step, s]),
      );

      // Stage 1: Inspection
      const parsedInsp = parseInspectionNotes(stepMap.get('INSPECTION')?.notes);
      setCondition(parsedInsp.condition);
      setFunctionalTest(parsedInsp.functionalTest);
      setInspectionNotes(parsedInsp.notes);

      // Stage 2: Cleaning
      setCleaningNotes(stepMap.get('CLEANING')?.notes ?? '');

      // Stage 3: Photography (staged locally until Complete/Update Photography is clicked)
      setPhotographyNotes(stepMap.get('PHOTOGRAPHY')?.notes ?? '');
      const existingMedia: PhotoDraftItem[] = (Array.isArray(p.media) ? p.media : [])
        .filter((m) => Boolean(m?.url))
        .map((m, idx) => ({
          key: m.id ? `media-${m.id}` : `media-${idx}-${m.url}`,
          existingMediaId: m.id,
          url: String(m.url),
          isNew: false,
        }));
      setPhotoDrafts(existingMedia);
      setPrimaryPhotoKey(existingMedia[0]?.key ?? '');

      // Stage 4: Wrapping
      const wrappingRec = stepMap.get('WRAPPING');
      setWrappedChecked(wrappingRec?.status === 'COMPLETED');
      setWrappingNotes(wrappingRec?.notes ?? '');

      // Stage 5: Pricing
      const priceCents = p.variants?.[0]?.priceCents ?? 0;
      setSellingPrice(String((priceCents / 100).toFixed(2)));
      setPricingRationale(stepMap.get('PRICING')?.notes ?? '');
    },
    [getCompletedCount],
  );

  const loadProducts = useCallback(
    async (silent = false, preserveStageIndex?: number) => {
      if (!silent) setLoading(true);
      setLoadError(null);
      try {
        const rows = (await catalogueApi.listAdmin()) as PrepProduct[];
        const allList = Array.isArray(rows) ? rows : [];
        // Active Preparation list only includes products that have not completed all 6 stages
        const eligible = allList.filter((p) => {
          const doneCount = getCompletedCount(p);
          return doneCount < 6 && !Boolean(p.isPublished ?? p.published);
        });
        setProducts(eligible);
        setSelectedId((prevSelected) => {
          const preferredId = prevSelected || requestedProductId;
          const current =
            eligible.find((p) => p.id === preferredId) ?? eligible[0];
          if (current) {
            syncStageFromProduct(
              current,
              current.id === prevSelected ? preserveStageIndex : undefined,
            );
            return current.id;
          }
          return '';
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load products for preparation.');
      } finally {
        setLoading(false);
      }
    },
    [getCompletedCount, requestedProductId, syncStageFromProduct],
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const product = products.find((p) => p.id === selectedId);
  const primaryVariant = product?.variants?.[0];
  const completedCount = getCompletedCount(product);
  const prepStatusLabel = completedCount === 0 ? 'Not Started' : 'In Progress';

  const activeStage = STAGES[activeIndex] ?? STAGES[0];
  const isUpdatingCompletedStage = activeIndex < completedCount;
  const activeCtaLabel = isUpdatingCompletedStage ? activeStage.updateCta : activeStage.cta;
  const numericSelling = Number(sellingPrice.replace(/[^0-9.]/g, '')) || 0;

  // Stage 3 Photography: add files to local draft state ONLY (nothing saved to DB until Complete/Update Photography is clicked)
  const handleSelectPhotoFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    try {
      const addedDrafts: PhotoDraftItem[] = [];
      for (const file of files) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        addedDrafts.push({
          key: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: dataUrl,
          filename: file.name,
          mimetype: file.type || 'image/jpeg',
          isNew: true,
        });
      }
      setPhotoDrafts((prev) => {
        const next = [...prev, ...addedDrafts];
        setPrimaryPhotoKey((currPrimary) =>
          currPrimary && next.some((item) => item.key === currPrimary)
            ? currPrimary
            : (next[0]?.key ?? ''),
        );
        return next;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to read selected image file', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveDraftPhoto = (keyToRemove: string) => {
    setPhotoDrafts((prev) => {
      const next = prev.filter((item) => item.key !== keyToRemove);
      setPrimaryPhotoKey((currPrimary) =>
        currPrimary === keyToRemove ? (next[0]?.key ?? '') : currPrimary,
      );
      return next;
    });
  };

  const handleRevertStep = async (
    stepKey?: string,
    source: 'stage' | 'last' = 'stage',
  ) => {
    if (!product || isBusy) return;
    const stepToRevert =
      stepKey ||
      activeStage.apiStep ||
      (activeStage.key === 'pricing' ? 'PRICING' : 'FINAL_REVIEW');
    setRevertAction(source);
    try {
      const fresh = (await catalogueApi.revertPreparation(product.id, {
        step: stepToRevert,
      })) as PrepProduct;
      showToast(`Reverted ${activeStage.label} step`, 'success');
      if (fresh?.id) {
        setProducts((prev) =>
          prev.map((item) => (item.id === fresh.id ? { ...item, ...fresh } : item)),
        );
        syncStageFromProduct({ ...product, ...fresh });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to undo preparation step', 'error');
    } finally {
      setRevertAction(null);
    }
  };

  const handleRestartPreparation = async () => {
    if (!product || isBusy) return;
    setRevertAction('resetAll');
    try {
      const fresh = (await catalogueApi.revertPreparation(product.id, {
        resetAll: true,
      })) as PrepProduct;
      showToast(`Preparation reset to Not Started for ${product.name}`, 'success');
      if (fresh?.id) {
        setProducts((prev) =>
          prev.map((item) => (item.id === fresh.id ? { ...item, ...fresh } : item)),
        );
        syncStageFromProduct({ ...product, ...fresh });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to reset preparation', 'error');
    } finally {
      setRevertAction(null);
    }
  };

  const handleAdvance = async () => {
    if (!product || isBusy) return;
    setSubmitting(true);
    try {
      if (activeStage.key === 'inspection') {
        const stepNotes = `${condition} · ${functionalTest}${
          inspectionNotes.trim() ? ` — ${inspectionNotes.trim()}` : ''
        }`;
        await catalogueApi.completePreparation(product.id, 'INSPECTION', stepNotes);
        showToast(
          isUpdatingCompletedStage ? 'Inspection updated' : 'Inspection completed',
          'success',
        );
      } else if (activeStage.key === 'cleaning') {
        await catalogueApi.completePreparation(product.id, 'CLEANING', cleaningNotes.trim());
        showToast(
          isUpdatingCompletedStage ? 'Cleaning updated' : 'Cleaning completed',
          'success',
        );
      } else if (activeStage.key === 'photography') {
        if (photoDrafts.length === 0) {
          throw new Error('Please add at least one product photo before completing Photography.');
        }
        // Order photos so the selected "face of the product" (primaryPhotoKey) is first (position 0)
        const primaryItem =
          photoDrafts.find((item) => item.key === primaryPhotoKey) ?? photoDrafts[0];
        const orderedDrafts = [
          primaryItem,
          ...photoDrafts.filter((item) => item.key !== primaryItem.key),
        ];

        const finalUrls: string[] = [];
        for (const item of orderedDrafts) {
          if (item.isNew) {
            const uploaded = await governanceApi.uploadFile({
              folder: 'products',
              filename: item.filename || 'product.jpg',
              mimetype: item.mimetype || 'image/jpeg',
              base64: item.url,
            });
            if (uploaded.publicUrl) {
              finalUrls.push(uploaded.publicUrl);
            }
          } else {
            finalUrls.push(item.url);
          }
        }

        await catalogueApi.syncProductMedia(product.id, finalUrls);
        await catalogueApi.completePreparation(product.id, 'PHOTOGRAPHY', photographyNotes.trim());
        showToast(
          isUpdatingCompletedStage
            ? 'Photography and product face image updated'
            : 'Photography completed and photos saved',
          'success',
        );
      } else if (activeStage.key === 'wrapping') {
        await catalogueApi.completePreparation(product.id, 'WRAPPING', wrappingNotes.trim());
        showToast(
          isUpdatingCompletedStage ? 'Wrapping updated' : 'Wrapping completed',
          'success',
        );
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
        showToast(
          isUpdatingCompletedStage
            ? 'Price proposal updated'
            : 'Price proposal submitted for manager approval',
          'success',
        );
      } else if (activeStage.key === 'approval') {
        await catalogueApi.publishProduct(product.id);
        showToast(
          `${product.name} prepared, published to storefront, and moved to active inventory`,
          'success',
        );
      }

      if (activeStage.key === 'approval') {
        // Product is now published — remove from active preparation queue immediately
        setProducts((prev) => {
          const remaining = prev.filter((item) => item.id !== product.id);
          const nextItem = remaining[0];
          if (nextItem) {
            setSelectedId(nextItem.id);
            syncStageFromProduct(nextItem);
          } else {
            setSelectedId('');
          }
          return remaining;
        });
      } else {
        // Fetch only the single updated product instead of reloading the entire catalogue & all shipments
        const fresh = (await catalogueApi.getProduct(product.id)) as PrepProduct;
        if (fresh?.id) {
          setProducts((prev) =>
            prev.map((item) => (item.id === fresh.id ? { ...item, ...fresh } : item)),
          );
          syncStageFromProduct(
            { ...product, ...fresh },
            isUpdatingCompletedStage ? activeIndex : undefined,
          );
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save preparation step', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const rawAvailableQty = (product?.variants ?? []).reduce(
    (s, v) => s + (v.stockLots ?? []).reduce((ls, l) => ls + (l.available ?? 0), 0),
    0,
  );
  const rawUnavailableQty = (product?.variants ?? []).reduce(
    (s, v) => s + (v.stockLots ?? []).reduce((ls, l) => ls + (l.unavailable ?? 0), 0),
    0,
  );
  // While a product is in Preparation (< 6 stages complete), its stock is held as unavailable onboarding stock
  const availableQty = completedCount >= 6 ? rawAvailableQty : 0;
  const unavailableQty =
    completedCount >= 6 ? rawUnavailableQty : rawUnavailableQty + rawAvailableQty;

  const selectedFacePhoto =
    photoDrafts.find((item) => item.key === primaryPhotoKey) ?? photoDrafts[0];
  const previewImageUrl =
    selectedFacePhoto?.url ||
    (Array.isArray(product?.media) && product.media[0]?.url ? String(product.media[0].url) : '') ||
    (Array.isArray(product?.images) && product.images[0] ? String(product.images[0]) : '') ||
    '/images/sofa.avif';

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
            <div style={{ minWidth: 280, flex: '1 1 280px' }}>
              <SearchableSelect
                ariaLabel="Select product"
                options={products.map((p) => {
                  const doneCount = getCompletedCount(p);
                  const statusLbl = doneCount === 0 ? 'Not Started' : 'In Progress';
                  return {
                    value: p.id,
                    label: `${p.name} (${statusLbl} · ${doneCount}/6)`,
                    searchText: `${p.name} ${p.category ?? ''} ${statusLbl}`,
                  };
                })}
                value={selectedId}
                onChange={(nextId) => {
                  const next = products.find((p) => p.id === nextId);
                  setSelectedId(nextId);
                  syncStageFromProduct(next);
                }}
                placeholder="Select product…"
                searchPlaceholder="Type product name or status…"
              />
            </div>
          )}
          {product && (
            <span className={`acct-pill ${completedCount === 0 ? 'gray' : 'amber'}`}>
              ● {prepStatusLabel} ({completedCount} of 6)
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <PreparationSkeleton />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => loadProducts()} />
      ) : !product ? (
        <EmptyState
          title="All eligible products are prepared and published"
          description="Only products with status 'Not Started' or 'In Progress' appear here. Create a new product draft in Product Catalogue or reopen preparation on an existing product."
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span className="ship-eyebrow">
                    Stage {activeIndex + 1}
                    {isUpdatingCompletedStage ? ' · COMPLETED (EDITABLE)' : ''}
                  </span>
                  <h3 style={{ fontSize: 18, marginTop: 4 }}>
                    {activeStage.key === 'pricing'
                      ? 'Pricing proposal'
                      : activeStage.key === 'approval'
                        ? 'Final publication approval'
                        : activeStage.label}
                  </h3>
                </div>
                {isUpdatingCompletedStage && (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={revertAction === 'stage'}
                    loadingText="Reverting…"
                    disabled={isBusy}
                    onClick={() =>
                      setConfirmPrepReset({
                        kind: 'revert',
                        stepKey:
                          activeStage.apiStep ||
                          (activeStage.key === 'pricing' ? 'PRICING' : 'FINAL_REVIEW'),
                        stepLabel: activeStage.label,
                        source: 'stage',
                      })
                    }
                  >
                    <RotateCcw size={13} />
                    <span>Undo {activeStage.label}</span>
                  </Button>
                )}
              </div>

              {activeStage.key === 'inspection' && (
                <>
                  <p className="ship-card-sub">
                    Record physical condition, functional test results, and inspection findings.
                  </p>

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

                  <label className="login-field">
                    <span>Inspection notes</span>
                    <textarea
                      rows={3}
                      value={inspectionNotes}
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      placeholder="Record inspection findings and defect details…"
                      style={{
                        width: '100%',
                        border: '0.8px solid var(--line)',
                        borderRadius: 3,
                        padding: 12,
                        fontSize: 13,
                      }}
                    />
                  </label>

                  <div
                    style={{
                      marginTop: 14,
                      padding: '12px 14px',
                      background: '#f7faf8',
                      border: '1px solid #d5e5dc',
                      borderRadius: 4,
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div>
                      <span className="ship-eyebrow" style={{ color: 'var(--green)' }}>
                        SERIALIZED / INDIVIDUAL UNIT TAGGING ({trackedUnits.length})
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        Register manufacturer serial numbers (for TVs, appliances, electronics) or individual open-box scratch-and-dent unit tags.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        value={newUnitCode}
                        onChange={(e) => setNewUnitCode(e.target.value)}
                        placeholder="Serial # or Asset Tag (auto if blank)"
                        style={{
                          flex: '1 1 160px',
                          padding: '7px 10px',
                          border: '0.8px solid var(--line)',
                          borderRadius: 3,
                          fontSize: 12.5,
                          background: '#fff',
                        }}
                      />
                      <select
                        value={newUnitCondition}
                        onChange={(e) => setNewUnitCondition(e.target.value)}
                        style={{
                          padding: '7px 10px',
                          border: '0.8px solid var(--line)',
                          borderRadius: 3,
                          fontSize: 12.5,
                          background: '#fff',
                        }}
                      >
                        <option value="NEW">NEW</option>
                        <option value="GOOD">GOOD</option>
                        <option value="FAIR">FAIR (Scratch &amp; Dent)</option>
                      </select>
                      <input
                        value={newUnitDefectNotes}
                        onChange={(e) => setNewUnitDefectNotes(e.target.value)}
                        placeholder="Unit-specific defect note (optional)"
                        style={{
                          flex: '1 1 180px',
                          padding: '7px 10px',
                          border: '0.8px solid var(--line)',
                          borderRadius: 3,
                          fontSize: 12.5,
                          background: '#fff',
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        loading={addingUnit}
                        loadingText="Adding…"
                        disabled={addingUnit}
                        onClick={handleAddTrackedUnit}
                      >
                        + Add Unit Tag
                      </Button>
                    </div>
                    {trackedUnits.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {trackedUnits.map((u) => (
                          <span
                            key={u.id}
                            style={{
                              padding: '3px 8px',
                              fontSize: 11.5,
                              background: '#fff',
                              border: '1px solid #cce0d4',
                              borderRadius: 3,
                              color: 'var(--ink)',
                            }}
                          >
                            <strong>{u.unitCode}</strong> · {u.condition}
                            {u.defectNotes ? ` (${u.defectNotes})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeStage.key === 'cleaning' && (
                <>
                  <p className="ship-card-sub">
                    Record cleaning and surface preparation notes before photography.
                  </p>

                  <label className="login-field" style={{ marginTop: 14 }}>
                    <span>Cleaning notes</span>
                    <textarea
                      rows={3}
                      value={cleaningNotes}
                      onChange={(e) => setCleaningNotes(e.target.value)}
                      placeholder="Record cleaning, polishing, or treatment details…"
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

              {activeStage.key === 'photography' && (
                <>
                  <p className="ship-card-sub">
                    Add product photos and select which image will be used as the face of the
                    product. Photos are saved to the database when you click{' '}
                    <strong>{activeCtaLabel}</strong>.
                  </p>

                  <label className="login-field" style={{ marginTop: 14 }}>
                    <span>Photography notes</span>
                    <textarea
                      rows={3}
                      value={photographyNotes}
                      onChange={(e) => setPhotographyNotes(e.target.value)}
                      placeholder="Record photo angles, lighting, or gallery notes…"
                      style={{
                        width: '100%',
                        border: '0.8px solid var(--line)',
                        borderRadius: 3,
                        padding: 12,
                        fontSize: 13,
                      }}
                    />
                  </label>

                  {photoDrafts.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--ink)',
                          marginBottom: 8,
                        }}
                      >
                        Product photos ({photoDrafts.length}) · Select one as the product face
                      </span>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                          gap: 12,
                        }}
                      >
                        {photoDrafts.map((item, i) => {
                          const isPrimary = item.key === primaryPhotoKey;
                          return (
                            <div
                              key={item.key}
                              style={{
                                position: 'relative',
                                border: isPrimary
                                  ? '2px solid var(--green)'
                                  : '1px solid var(--line)',
                                borderRadius: 4,
                                overflow: 'hidden',
                                background: '#f8faf9',
                                boxShadow: isPrimary
                                  ? '0 0 0 2px rgba(18, 93, 58, 0.12)'
                                  : undefined,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setPrimaryPhotoKey(item.key)}
                                title="Set as face of the product"
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: 0,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  position: 'relative',
                                }}
                              >
                                <img
                                  src={item.url}
                                  alt={`${product.name} photo ${i + 1}`}
                                  style={{
                                    width: '100%',
                                    height: 98,
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                />
                                {isPrimary && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      top: 6,
                                      left: 6,
                                      background: 'var(--green)',
                                      color: '#fff',
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '2px 7px',
                                      borderRadius: 3,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Star size={10} fill="#fff" />
                                    Product face
                                  </span>
                                )}
                              </button>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  fontSize: 11,
                                  color: 'var(--muted)',
                                  gap: 6,
                                }}
                              >
                                {isPrimary ? (
                                  <strong style={{ color: 'var(--green)', fontSize: 11 }}>
                                    Face image
                                  </strong>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPrimaryPhotoKey(item.key)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: 'var(--ink)',
                                      fontWeight: 600,
                                      fontSize: 11,
                                      cursor: 'pointer',
                                      padding: 0,
                                      textDecoration: 'underline',
                                    }}
                                  >
                                    Set as face
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label={`Remove photo ${i + 1}`}
                                  onClick={() => handleRemoveDraftPhoto(item.key)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#b42318',
                                    cursor: 'pointer',
                                    padding: 2,
                                    display: 'inline-flex',
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    aria-label="Select product photos"
                    style={{ display: 'none' }}
                    onChange={(e) => handleSelectPhotoFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    className="ship-back-btn"
                    style={{ cursor: 'pointer', display: 'inline-flex', marginTop: 12 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={13} />
                    <span>Add product photos (multiple allowed)</span>
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
                    Propose a retail selling price for manager approval based on landed acquisition
                    and freight costs.
                  </p>

                  {(() => {
                    const acqCents = product.unitAcquisitionCostCents ?? 0;
                    const freightCents = product.allocatedFreightAndDutyCents ?? 0;
                    const landedCents =
                      product.estimatedLandedCostCents ?? acqCents + freightCents;
                    const proposedCents = Math.round(numericSelling * 100);
                    const marginCents = proposedCents - landedCents;
                    const marginPct =
                      proposedCents > 0 ? Math.round((marginCents / proposedCents) * 100) : 0;

                    return (
                      <div
                        style={{
                          marginTop: 14,
                          padding: '12px 14px',
                          background: '#f7faf8',
                          border: '1px solid #d5e5dc',
                          borderRadius: 4,
                          fontSize: 12.5,
                          display: 'grid',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Originating shipment</span>
                          <strong>{product.shipmentReference || 'Warehouse'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Unit acquisition cost (FOB)</span>
                          <strong>GHS {(acqCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>
                            Allocated freight, duty &amp; clearing
                          </span>
                          <strong>GHS {(freightCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            borderTop: '0.8px solid var(--line)',
                            paddingTop: 6,
                          }}
                        >
                          <strong style={{ color: 'var(--ink)' }}>Estimated landed cost / unit</strong>
                          <strong style={{ color: 'var(--ink)' }}>
                            GHS {(landedCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        {proposedCents > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Projected gross margin</span>
                            <strong
                              style={{
                                color:
                                  landedCents > 0 && marginCents < 0
                                    ? '#b42318'
                                    : 'var(--green)',
                              }}
                            >
                              GHS {(marginCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                              ({marginPct}%)
                            </strong>
                          </div>
                        )}
                      </div>
                    );
                  })()}

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
                src={previewImageUrl}
                alt={product.name}
                className="prep-side-img"
              />

              <h3>Publication readiness</h3>

              <dl className="ship-dl">
                <div className="ship-dl-row">
                  <dt>Preparation status</dt>
                  <dd>{prepStatusLabel}</dd>
                </div>
                <div className="ship-dl-row">
                  <dt>Preparation steps</dt>
                  <dd>{completedCount} / 6</dd>
                </div>
                <div className="ship-dl-row">
                  <dt>Product images</dt>
                  <dd>{photoDrafts.length}</dd>
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

              <Button
                type="button"
                variant="primary"
                loading={submitting}
                loadingText="Saving…"
                disabled={
                  isBusy ||
                  (activeStage.key === 'wrapping' && !wrappedChecked) ||
                  (activeStage.key === 'photography' && photoDrafts.length === 0)
                }
                style={{ width: '100%', marginTop: 16 }}
                onClick={handleAdvance}
              >
                <span>{activeCtaLabel}</span>
                <ArrowRight size={15} />
              </Button>

              {completedCount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  {completedCount >= 1 && (
                    <Button
                      type="button"
                      variant="secondary"
                      loading={revertAction === 'last'}
                      loadingText="Reverting…"
                      disabled={isBusy}
                      style={{ flex: 1 }}
                      onClick={() => {
                        const prevStage = STAGES[Math.max(0, completedCount - 1)];
                        setConfirmPrepReset({
                          kind: 'revert',
                          stepKey:
                            prevStage?.apiStep ||
                            (prevStage?.key === 'pricing' ? 'PRICING' : 'FINAL_REVIEW'),
                          stepLabel: prevStage?.label ?? 'last step',
                          source: 'last',
                        });
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Revert</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    loading={revertAction === 'resetAll'}
                    loadingText="Resetting…"
                    disabled={isBusy}
                    style={{ flex: 1 }}
                    onClick={() => setConfirmPrepReset({ kind: 'restartAll' })}
                  >
                    <RotateCcw size={13} />
                    <span>Restart all</span>
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="secondary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => setFloorTagModalOpen(true)}
              >
                <span>Print Showroom Floor Tag / QR</span>
              </Button>
            </aside>
          </div>

          {floorTagModalOpen && (
            <div
              className="login-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Showroom Floor Tag"
              onClick={() => setFloorTagModalOpen(false)}
            >
              <div
                className="login-card"
                style={{ maxWidth: 420 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="login-inner">
                  <div className="eyebrow">AMERICANHOMES WAREHOUSE SHOWROOM · FLOOR TAG</div>
                  <h2 className="login-title" style={{ fontSize: 22, marginTop: 4 }}>
                    {product.name}
                  </h2>
                  <p className="login-subtitle">
                    SKU: <strong>{primaryVariant?.sku ?? product.id.slice(-8).toUpperCase()}</strong> · Condition:{' '}
                    <strong>{condition.toUpperCase()}</strong>
                  </p>
                  <div
                    style={{
                      marginTop: 14,
                      padding: '14px 16px',
                      background: '#f7faf8',
                      border: '1.5px solid var(--green)',
                      borderRadius: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>
                        SHOWROOM CASH &amp; CARRY PRICE
                      </span>
                      <strong style={{ fontSize: 24, color: 'var(--green)' }}>
                        GHS{' '}
                        {(
                          numericSelling > 0
                            ? numericSelling
                            : (primaryVariant?.priceCents ?? 0) / 100
                        ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: '6px 10px',
                        border: '1px dashed var(--green)',
                        borderRadius: 4,
                        fontSize: 10.5,
                        textAlign: 'center',
                        background: '#fff',
                      }}
                    >
                      <strong style={{ display: 'block', color: 'var(--ink)' }}>SCAN / VISIT</strong>
                      <span style={{ color: 'var(--muted)' }}>/shop/{product.id.slice(-8)}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      background: '#fff',
                      border: '0.8px solid var(--line)',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: 4 }}>
                      Inspection &amp; Defect Disclosure:
                    </strong>
                    <span style={{ color: 'var(--muted)' }}>
                      {product.defectDisclosure ||
                        inspectionNotes.trim() ||
                        'Inspected & tested by AmericanHomes QA. No major cosmetic or functional defects.'}
                    </span>
                    {trackedUnits.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink)' }}>
                        <strong>Registered Unit Tag(s):</strong>{' '}
                        {trackedUnits.map((u) => u.unitCode).join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Button
                      type="button"
                      variant="secondary"
                      style={{ flex: 1 }}
                      onClick={() => setFloorTagModalOpen(false)}
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        if (typeof window !== 'undefined') window.print();
                      }}
                    >
                      Print Floor Tag
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        open={Boolean(confirmPrepReset && product)}
        title={
          confirmPrepReset?.kind === 'restartAll'
            ? 'Restart all preparation steps?'
            : `Revert ${confirmPrepReset?.kind === 'revert' ? confirmPrepReset.stepLabel : 'step'}?`
        }
        targetName={product?.name}
        description={
          confirmPrepReset?.kind === 'restartAll'
            ? 'This will clear every completed preparation step, reset the draft price to GHS 0, and return the product to Not Started.'
            : 'This will undo the selected preparation step and any steps completed after it.'
        }
        reversible={false}
        destructive={true}
        confirmLabel={
          confirmPrepReset?.kind === 'restartAll' ? 'Restart all' : 'Revert step'
        }
        loading={revertAction !== null}
        onCancel={() => setConfirmPrepReset(null)}
        onConfirm={async () => {
          const action = confirmPrepReset;
          setConfirmPrepReset(null);
          if (!action) return;
          if (action.kind === 'restartAll') {
            await handleRestartPreparation();
          } else {
            await handleRevertStep(action.stepKey, action.source);
          }
        }}
      />
    </div>
  );
}

export default function StaffPreparationPage() {
  return (
    <Suspense fallback={<PreparationSkeleton />}>
      <StaffPreparationContent />
    </Suspense>
  );
}
