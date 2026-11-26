'use client';

import { Button, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { taxApi, type TaxInvoiceDto } from '@/lib/api';
import { formatGhs } from '@/lib/staffUtils';
import { useToast } from '@/providers/toast.provider';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function StaffTaxInvoicesPage() {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<TaxInvoiceDto[]>([]);
  const [config, setConfig] = useState<{
    seller: { tin: string; name: string; address: string; evatMode: 'LIVE' | 'SANDBOX' };
    rates: { nhilBps: number; getFundBps: number; vatBps: number };
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [cfg, list] = await Promise.all([
        taxApi.getConfig(),
        taxApi.listInvoices(statusFilter === 'ALL' ? undefined : statusFilter),
      ]);
      setConfig(cfg);
      setInvoices(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tax invoices');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRetry = async (inv: TaxInvoiceDto) => {
    setRetryingId(inv.id);
    try {
      const updated = await taxApi.retry(inv.id);
      showToast(
        `${updated.invoiceNumber}: ${updated.status}`,
        updated.status === 'FAILED' ? 'error' : 'success',
      );
      await load(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Retry failed', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const totals = invoices.reduce(
    (acc, inv) => ({
      net: acc.net + inv.netCents,
      nhil: acc.nhil + inv.nhilCents,
      getFund: acc.getFund + inv.getFundCents,
      vat: acc.vat + inv.vatCents,
      total: acc.total + inv.totalCents,
    }),
    { net: 0, nhil: 0, getFund: 0, vat: 0, total: 0 },
  );

  return (
    <div>
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Tax invoices &amp; GRA E-VAT
          </h1>
          <p className="dash-sub">
            Gap-free sequential VAT invoices and credit notes (Act 1151: 15% VAT · 2.5% NHIL · 2.5% GETFund).
          </p>
        </div>
        {config && (
          <span className={`acct-pill ${config.seller.evatMode === 'LIVE' ? 'green' : 'amber'}`}>
            {config.seller.evatMode === 'LIVE' ? (
              <>
                <CheckCircle2 size={13} /> GRA E-VAT Live · TIN {config.seller.tin}
              </>
            ) : (
              <>
                <AlertTriangle size={13} /> E-VAT Sandbox (set GRA_EVAT_* env vars for live clearance)
              </>
            )}
          </span>
        )}
      </div>

      <section className="rec-stats-strip" style={{ marginBottom: 14 }}>
        <div className="rec-stat-cell">
          <div>
            <small>Net taxable</small>
            <strong>{formatGhs(totals.net)}</strong>
          </div>
        </div>
        <div className="rec-stat-cell">
          <div>
            <small>NHIL (2.5%)</small>
            <strong>{formatGhs(totals.nhil)}</strong>
          </div>
        </div>
        <div className="rec-stat-cell">
          <div>
            <small>GETFund (2.5%)</small>
            <strong>{formatGhs(totals.getFund)}</strong>
          </div>
        </div>
        <div className="rec-stat-cell">
          <div>
            <small>VAT (15%)</small>
            <strong>{formatGhs(totals.vat)}</strong>
          </div>
        </div>
      </section>

      <div className="ship-tabs-bar" style={{ marginBottom: 14 }}>
        {(['ALL', 'CLEARED', 'SANDBOX', 'FAILED', 'PENDING'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`ship-tab-btn${statusFilter === tab ? ' active' : ''}`}
            onClick={() => setStatusFilter(tab)}
          >
            {tab === 'ALL' ? 'All documents' : tab}
          </button>
        ))}
      </div>

      <section className="acct-panel" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={5} />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : invoices.length === 0 ? (
          <EmptyState
            title="No tax documents yet"
            description="Sequential tax invoices are issued automatically when an order is paid in full; credit notes are issued on refunds and cancellations."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left', fontSize: 11, color: 'var(--muted)' }}>
                  <th style={{ padding: '12px 14px' }}>INVOICE #</th>
                  <th style={{ padding: '12px 10px' }}>TYPE</th>
                  <th style={{ padding: '12px 10px' }}>ORDER</th>
                  <th style={{ padding: '12px 10px' }}>CUSTOMER</th>
                  <th style={{ padding: '12px 10px' }}>NET</th>
                  <th style={{ padding: '12px 10px' }}>NHIL / GETF</th>
                  <th style={{ padding: '12px 10px' }}>VAT (15%)</th>
                  <th style={{ padding: '12px 10px' }}>TOTAL</th>
                  <th style={{ padding: '12px 10px' }}>E-VAT STATUS</th>
                  <th style={{ padding: '12px 14px' }} />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '0.8px solid var(--line)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span className={`acct-pill ${inv.documentType === 'CREDIT_NOTE' ? 'amber' : 'blue'}`}>
                        {inv.documentType === 'CREDIT_NOTE' ? 'Credit note' : 'Tax invoice'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px' }}>{inv.order?.reference ?? inv.orderId.slice(-8)}</td>
                    <td style={{ padding: '12px 10px' }}>
                      {inv.customerName ?? 'Walk-in'}
                      {inv.customerTin ? ` (${inv.customerTin})` : ''}
                    </td>
                    <td style={{ padding: '12px 10px' }}>{formatGhs(inv.netCents)}</td>
                    <td style={{ padding: '12px 10px' }}>
                      {formatGhs(inv.nhilCents + inv.getFundCents)}
                    </td>
                    <td style={{ padding: '12px 10px' }}>{formatGhs(inv.vatCents)}</td>
                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>{formatGhs(inv.totalCents)}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span
                        className={`acct-pill ${
                          inv.status === 'CLEARED'
                            ? 'green'
                            : inv.status === 'FAILED'
                              ? 'red'
                              : 'amber'
                        }`}
                      >
                        ● {inv.status}
                      </span>
                      {inv.evatLastError && (
                        <small style={{ display: 'block', color: '#b42318', marginTop: 2 }}>
                          {inv.evatLastError}
                        </small>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {inv.status !== 'CLEARED' && (
                        <Button
                          type="button"
                          variant="secondary"
                          loading={retryingId === inv.id}
                          loadingText="Retrying…"
                          onClick={() => handleRetry(inv)}
                        >
                          <RefreshCw size={12} /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
