'use client';

import {
  ReceivingNoteModal,
  StartReceivingSessionModal,
} from '@/components/staff/receiving/ReceivingModals';
import {
  ActiveFilterChips,
  HierarchicalFilterDropdown,
  SortableHeader,
} from '@/components/staff/TableControls';
import { Button, ConfirmDialog, EmptyState, ErrorState, SearchableSelect, TableSkeleton } from '@/components/ui';
import { receivingApi, shipmentsApi } from '@/lib/api';
import {
  applyFiltersAndSort,
  cycleSort,
  deriveFilterCategories,
  type FilterCategoryDef,
  type FilterValueMap,
  type SortColumnDef,
  type SortState,
} from '@/lib/tableUtils';
import { useToast } from '@/providers/toast.provider';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Package,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type InspectionStatus = 'GOOD' | 'DAMAGED' | 'INCOMPLETE';

type ReceivingItem = {
  id: string;
  manifestItemId?: string;
  variantId?: string;
  product: string;
  variant: string;
  expected: number;
  received: number;
  inspection: InspectionStatus;
  note: string;
  persisted: boolean;
};

type ApiSession = {
  id: string;
  shipmentId: string;
  status: string;
  openedAt: string;
  shipment?: {
    id: string;
    reference: string;
    providerName?: string;
    manifestRevisions?: Array<{
      items?: Array<{
        id: string;
        variantId?: string | null;
        productName?: string;
        description?: string;
        quantity?: number;
        expectedQty?: number;
      }>;
    }>;
  };
  lines?: Array<{
    id: string;
    manifestItemId?: string | null;
    expectedQty?: number | null;
    receivedQty: number;
    condition?: string;
    notes?: string | null;
    createdAt?: string;
  }>;
};

type ApiShipment = {
  id: string;
  reference: string;
  providerName: string;
  status: string;
};

export default function StaffReceivingPage() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [shipments, setShipments] = useState<ApiShipment[]>([]);
  const [sessionFilters, setSessionFilters] = useState<FilterValueMap>({});
  const [itemFilters, setItemFilters] = useState<FilterValueMap>({});
  const [sort, setSort] = useState<SortState>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [items, setItems] = useState<ReceivingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closingSession, setClosingSession] = useState(false);

  const [startModalOpen, setStartModalOpen] = useState(false);
  const [newShipmentId, setNewShipmentId] = useState('');
  const [startingSession, setStartingSession] = useState(false);

  const [noteModalItemId, setNoteModalItemId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  const hydrateSessionItems = useCallback((session: ApiSession | undefined) => {
    if (!session) {
      setItems([]);
      return;
    }
    const manifestItems = session.shipment?.manifestRevisions?.[0]?.items ?? [];
    const sortedLines = [...(session.lines ?? [])].sort((a, b) =>
      (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
    );
    const linesByManifest = new Map(
      sortedLines.filter((l) => l.manifestItemId).map((l) => [l.manifestItemId!, l]),
    );

    const rows: ReceivingItem[] = manifestItems.map((m) => {
      const recorded = linesByManifest.get(m.id);
      const expected = Number(m.quantity ?? m.expectedQty ?? 0);
      return {
        id: recorded?.id ?? `manifest-${m.id}`,
        manifestItemId: m.id,
        variantId: m.variantId ?? undefined,
        product: m.productName ?? m.description ?? 'Manifest item',
        variant: m.variantId ? `Variant ${m.variantId.slice(-6)}` : 'Manifest item',
        expected,
        received: recorded ? Number(recorded.receivedQty ?? 0) : expected,
        inspection: (recorded?.condition as InspectionStatus) || 'GOOD',
        note: recorded?.notes ?? '',
        persisted: Boolean(recorded),
      };
    });

    for (const l of session.lines ?? []) {
      if (!l.manifestItemId) {
        rows.push({
          id: l.id,
          product: 'Unmanifested / Extra Item',
          variant: 'Unexpected goods',
          expected: l.expectedQty ?? 0,
          received: l.receivedQty,
          inspection: (l.condition as InspectionStatus) || 'HOLD',
          note: l.notes ?? '',
          persisted: true,
        });
      }
    }

    setItems(rows);
  }, []);

  const sortSessions = useCallback((list: ApiSession[]) => {
    return [...list].sort((a, b) => {
      const aOpen = a.status === 'OPEN' ? 0 : 1;
      const bOpen = b.status === 'OPEN' ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      const aHasLines = (a.lines?.length ?? 0) > 0 ? 0 : 1;
      const bHasLines = (b.lines?.length ?? 0) > 0 ? 0 : 1;
      if (aHasLines !== bHasLines) return aHasLines - bHasLines;
      return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
    });
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const requestedShipmentId =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('shipmentId')
          : null;
      const [sessList, shpList] = await Promise.all([
        receivingApi.listSessions(),
        shipmentsApi.list().catch(() => []),
      ]);
      const typedSessions = sortSessions(
        (Array.isArray(sessList) ? sessList : []) as ApiSession[],
      );
      const typedShipments = (Array.isArray(shpList) ? shpList : []) as ApiShipment[];
      setSessions(typedSessions);
      setShipments(typedShipments);
      const eligibleShipments = typedShipments.filter(
        (shp) =>
          ['ARRIVED', 'RECEIVING', 'RECONCILIATION_PENDING'].includes(shp.status) &&
          !typedSessions.some((sess) => sess.shipmentId === shp.id && sess.status === 'OPEN'),
      );
      if (
        requestedShipmentId &&
        eligibleShipments.some((s) => s.id === requestedShipmentId)
      ) {
        setNewShipmentId(requestedShipmentId);
      } else if (eligibleShipments[0]) {
        setNewShipmentId((prev) =>
          eligibleShipments.some((s) => s.id === prev) ? prev : eligibleShipments[0].id,
        );
      } else {
        setNewShipmentId('');
      }
      setSelectedSessionId((prevSelected) => {
        const fromQuery = requestedShipmentId
          ? typedSessions.find((s) => s.shipmentId === requestedShipmentId && s.status === 'OPEN') ??
            typedSessions.find((s) => s.shipmentId === requestedShipmentId)
          : undefined;
        if (
          !prevSelected &&
          requestedShipmentId &&
          !fromQuery &&
          eligibleShipments.some((s) => s.id === requestedShipmentId)
        ) {
          setStartModalOpen(true);
        }
        const active =
          (prevSelected ? typedSessions.find((s) => s.id === prevSelected) : undefined) ??
          fromQuery ??
          typedSessions[0];
        if (active) {
          hydrateSessionItems(active);
          return active.id;
        }
        setItems([]);
        return prevSelected;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load receiving sessions.');
    } finally {
      setLoading(false);
    }
  }, [hydrateSessionItems, sortSessions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openShipmentIds = new Set(
    sessions.filter((s) => s.status === 'OPEN').map((s) => s.shipmentId),
  );
  const eligibleShipmentsForNewSession = shipments.filter(
    (s) =>
      ['ARRIVED', 'RECEIVING', 'RECONCILIATION_PENDING'].includes(s.status) &&
      !openShipmentIds.has(s.id),
  );
  const sessionFilterDefs: FilterCategoryDef<ApiSession>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Session status',
        accessor: (s) => (s.status === 'OPEN' ? 'Open' : 'Closed'),
      },
    ],
    [],
  );

  const sessionFilterCategories = useMemo(
    () => deriveFilterCategories(sessions, sessionFilterDefs),
    [sessions, sessionFilterDefs],
  );

  const visibleSessions = useMemo(
    () =>
      applyFiltersAndSort(
        sessions,
        sessionFilters,
        sessionFilterDefs,
        null,
        [],
      ),
    [sessions, sessionFilters, sessionFilterDefs],
  );

  const itemFilterDefs: FilterCategoryDef<ReceivingItem>[] = useMemo(
    () => [
      { key: 'inspection', label: 'Inspection', accessor: (i) => i.inspection },
      {
        key: 'variance',
        label: 'Variance',
        accessor: (i) => {
          const diff = i.received - i.expected;
          return diff === 0 ? 'Matched' : diff < 0 ? 'Missing' : 'Excess';
        },
      },
    ],
    [],
  );

  const itemSortDefs: SortColumnDef<ReceivingItem>[] = useMemo(
    () => [
      { key: 'product', type: 'string', accessor: (i) => i.product },
      { key: 'expected', type: 'number', accessor: (i) => i.expected },
      { key: 'received', type: 'number', accessor: (i) => i.received },
      { key: 'variance', type: 'number', accessor: (i) => i.received - i.expected },
      {
        key: 'inspection',
        type: 'status',
        statusOrder: ['GOOD', 'INCOMPLETE', 'DAMAGED'],
        accessor: (i) => i.inspection,
      },
    ],
    [],
  );

  const itemFilterCategories = useMemo(
    () => deriveFilterCategories(items, itemFilterDefs),
    [items, itemFilterDefs],
  );

  const visibleItems = useMemo(
    () => applyFiltersAndSort(items, itemFilters, itemFilterDefs, sort, itemSortDefs),
    [items, itemFilters, itemFilterDefs, sort, itemSortDefs],
  );
  const activeSession =
    visibleSessions.find((s) => s.id === selectedSessionId) ??
    sessions.find((s) => s.id === selectedSessionId);

  const persistLine = async (item: ReceivingItem) => {
    if (!activeSession || savingLineId) return;
    setSavingLineId(item.id);
    try {
      await receivingApi.recordLine(activeSession.id, {
        ...(item.manifestItemId ? { manifestItemId: item.manifestItemId } : {}),
        ...(item.variantId ? { variantId: item.variantId } : {}),
        receivedQty: item.received,
        condition: item.inspection,
        notes: item.note || undefined,
      });
      setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, persisted: true } : r)));
      showToast(`Recorded ${item.product}: ${item.received} received`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save receipt line', 'error');
    } finally {
      setSavingLineId(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeSession || activeSession.status !== 'OPEN' || items.length === 0 || savingDraft) return;
    setSavingDraft(true);
    try {
      for (const item of items) {
        await receivingApi.recordLine(activeSession.id, {
          ...(item.manifestItemId ? { manifestItemId: item.manifestItemId } : {}),
          ...(item.variantId ? { variantId: item.variantId } : {}),
          receivedQty: item.received,
          condition: item.inspection,
          notes: item.note || undefined,
        });
      }
      setItems((prev) => prev.map((r) => ({ ...r, persisted: true })));
      showToast('Draft saved — session remains OPEN so you can continue later', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save receiving draft', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const adjustQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, received: Math.max(0, item.received + delta) } : item,
      ),
    );
  };

  const handleStartSession = async () => {
    if (!newShipmentId || startingSession) return;
    setStartingSession(true);
    try {
      const created = (await receivingApi.startSession({ shipmentId: newShipmentId })) as {
        id: string;
      };
      setStartModalOpen(false);
      setSelectedSessionId(created.id);
      showToast('Receiving session opened', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to start receiving session', 'error');
    } finally {
      setStartingSession(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession || closingSession) return;
    setClosingSession(true);
    try {
      await receivingApi.closeSession(activeSession.id);
      setConfirmClose(false);
      showToast('Receiving session closed for manager review', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to close receiving session', 'error');
    } finally {
      setClosingSession(false);
    }
  };

  const totalExpected = items.reduce((sum, i) => sum + i.expected, 0);
  const totalReceived = items.reduce((sum, i) => sum + i.received, 0);
  const matchedCount = items.filter((i) => i.received === i.expected).length;
  const discrepancyCount = items.filter((i) => i.received !== i.expected).length;

  return (
    <div data-node-id="2:17501">
      <div className="dash-head">
        <div>
          <span className="ship-eyebrow">
            {activeSession?.shipment?.reference ?? 'RECEIVING'} · RECEIVING SESSION
          </span>
          <h1 className="dash-title" style={{ marginTop: 4 }}>
            Receive &amp; reconcile stock
          </h1>
          <p className="dash-sub">
            {activeSession
              ? `Session ${activeSession.id.slice(-6).toUpperCase()} · Status: ${activeSession.status}`
              : 'Select or open a receiving session for an arrived shipment.'}
          </p>
        </div>

        <div className="dash-actions">
          <HierarchicalFilterDropdown
            categories={sessionFilterCategories}
            selected={sessionFilters}
            onChange={(next) => {
              setSessionFilters(next);
              const filtered = applyFiltersAndSort(
                sessions,
                next,
                sessionFilterDefs,
                null,
                [],
              );
              if (filtered[0] && !filtered.some((s) => s.id === selectedSessionId)) {
                setSelectedSessionId(filtered[0].id);
                hydrateSessionItems(filtered[0]);
              }
            }}
            label="Session"
          />
          {visibleSessions.length > 0 && (
            <div style={{ minWidth: 260, flex: '1 1 260px', maxWidth: 340 }}>
              <SearchableSelect
                ariaLabel="Select receiving session"
                options={visibleSessions.map((s) => ({
                  value: s.id,
                  label: `${s.shipment?.reference ?? s.shipmentId} · #${s.id.slice(-4).toUpperCase()} (${s.status})`,
                  searchText: `${s.shipment?.reference ?? ''} ${s.shipmentId} ${s.id} ${s.status}`,
                }))}
                value={selectedSessionId}
                onChange={(nextId) => {
                  const next = sessions.find((s) => s.id === nextId);
                  setSelectedSessionId(nextId);
                  hydrateSessionItems(next);
                }}
                placeholder="Select receiving session…"
                searchPlaceholder="Type shipment ref or session ID…"
              />
            </div>
          )}
          <button type="button" className="button" onClick={() => setStartModalOpen(true)}>
            <Plus size={14} />
            <span>New session</span>
          </button>
          {activeSession && activeSession.status === 'OPEN' && (
            <>
              {items.length > 0 && (
                <Button
                  type="button"
                  loading={savingDraft}
                  loadingText="Saving draft…"
                  disabled={closingSession || Boolean(savingLineId)}
                  onClick={handleSaveDraft}
                >
                  Save draft
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                loading={closingSession}
                loadingText="Closing…"
                disabled={savingDraft}
                onClick={() => setConfirmClose(true)}
              >
                Close &amp; submit session
              </Button>
            </>
          )}
        </div>
      </div>

      <section className="rec-stats-strip">
        <div className="rec-stat-cell">
          <Package size={20} color="var(--green)" />
          <div>
            <small>Session progress</small>
            <strong>
              {totalReceived} / {totalExpected} items
            </strong>
          </div>
        </div>
            <div className="rec-stat-cell">
          <CheckCircle2 size={20} color="var(--green)" />
          <div>
            <small>Matched lines</small>
            <strong>
              {matchedCount} {matchedCount === 1 ? 'line' : 'lines'}
            </strong>
          </div>
        </div>
        <div className="rec-stat-cell">
          <AlertTriangle size={20} color="#b45309" />
          <div>
            <small>Discrepancies</small>
            <strong>
              {discrepancyCount} {discrepancyCount === 1 ? 'line' : 'lines'}
            </strong>
          </div>
        </div>
      </section>

      <div className="rec-info-banner">
        <Info size={16} color="#49616e" style={{ flexShrink: 0 }} />
        <span>
          New stock enters as <strong>unavailable</strong> until product onboarding
          is complete. Unexpected or damaged goods require management disposition
          before release.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <ActiveFilterChips
          categories={itemFilterCategories}
          selected={itemFilters}
          onChange={setItemFilters}
        />
        <HierarchicalFilterDropdown
          categories={itemFilterCategories}
          selected={itemFilters}
          onChange={setItemFilters}
          label="Filter lines"
        />
      </div>

      <section className="acct-panel" style={{ padding: 0 }}>
        <div className="staff-table-head staff-rec-cols">
          <SortableHeader label="ITEM" sortKey="product" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="EXPECTED" sortKey="expected" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="ACTUAL RECEIVED" sortKey="received" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="VARIANCE" sortKey="variance" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="INSPECTION" sortKey="inspection" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <span>ACTIONS</span>
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={4} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadData} />
        ) : !activeSession ? (
          <EmptyState
            title="No receiving sessions"
            description="Open a receiving session against a shipment to start recording received items."
            action={
              <button
                type="button"
                className="button primary"
                onClick={() => setStartModalOpen(true)}
              >
                Open receiving session
              </button>
            }
          />
        ) : visibleItems.length === 0 ? (
          items.length === 0 ? (
            <EmptyState
              title="No manifest items on this shipment"
              description="Add manifest items on the Shipments page before recording receiving lines."
              action={
                <Link href="/staff/shipments" className="button">
                  Go to Shipments
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="No matching receiving lines"
              description="No receiving lines match the selected line filters."
              action={
                <button
                  type="button"
                  className="button"
                  onClick={() => setItemFilters({})}
                >
                  Clear filters
                </button>
              }
            />
          )
        ) : (
          visibleItems.map((item) => {
            const diff = item.received - item.expected;
            const varianceText =
              diff === 0
                ? 'Matched'
                : diff < 0
                  ? `${diff} missing`
                  : `+${diff} excess`;
            const varianceTone = diff === 0 ? 'green' : 'red';

            return (
              <div key={item.id} className="staff-table-row staff-rec-cols">
                <div>
                  <strong>{item.product}</strong>
                  <small>{item.variant}</small>
                </div>

                <span className="staff-cell-text">{item.expected}</span>

                <div>
                  <div className="rec-stepper">
                    <button
                      type="button"
                      disabled={activeSession.status !== 'OPEN'}
                      aria-label={`Decrease received quantity for ${item.product}`}
                      onClick={() => adjustQty(item.id, -1)}
                    >
                      −
                    </button>
                    <span>{item.received}</span>
                    <button
                      type="button"
                      disabled={activeSession.status !== 'OPEN'}
                      aria-label={`Increase received quantity for ${item.product}`}
                      onClick={() => adjustQty(item.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <span className={`acct-pill ${varianceTone}`}>
                    ● {varianceText}
                  </span>
                </div>

                <div>
                  <select
                    className="rec-select"
                    disabled={activeSession.status !== 'OPEN'}
                    value={item.inspection}
                    aria-label={`Inspection status for ${item.product}`}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((r) =>
                          r.id === item.id
                            ? { ...r, inspection: e.target.value as InspectionStatus }
                            : r,
                        ),
                      )
                    }
                  >
                    <option value="GOOD">Initial check passed</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="INCOMPLETE">Incomplete / Hold</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="rec-icon-btn"
                    disabled={activeSession.status !== 'OPEN'}
                    aria-label={`Add note for ${item.product}`}
                    title={
                      activeSession.status !== 'OPEN'
                        ? item.note || 'Session closed'
                        : item.note || 'Add note'
                    }
                    style={
                      item.note
                        ? { color: 'var(--green)', background: 'var(--mist)' }
                        : undefined
                    }
                    onClick={() => {
                      setNoteModalItemId(item.id);
                      setDraftNote(item.note);
                    }}
                  >
                    <FileText size={16} />
                  </button>
                  <Button
                    type="button"
                    style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}
                    loading={savingLineId === item.id}
                    loadingText="Saving…"
                    disabled={activeSession.status !== 'OPEN' || savingDraft || Boolean(savingLineId)}
                    onClick={() => persistLine(item)}
                  >
                    {item.persisted ? 'Update' : 'Record'}
                  </Button>
                  {item.persisted && !item.variantId && !item.id.startsWith('manifest-') && (
                    <Button
                      type="button"
                      variant="secondary"
                      style={{ minHeight: 32, padding: '0 8px', fontSize: 11.5 }}
                      disabled={Boolean(savingLineId)}
                      onClick={async () => {
                        setSavingLineId(item.id);
                        try {
                          await receivingApi.createProductDraftFromLine(item.id, {
                            condition: item.inspection === 'DAMAGED' ? 'FAIR' : 'GOOD',
                          });
                          showToast(
                            `Created linked Product Draft & onboarding stock lot for "${item.product}"`,
                            'success',
                          );
                          await loadData(true);
                        } catch (err) {
                          showToast(
                            err instanceof Error ? err.message : 'Unable to create product draft',
                            'error',
                          );
                        } finally {
                          setSavingLineId(null);
                        }
                      }}
                    >
                      + Catalog Draft
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {activeSession?.status === 'CLOSED' && (
        <div className="rec-submitted-banner" data-node-id="2:17528">
          <CheckCircle2 size={17} />
          <span>
            Session closed. Reconciliation is recorded on shipment{' '}
            {activeSession.shipment?.reference ?? activeSession.shipmentId}.
          </span>
        </div>
      )}

      <StartReceivingSessionModal
        open={startModalOpen}
        eligibleShipments={eligibleShipmentsForNewSession}
        selectedShipmentId={newShipmentId}
        startingSession={startingSession}
        onSelectShipment={setNewShipmentId}
        onStartSession={handleStartSession}
        onClose={() => setStartModalOpen(false)}
      />

      <ReceivingNoteModal
        open={Boolean(noteModalItemId)}
        draftNote={draftNote}
        onDraftChange={setDraftNote}
        onSave={() => {
          setItems((prev) =>
            prev.map((r) =>
              r.id === noteModalItemId ? { ...r, note: draftNote.trim() } : r,
            ),
          );
          setNoteModalItemId(null);
        }}
        onClose={() => setNoteModalItemId(null)}
      />

      <ConfirmDialog
        open={confirmClose}
        title="Close receiving session?"
        targetName={activeSession?.shipment?.reference ?? activeSession?.id}
        description="Closing this receiving session marks receiving complete for manager reconciliation."
        reversible={false}
        destructive={false}
        confirmLabel="Close session"
        loading={closingSession}
        onCancel={() => setConfirmClose(false)}
        onConfirm={handleCloseSession}
      />
    </div>
  );
}
