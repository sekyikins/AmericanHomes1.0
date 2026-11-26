'use client';

import { Button, ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { catalogueApi, operationsApi, shipmentsApi } from '@/lib/api';
import { formatGhs } from '@/lib/staffUtils';
import { useToast } from '@/providers/toast.provider';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type TabKey = 'quotes' | 'shifts' | 'service' | 'suppliers';

export default function StaffOperationsHubPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabKey>('quotes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCloseShift, setConfirmCloseShift] = useState(false);
  const [confirmFreezeShipment, setConfirmFreezeShipment] = useState<{
    id: string;
    reference: string;
  } | null>(null);

  const [quotes, setQuotes] = useState<Record<string, unknown>[]>([]);
  const [shifts, setShifts] = useState<Record<string, unknown>[]>([]);
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [shipments, setShipments] = useState<Record<string, unknown>[]>([]);
  const [variants, setVariants] = useState<Array<{ id: string; label: string; priceCents: number }>>([]);

  // Quote form
  const [qCustomerName, setQCustomerName] = useState('');
  const [qCustomerPhone, setQCustomerPhone] = useState('');
  const [qVariantId, setQVariantId] = useState('');
  const [qQty, setQQty] = useState('1');
  const [qDepositPct, setQDepositPct] = useState('30');

  // Shift form
  const [openingFloatGhs, setOpeningFloatGhs] = useState('500');
  const [countedCashGhs, setCountedCashGhs] = useState('');
  const [reconciledMomoGhs, setReconciledMomoGhs] = useState('');
  const [reconciledBankGhs, setReconciledBankGhs] = useState('');

  // Service ticket form
  const [tOrderId, setTOrderId] = useState('');
  const [tIssueType, setTIssueType] = useState('WARRANTY_CLAIM');
  const [tDesc, setTDesc] = useState('');

  // Supplier form
  const [sName, setSName] = useState('');
  const [sCountry, setSCountry] = useState('USA');
  const [sCurrency, setSCurrency] = useState('USD');
  const [sPhone, setSPhone] = useState('');

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [qList, shList, tkList, supList, shpList, prodList] = await Promise.all([
        operationsApi.listQuotes().catch(() => []),
        operationsApi.listShifts().catch(() => []),
        operationsApi.listServiceTickets().catch(() => []),
        operationsApi.listSuppliers().catch(() => []),
        shipmentsApi.list().catch(() => []),
        catalogueApi.listPublished().catch(() => []),
      ]);
      setQuotes(Array.isArray(qList) ? qList : []);
      setShifts(Array.isArray(shList) ? shList : []);
      setTickets(Array.isArray(tkList) ? tkList : []);
      setSuppliers(Array.isArray(supList) ? supList : []);
      setShipments(Array.isArray(shpList) ? shpList : []);

      const opts: Array<{ id: string; label: string; priceCents: number }> = [];
      for (const p of (Array.isArray(prodList) ? prodList : []) as Array<{
        name: string;
        variants?: Array<{ id: string; sku?: string; priceCents?: number }>;
      }>) {
        for (const v of p.variants ?? []) {
          opts.push({
            id: v.id,
            label: `${p.name} (${v.sku ?? 'SKU'}) — ${formatGhs(v.priceCents ?? 0)}`,
            priceCents: v.priceCents ?? 0,
          });
        }
      }
      setVariants(opts);
      if (opts[0]) setQVariantId((prev) => prev || opts[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load operations hub');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openShiftRow = shifts.find((s) => s.status === 'OPEN');

  const handleCreateQuote = async (e: FormEvent) => {
    e.preventDefault();
    if (!qCustomerName.trim() || !qVariantId || busy) return;
    setBusy(true);
    try {
      await operationsApi.createQuote({
        customerName: qCustomerName.trim(),
        customerPhone: qCustomerPhone.trim() || undefined,
        items: [{ variantId: qVariantId, quantity: Math.max(1, Number(qQty) || 1) }],
        depositPercent: Math.max(10, Math.min(100, Number(qDepositPct) || 30)),
      });
      setQCustomerName('');
      setQCustomerPhone('');
      showToast('Quotation issued (14-day validity, soft quote)', 'success');
      await loadAll(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to create quotation', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenShift = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await operationsApi.openShift(Math.round((Number(openingFloatGhs) || 0) * 100));
      showToast('Cashier till shift opened', 'success');
      await loadAll(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open shift', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCloseShift = (e: FormEvent) => {
    e.preventDefault();
    if (!openShiftRow || busy) return;
    setConfirmCloseShift(true);
  };

  const executeCloseShift = async () => {
    if (!openShiftRow || busy) return;
    setBusy(true);
    try {
      const closed = await operationsApi.closeShift(String(openShiftRow.id), {
        countedCashCents: Math.round((Number(countedCashGhs) || 0) * 100),
        ...(reconciledMomoGhs ? { reconciledMomoCents: Math.round(Number(reconciledMomoGhs) * 100) } : {}),
        ...(reconciledBankGhs ? { reconciledBankCents: Math.round(Number(reconciledBankGhs) * 100) } : {}),
      });
      const variance = Number(closed.cashVarianceCents ?? 0);
      setConfirmCloseShift(false);
      setCountedCashGhs('');
      setReconciledMomoGhs('');
      setReconciledBankGhs('');
      showToast(
        `Shift closed · Cash variance: ${variance >= 0 ? '+' : ''}${formatGhs(variance)}`,
        variance === 0 ? 'success' : 'warning',
      );
      await loadAll(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to close shift', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!tOrderId.trim() || !tDesc.trim() || busy) return;
    setBusy(true);
    try {
      await operationsApi.createServiceTicket({
        orderId: tOrderId.trim(),
        issueType: tIssueType,
        description: tDesc.trim(),
      });
      setTOrderId('');
      setTDesc('');
      showToast('After-sales service ticket logged', 'success');
      await loadAll(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to log service ticket', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!sName.trim() || busy) return;
    setBusy(true);
    try {
      await operationsApi.createSupplier({
        name: sName.trim(),
        country: sCountry.trim() || 'USA',
        currency: sCurrency.trim() || 'USD',
        phone: sPhone.trim() || undefined,
      });
      setSName('');
      setSPhone('');
      showToast('Supplier registered', 'success');
      await loadAll(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to register supplier', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Operations hub
          </h1>
          <p className="dash-sub">
            Quotations, cashier blind-close shifts, after-sales warranty tickets, and supplier landed-cost controls.
          </p>
        </div>
      </div>

      <div className="ship-tabs-bar" style={{ marginBottom: 16 }}>
        {[
          { key: 'quotes', label: `Quotations (${quotes.length})` },
          { key: 'shifts', label: `Cashier Shifts (${shifts.length})` },
          { key: 'service', label: `Warranty & Service (${tickets.length})` },
          { key: 'suppliers', label: `Suppliers & Landed Cost (${suppliers.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`ship-tab-btn${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key as TabKey)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadAll} />
      ) : tab === 'quotes' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <form onSubmit={handleCreateQuote} className="ship-card" style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Issue formal quotation (Soft Quote · No stock deducted)</h3>
            <div className="req-row-2">
              <label className="login-field">
                <span>Customer name</span>
                <input value={qCustomerName} onChange={(e) => setQCustomerName(e.target.value)} required />
              </label>
              <label className="login-field">
                <span>Phone</span>
                <input value={qCustomerPhone} onChange={(e) => setQCustomerPhone(e.target.value)} placeholder="024…" />
              </label>
            </div>
            <div className="req-row-2">
              <label className="login-field">
                <span>Product</span>
                <select className="staff-field-select" value={qVariantId} onChange={(e) => setQVariantId(e.target.value)}>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <label className="login-field" style={{ flex: 1 }}>
                  <span>Qty</span>
                  <input type="number" min={1} value={qQty} onChange={(e) => setQQty(e.target.value)} />
                </label>
                <label className="login-field" style={{ flex: 1 }}>
                  <span>Deposit %</span>
                  <input type="number" min={10} max={100} value={qDepositPct} onChange={(e) => setQDepositPct(e.target.value)} />
                </label>
              </div>
            </div>
            <div>
              <Button type="submit" variant="primary" loading={busy} loadingText="Issuing…">
                Issue 14-Day Quotation
              </Button>
            </div>
          </form>

          <section className="acct-panel" style={{ padding: 0 }}>
            {quotes.length === 0 ? (
              <EmptyState title="No quotations yet" description="Create a formal quote above; convert it to an order when the customer is ready to pay their deposit." />
            ) : (
              quotes.map((q) => (
                <div key={String(q.id)} style={{ padding: '14px 18px', borderBottom: '0.8px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{String(q.reference)}</strong> · {String(q.customerName)}
                    <small style={{ display: 'block', color: 'var(--muted)' }}>
                      Total: {formatGhs(Number(q.totalCents ?? 0))} · Min Deposit: {formatGhs(Number(q.depositRequiredCents ?? 0))} · Valid until {new Date(String(q.validUntil)).toLocaleDateString('en-GH')}
                    </small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`acct-pill ${q.status === 'CONVERTED' ? 'green' : q.status === 'SENT' ? 'blue' : 'gray'}`}>
                      ● {String(q.status)}
                    </span>
                    {q.status === 'SENT' && (
                      <Button
                        type="button"
                        variant="primary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await operationsApi.convertQuote(String(q.id));
                            showToast(`Converted to order ${res.order.reference} (24h payment hold)`, 'success');
                            await loadAll(true);
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : 'Conversion failed', 'error');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Convert to Order
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      ) : tab === 'shifts' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {!openShiftRow ? (
            <form onSubmit={handleOpenShift} className="ship-card" style={{ display: 'grid', gap: 12 }}>
              <h3 style={{ margin: 0 }}>Open cashier till shift</h3>
              <label className="login-field">
                <span>Opening cash float (GHS)</span>
                <input type="number" step="0.01" min={0} value={openingFloatGhs} onChange={(e) => setOpeningFloatGhs(e.target.value)} />
              </label>
              <div>
                <Button type="submit" variant="primary" loading={busy}>Open Shift</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCloseShift} className="ship-card" style={{ display: 'grid', gap: 12, borderColor: '#f59e0b' }}>
              <h3 style={{ margin: 0 }}>Blind close active shift: {String(openShiftRow.reference)}</h3>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
                Enter your physically counted drawer cash before seeing the system expected cash total.
              </p>
              <div className="req-row-2">
                <label className="login-field">
                  <span>Counted physical cash in till (GHS)</span>
                  <input type="number" step="0.01" min={0} required value={countedCashGhs} onChange={(e) => setCountedCashGhs(e.target.value)} />
                </label>
                <label className="login-field">
                  <span>Reconciled MoMo wallet total (GHS, optional)</span>
                  <input type="number" step="0.01" min={0} value={reconciledMomoGhs} onChange={(e) => setReconciledMomoGhs(e.target.value)} />
                </label>
              </div>
              <label className="login-field">
                <span>Reconciled bank statement total (GHS, optional)</span>
                <input type="number" step="0.01" min={0} value={reconciledBankGhs} onChange={(e) => setReconciledBankGhs(e.target.value)} />
              </label>
              <div>
                <Button type="submit" variant="primary" loading={busy}>Submit Blind Count &amp; Close Shift</Button>
              </div>
            </form>
          )}

          <section className="acct-panel" style={{ padding: 0 }}>
            {shifts.length === 0 ? (
              <EmptyState title="No cashier shifts recorded" description="Open a shift at the start of the day and run a blind close at end of shift." />
            ) : (
              shifts.map((s) => (
                <div key={String(s.id)} style={{ padding: '14px 18px', borderBottom: '0.8px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{String(s.reference)}</strong> · Float {formatGhs(Number(s.openingFloatCents ?? 0))}
                    <small style={{ display: 'block', color: 'var(--muted)' }}>
                      {s.status === 'CLOSED'
                        ? `Counted: ${formatGhs(Number(s.countedCashCents ?? 0))} · Expected: ${formatGhs(Number(s.expectedCashCents ?? 0))} · Variance: ${formatGhs(Number(s.cashVarianceCents ?? 0))} · MoMo: ${formatGhs(Number(s.expectedMomoCents ?? 0))} · Paystack: ${formatGhs(Number(s.expectedPaystackCents ?? 0))}`
                        : `Opened ${new Date(String(s.openedAt)).toLocaleString('en-GH')}`}
                    </small>
                  </div>
                  <span className={`acct-pill ${s.status === 'OPEN' ? 'amber' : Number(s.cashVarianceCents ?? 0) === 0 ? 'green' : 'red'}`}>
                    ● {String(s.status)}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>
      ) : tab === 'service' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <form onSubmit={handleCreateTicket} className="ship-card" style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Log after-sales warranty or service ticket</h3>
            <div className="req-row-2">
              <label className="login-field">
                <span>Order reference or ID</span>
                <input value={tOrderId} onChange={(e) => setTOrderId(e.target.value)} placeholder="AH-ORD-2026-000001" required />
              </label>
              <label className="login-field">
                <span>Issue type</span>
                <select className="staff-field-select" value={tIssueType} onChange={(e) => setTIssueType(e.target.value)}>
                  <option value="WARRANTY_CLAIM">Warranty claim</option>
                  <option value="REPAIR">Technician repair</option>
                  <option value="MISSING_PART">Missing part / box</option>
                  <option value="INSTALLATION">Installation support</option>
                </select>
              </label>
            </div>
            <label className="login-field">
              <span>Description</span>
              <input value={tDesc} onChange={(e) => setTDesc(e.target.value)} placeholder="Describe issue or part needed…" required />
            </label>
            <div>
              <Button type="submit" variant="primary" loading={busy}>Log Service Ticket</Button>
            </div>
          </form>

          <section className="acct-panel" style={{ padding: 0 }}>
            {tickets.length === 0 ? (
              <EmptyState title="No service tickets" description="Warranty claims and post-collection repair tickets appear here." />
            ) : (
              tickets.map((t) => (
                <div key={String(t.id)} style={{ padding: '14px 18px', borderBottom: '0.8px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{String(t.reference)}</strong> · {String(t.issueType)}
                    <small style={{ display: 'block', color: 'var(--muted)' }}>{String(t.description)}</small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`acct-pill ${t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'green' : 'amber'}`}>
                      ● {String(t.status)}
                    </span>
                    {t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await operationsApi.updateServiceTicket(String(t.id), {
                              status: 'RESOLVED',
                              resolutionNotes: 'Resolved by staff',
                            });
                            showToast(`Ticket ${String(t.reference)} marked resolved`, 'success');
                            await loadAll(true);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <form onSubmit={handleCreateSupplier} className="ship-card" style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Register overseas supplier</h3>
            <div className="req-row-2">
              <label className="login-field">
                <span>Supplier name</span>
                <input value={sName} onChange={(e) => setSName(e.target.value)} required />
              </label>
              <label className="login-field">
                <span>Country</span>
                <input value={sCountry} onChange={(e) => setSCountry(e.target.value)} />
              </label>
            </div>
            <div className="req-row-2">
              <label className="login-field">
                <span>Currency</span>
                <select className="staff-field-select" value={sCurrency} onChange={(e) => setSCurrency(e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                  <option value="GHS">GHS</option>
                </select>
              </label>
              <label className="login-field">
                <span>Contact phone / WhatsApp</span>
                <input value={sPhone} onChange={(e) => setSPhone(e.target.value)} />
              </label>
            </div>
            <div>
              <Button type="submit" variant="primary" loading={busy}>Register Supplier</Button>
            </div>
          </form>

          <section className="ship-card">
            <h3 style={{ marginTop: 0 }}>Freeze container landed costs (FX + CBM freight + FOB duty → StockLot COGS)</h3>
            {shipments.slice(0, 8).map((shp) => (
              <div key={String(shp.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.8px solid var(--line)', gap: 10 }}>
                <div>
                  <strong>{String(shp.reference)}</strong> · {String(shp.providerName)} ({String(shp.status)})
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    setConfirmFreezeShipment({
                      id: String(shp.id),
                      reference: String(shp.reference),
                    })
                  }
                >
                  Freeze Landed Costs
                </Button>
              </div>
            ))}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmCloseShift && Boolean(openShiftRow)}
        title="Close cashier shift?"
        targetName={openShiftRow ? String(openShiftRow.reference) : undefined}
        description="This will finalize the blind till count, compute cash/MoMo/bank variances, and lock this shift permanently."
        reversible={false}
        destructive={true}
        confirmLabel="Close shift"
        loading={busy}
        onCancel={() => setConfirmCloseShift(false)}
        onConfirm={executeCloseShift}
      />

      <ConfirmDialog
        open={Boolean(confirmFreezeShipment)}
        title="Freeze landed costs?"
        targetName={confirmFreezeShipment?.reference}
        description="This will permanently write the calculated FX/CBM/FOB landed unit costs onto all linked StockLots for this shipment."
        reversible={false}
        destructive={true}
        confirmLabel="Freeze costs"
        loading={busy}
        onCancel={() => setConfirmFreezeShipment(null)}
        onConfirm={async () => {
          const target = confirmFreezeShipment;
          if (!target || busy) return;
          setBusy(true);
          try {
            await operationsApi.freezeLandedCosts(target.id);
            showToast(
              `Frozen FX/CBM/FOB landed costs onto StockLots for ${target.reference}`,
              'success',
            );
            setConfirmFreezeShipment(null);
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Unable to freeze costs', 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
