'use client';

import { EmptyState } from '@/components/ui';
import { formatGhs } from '@/lib/staffUtils';
import { AlertTriangle, DollarSign, Receipt, Ship } from 'lucide-react';

export type ExpenseRow = {
  id: string;
  description: string;
  category: string;
  amountCents: number;
  rawDate: string;
  date: string;
};

export type ExportJobRow = {
  id: string;
  type: string;
  format: string;
  createdAt: string;
};

export type ShipmentPerf = {
  shipmentId: string;
  reference: string;
  expectedUnits: number;
  receivedUnits: number;
  shipmentExpensesCents: number;
  estimatedAcquisitionCents: number;
  costCompletenessWarning: string;
};

export const REPORT_TYPES = [
  { id: 'SALES', title: 'Sales report' },
  { id: 'PAYMENTS', title: 'Payment verification' },
  { id: 'INVENTORY', title: 'Inventory valuation' },
  { id: 'EXPENSES', title: 'Expense summary' },
] as const;

const SEGMENT_COLORS = ['#0f2438', '#166a4a', '#c08a2e', '#64748b'];

export function ExpenseDonut({ expenses }: { expenses: ExpenseRow[] }) {
  const totalCents = expenses.reduce((s, e) => s + e.amountCents, 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    byCat.set(e.category || 'Other', (byCat.get(e.category || 'Other') ?? 0) + e.amountCents);
  }
  const entries = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const segments =
    entries.length > 0 && totalCents > 0
      ? entries.map(([label, cents], idx) => ({
          label,
          pct: Math.round((cents / totalCents) * 100),
          color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
        }))
      : [{ label: 'No expenses', pct: 100, color: '#e2e8f0' }];

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  return (
    <div className="fin-donut-wrap">
      <div className="fin-donut-box">
        <svg viewBox="0 0 132 132" width="132" height="132" aria-label="Expense breakdown donut chart">
          {segments.map((seg) => {
            const len = (seg.pct / 100) * circumference;
            const dashOffset = -offsetAcc;
            offsetAcc += len;
            return (
              <circle
                key={seg.label}
                cx="66"
                cy="66"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="22"
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 66 66)"
              />
            );
          })}
        </svg>
        <div className="fin-donut-center">
          <strong>{formatGhs(totalCents)}</strong>
          <span>General total</span>
        </div>
      </div>

      <div className="fin-legend">
        {segments.map((seg) => (
          <div key={seg.label} className="fin-legend-row">
            <span className="fin-legend-left">
              <span className="fin-legend-swatch" style={{ background: seg.color }} />
              <span>{seg.label}</span>
            </span>
            <strong>{seg.pct}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShipmentProfitabilityPanel({
  shipments,
  selectedShipmentId,
  onSelectShipment,
  shipmentPerf,
  loadingPerf = false,
  fmt,
}: {
  shipments: Array<{ id: string; reference: string }>;
  selectedShipmentId: string;
  onSelectShipment: (id: string) => void;
  shipmentPerf: ShipmentPerf | null;
  loadingPerf?: boolean;
  fmt: (cents?: number) => string;
}) {
  return (
    <section className="acct-panel">
      <div className="acct-panel-head">
        <div>
          <h2>Shipment profitability</h2>
          <p>Landed costs and unit reconciliation per shipment</p>
        </div>
        {shipments.length > 0 && (
          <select
            className="dash-select"
            aria-label="Select shipment for profitability"
            value={selectedShipmentId}
            onChange={(e) => onSelectShipment(e.target.value)}
          >
            {shipments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.reference}
              </option>
            ))}
          </select>
        )}
      </div>
      {loadingPerf ? (
        <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--muted)' }}>
          Loading shipment metrics…
        </div>
      ) : shipmentPerf ? (
        <div style={{ padding: '14px 20px 18px', display: 'grid', gap: 12 }}>
          <div className="rec-stats-strip" style={{ marginBottom: 0 }}>
            <div className="rec-stat-cell">
              <Ship size={18} color="var(--green)" />
              <div>
                <small>Units received</small>
                <strong>
                  {shipmentPerf.receivedUnits} / {shipmentPerf.expectedUnits}
                </strong>
              </div>
            </div>
            <div className="rec-stat-cell">
              <Receipt size={18} color="var(--green)" />
              <div>
                <small>Direct expenses</small>
                <strong>{fmt(shipmentPerf.shipmentExpensesCents)}</strong>
              </div>
            </div>
            <div className="rec-stat-cell">
              <DollarSign size={18} color="var(--green)" />
              <div>
                <small>Est. acquisition</small>
                <strong>{fmt(shipmentPerf.estimatedAcquisitionCents)}</strong>
              </div>
            </div>
          </div>
          <div className="rec-info-banner" style={{ margin: 0 }}>
            <AlertTriangle size={15} color="#b45309" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>{shipmentPerf.costCompletenessWarning}</span>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No shipment data"
          description="Create a shipment to view landed cost and unit performance."
        />
      )}
    </section>
  );
}

export function RecentExportsPanel({ exportJobs }: { exportJobs: ExportJobRow[] }) {
  return (
    <section className="acct-panel">
      <div className="acct-panel-head">
        <div>
          <h2>Recent export history</h2>
          <p>Audit trail of generated snapshots</p>
        </div>
      </div>
      {exportJobs.length === 0 ? (
        <EmptyState
          title="No exports generated yet"
          description="Generate a CSV, Excel or PDF snapshot from Available exports."
        />
      ) : (
        exportJobs.map((job) => (
          <div
            key={job.id}
            className="staff-table-row"
            style={{ gridTemplateColumns: '1fr auto auto', padding: '12px 20px' }}
          >
            <strong>{job.type}</strong>
            <span className="acct-pill blue">{job.format}</span>
            <span className="staff-cell-muted">{job.createdAt}</span>
          </div>
        ))
      )}
    </section>
  );
}
