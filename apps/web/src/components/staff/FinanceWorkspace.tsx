'use client';

import {
  FinanceExpenseModal,
  FinanceExportModal,
} from '@/components/staff/finance/FinanceModals';
import {
  ExpenseDonut,
  RecentExportsPanel,
  REPORT_TYPES,
  ShipmentProfitabilityPanel,
  type ExpenseRow,
  type ExportJobRow,
  type ShipmentPerf,
} from '@/components/staff/finance/FinancePanels';
import { Button, EmptyState, ErrorState, FinanceSkeleton } from '@/components/ui';
import { expensesApi, reportsApi, shipmentsApi } from '@/lib/api';
import { downloadBlob, downloadCsv, formatGhs, formatShortDate } from '@/lib/staffUtils';
import { useToast } from '@/providers/toast.provider';
import {
  ArrowRight,
  BarChart2,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Plus,
  Receipt,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type FinancialSummary = {
  salesValueCents?: number;
  verifiedPaymentsCents?: number;
  outstandingBalancesCents?: number;
  refundsCents?: number;
  shipmentExpensesCents?: number;
  generalExpensesCents?: number;
};

export function FinanceWorkspace({ mode }: { mode: 'reports' | 'expenses' }) {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJobRow[]>([]);
  const [shipments, setShipments] = useState<Array<{ id: string; reference: string }>>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [shipmentPerf, setShipmentPerf] = useState<ShipmentPerf | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'ALL' | '7D' | '30D'>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [exportType, setExportType] = useState('SALES');
  const [exportFormat, setExportFormat] = useState<'CSV' | 'XLSX' | 'PDF'>('CSV');

  const [expCategory, setExpCategory] = useState('Customs');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [fin, expList, expJobs, shpList] = await Promise.all([
        reportsApi.financialSummary().catch(() => null),
        expensesApi.list(),
        mode === 'reports' ? reportsApi.listExports().catch(() => []) : Promise.resolve([]),
        mode === 'reports' ? shipmentsApi.list().catch(() => []) : Promise.resolve([]),
      ]);
      if (fin) setSummary(fin as FinancialSummary);
      const mappedExp: ExpenseRow[] = (
        Array.isArray(expList) ? expList : []
      ).map((e: Record<string, unknown>) => ({
        id: String(e.id),
        description: String(e.description || 'Expense'),
        category: String(e.category || 'OTHER'),
        amountCents: Number(e.amountCents ?? 0),
        rawDate: e.date ? String(e.date) : new Date().toISOString(),
        date: e.date ? new Date(String(e.date)).toLocaleDateString('en-GH') : 'Recent',
      }));
      setExpenses(mappedExp);
      setExportJobs(
        (Array.isArray(expJobs) ? expJobs : []).slice(0, 8).map((j: Record<string, unknown>) => ({
          id: String(j.id),
          type: String(j.type || 'EXPORT'),
          format: String(j.format || 'CSV'),
          createdAt: j.createdAt ? new Date(String(j.createdAt)).toLocaleString('en-GH') : 'Recent',
        })),
      );
      const shps = (Array.isArray(shpList) ? shpList : []).map((s: Record<string, unknown>) => ({
        id: String(s.id),
        reference: String(s.reference || s.id),
      }));
      setShipments(shps);
      if (shps[0]) {
        setSelectedShipmentId((prev) => prev || shps[0].id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load financial data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (mode !== 'reports' || !selectedShipmentId) return;
    let active = true;
    setLoadingPerf(true);
    setShipmentPerf(null);
    reportsApi
      .shipmentPerformance(selectedShipmentId)
      .then((res) => {
        if (active) setShipmentPerf(res as ShipmentPerf);
      })
      .catch(() => {
        if (active) setShipmentPerf(null);
      })
      .finally(() => {
        if (active) setLoadingPerf(false);
      });
    return () => {
      active = false;
    };
  }, [mode, selectedShipmentId]);

  const filteredExpenses = expenses.filter((e) => {
    if (periodFilter === 'ALL') return true;
    const days = periodFilter === '7D' ? 7 : 30;
    return Date.now() - new Date(e.rawDate).getTime() <= days * 24 * 60 * 60 * 1000;
  });

  const totalExpensesCents = filteredExpenses.reduce((s, e) => s + e.amountCents, 0);
  const backendTotalExpensesCents =
    (summary?.shipmentExpensesCents ?? 0) + (summary?.generalExpensesCents ?? 0);

  const handleGenerateExport = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await reportsApi.generateExport({
        type: exportType,
        format: exportFormat,
      });
      if (res?.contentBase64) {
        const binary = atob(res.contentBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        downloadBlob(
          res.filename ?? `${exportType.toLowerCase()}-report.${exportFormat.toLowerCase()}`,
          new Blob([bytes], { type: res.mimeType ?? 'application/octet-stream' }),
        );
      } else if (res?.content) {
        downloadBlob(
          res.filename ?? `${exportType.toLowerCase()}-report.${exportFormat.toLowerCase()}`,
          new Blob([res.content], { type: res.mimeType ?? 'text/csv;charset=utf-8;' }),
        );
      } else {
        downloadCsv(
          `${exportType.toLowerCase()}-expenses.csv`,
          ['Description', 'Category', 'Amount (GHS)', 'Date'],
          expenses.map((ex) => [
            ex.description,
            ex.category,
            (ex.amountCents / 100).toFixed(2),
            ex.date,
          ]),
        );
      }
      setExportModalOpen(false);
      showToast(`Exported ${exportType} (${exportFormat})`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate export', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !expDesc.trim()) return;
    const numeric = Number(expAmount.replace(/[^0-9.]/g, '')) || 0;
    if (numeric <= 0) {
      showToast('Enter a positive expense amount in GHS', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await expensesApi.create({
        description: expDesc.trim(),
        amountCents: Math.round(numeric * 100),
        category: expCategory,
        date: expDate,
      });
      setExpenseModalOpen(false);
      setExpAmount('');
      setExpDesc('');
      showToast('Expense recorded', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (cents?: number) =>
    cents === undefined ? '—' : `GHS ${(cents / 100).toLocaleString()}`;

  return (
    <div data-node-id="26:65246">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            {mode === 'reports' ? 'Reports & exports' : 'Expenses'}
          </h1>
          <p className="dash-sub">
            {mode === 'reports'
              ? 'Live financial metrics and downloadable operational reports.'
              : 'Track operational and shipment expenses.'}
          </p>
        </div>

        <div className="dash-actions">
          <select
            className="dash-select"
            aria-label="Filter financial period"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
          >
            <option value="ALL">All time</option>
            <option value="7D">Last 7 days</option>
            <option value="30D">Last 30 days</option>
          </select>
          <Button type="button" onClick={() => setExportModalOpen(true)}>
            <Download size={14} />
            <span>Export report</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => setExpenseModalOpen(true)}
          >
            <Plus size={15} />
            <span>Record expense</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <FinanceSkeleton />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadData} />
      ) : (
        <>
          <section className="fin-kpi-grid">
            <div className="dash-metric-card">
              <div className="dash-metric-head">
                <span className="dash-metric-icon green">
                  <BarChart2 size={16} />
                </span>
                <span>Sales value</span>
              </div>
              <strong>{fmt(summary?.salesValueCents)}</strong>
              <small>Verified order totals</small>
            </div>
            <div className="dash-metric-card">
              <div className="dash-metric-head">
                <span className="dash-metric-icon green">
                  <CreditCard size={16} />
                </span>
                <span>Money received</span>
              </div>
              <strong>{fmt(summary?.verifiedPaymentsCents)}</strong>
              <small>
                Refunds: {fmt(summary?.refundsCents)}
              </small>
            </div>
            <div className="dash-metric-card">
              <div className="dash-metric-head">
                <span className="dash-metric-icon green">
                  <DollarSign size={16} />
                </span>
                <span>Outstanding</span>
              </div>
              <strong>{fmt(summary?.outstandingBalancesCents)}</strong>
              <small>Pending / partial balances</small>
            </div>
            <div className="dash-metric-card">
              <div className="dash-metric-head">
                <span className="dash-metric-icon green">
                  <Receipt size={16} />
                </span>
                <span>Total expenses</span>
              </div>
              <strong>
                {fmt(
                  periodFilter === 'ALL' && backendTotalExpensesCents > 0
                    ? backendTotalExpensesCents
                    : totalExpensesCents,
                )}
              </strong>
              <small>
                {periodFilter === 'ALL'
                  ? `${filteredExpenses.length} general · Shipment ${fmt(summary?.shipmentExpensesCents)}`
                  : `${filteredExpenses.length} general expenses in period`}
              </small>
            </div>
          </section>

          <div className="fin-mid-grid">
            <section className="acct-panel">
              <div className="acct-panel-head">
                <div>
                  <h2>Expense breakdown</h2>
                  <p>General expenses by category</p>
                </div>
              </div>
              <ExpenseDonut expenses={filteredExpenses} />
            </section>

            <section className="acct-panel">
              <div className="acct-panel-head">
                <div>
                  <h2>Available exports</h2>
                  <p>Generate CSV, Excel or PDF snapshots</p>
                </div>
              </div>
              <div className="fin-reports-grid">
                {REPORT_TYPES.map((rep) => (
                  <button
                    key={rep.id}
                    type="button"
                    className="fin-report-card"
                    onClick={() => {
                      setExportType(rep.id);
                      setExportModalOpen(true);
                    }}
                  >
                    <div className="fin-report-left">
                      <FileText size={16} color="var(--green)" style={{ flexShrink: 0 }} />
                      <div>
                        <strong>{rep.title}</strong>
                        <small>Click to export</small>
                      </div>
                    </div>
                    <ArrowRight size={14} color="var(--muted)" />
                  </button>
                ))}
              </div>
            </section>
          </div>

          {mode === 'reports' && (
            <div className="fin-mid-grid" style={{ marginTop: 18 }}>
              <ShipmentProfitabilityPanel
                shipments={shipments}
                selectedShipmentId={selectedShipmentId}
                onSelectShipment={setSelectedShipmentId}
                shipmentPerf={shipmentPerf}
                loadingPerf={loadingPerf}
                fmt={fmt}
              />
              <RecentExportsPanel exportJobs={exportJobs} />
            </div>
          )}

          <section className="acct-panel" style={{ padding: 0, marginTop: 18 }}>
            <div
              className="staff-table-head"
              style={{ gridTemplateColumns: '1.6fr 1fr 0.9fr 0.8fr' }}
            >
              <span>DESCRIPTION</span>
              <span>CATEGORY</span>
              <span>AMOUNT</span>
              <span>DATE</span>
            </div>

            {filteredExpenses.length === 0 ? (
              <EmptyState
                title="No expenses recorded"
                description="Record operational or shipment expenses to track total spend."
                action={
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => setExpenseModalOpen(true)}
                  >
                    Record expense
                  </button>
                }
              />
            ) : (
              filteredExpenses.map((ex) => (
                <div
                  key={ex.id}
                  className="staff-table-row"
                  style={{ gridTemplateColumns: '1.6fr 1fr 0.9fr 0.8fr' }}
                >
                  <div>
                    <strong>{ex.description}</strong>
                  </div>
                  <span className="staff-cell-muted">{ex.category}</span>
                  <span className="staff-cell-text">
                    GHS {(ex.amountCents / 100).toLocaleString()}
                  </span>
                  <span className="staff-cell-muted">{ex.date}</span>
                </div>
              ))
            )}
          </section>
        </>
      )}

      <FinanceExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        exportType={exportType}
        setExportType={setExportType}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        submitting={submitting}
        onSubmit={handleGenerateExport}
      />

      <FinanceExpenseModal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        expCategory={expCategory}
        setExpCategory={setExpCategory}
        expAmount={expAmount}
        setExpAmount={setExpAmount}
        expDesc={expDesc}
        setExpDesc={setExpDesc}
        expDate={expDate}
        setExpDate={setExpDate}
        submitting={submitting}
        onSubmit={handleRecordExpense}
      />
    </div>
  );
}
