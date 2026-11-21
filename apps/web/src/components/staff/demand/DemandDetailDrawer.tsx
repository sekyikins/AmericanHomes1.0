'use client';

import { Info, X } from 'lucide-react';
import { demandTone, type DemandItem, type DemandMode } from '@/components/staff/demand/demandConfig';

type DemandDetailDrawerProps = {
  selected: DemandItem;
  detailOpen: boolean;
  onClose: () => void;
  mode: DemandMode;
  managementNote: string;
  setManagementNote: (v: string) => void;
  submitting: boolean;
  onDefer: () => void;
  onPrimaryDecision: () => void;
};

export function DemandDetailDrawer({
  selected,
  detailOpen,
  onClose,
  mode,
  managementNote,
  setManagementNote,
  submitting,
  onDefer,
  onPrimaryDecision,
}: DemandDetailDrawerProps) {
  return (
    <>
      {detailOpen && (
        <div
          className="demand-detail-backdrop"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <aside
        className={`ship-card demand-detail-aside${detailOpen ? ' open' : ''}`}
        aria-hidden={!detailOpen}
      >
        <div className="demand-drawer-bar" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="login-close"
            style={{ position: 'static' }}
            aria-label="Close detail drawer"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span className={`acct-pill ${demandTone(selected.status)}`}>
            ● {selected.status}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {selected.submittedDate}
          </span>
        </div>

        <h3 style={{ fontSize: 19 }}>{selected.title}</h3>
        <p className="ship-card-sub">{selected.reference}</p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 14,
            padding: '10px 12px',
            background: '#f7f8f7',
            border: '0.8px solid var(--line)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--mist)',
              color: 'var(--green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {selected.customerInitials}
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)' }}>
              {selected.customerName}
            </strong>
            <small style={{ fontSize: 11, color: 'var(--muted)' }}>
              {selected.customerMeta}
            </small>
          </div>
        </div>

        <dl className="ship-dl">
          <div className="ship-dl-row">
            <dt>Quantity</dt>
            <dd>
              {selected.qty} {selected.qty === 1 ? 'unit' : 'units'}
            </dd>
          </div>
          <div className="ship-dl-row">
            <dt>Target budget</dt>
            <dd>{selected.budget}</dd>
          </div>
          <div className="ship-dl-row">
            <dt>Details</dt>
            <dd>{selected.relatedRequests}</dd>
          </div>
        </dl>

        <div className="rec-info-banner" style={{ marginTop: 14, marginBottom: 14 }}>
          <Info size={16} color="#49616e" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11.5 }}>
            Approving this request does not guarantee sourcing or create a
            customer commitment.
          </span>
        </div>

        <label className="login-field">
          <span>Management note</span>
          <textarea
            rows={2}
            value={managementNote}
            onChange={(e) => setManagementNote(e.target.value)}
            placeholder="Add a private note…"
            style={{
              width: '100%',
              border: '0.8px solid var(--line)',
              borderRadius: 3,
              padding: 10,
              fontSize: 12.5,
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          {mode !== 'sourcing' && (
            <button
              type="button"
              className="button"
              disabled={submitting}
              style={{ flex: 1, background: '#fff' }}
              onClick={onDefer}
            >
              {mode === 'allocations' ? 'Decline offer' : 'Defer'}
            </button>
          )}
          <button
            type="button"
            className="button primary"
            disabled={submitting}
            aria-busy={submitting || undefined}
            style={{ flex: 1.5 }}
            onClick={onPrimaryDecision}
          >
            {submitting
              ? 'Saving…'
              : mode === 'sourcing'
                ? 'Confirm with provider'
                : mode === 'allocations'
                  ? 'Mark offer accepted'
                  : 'Approve for sourcing'}
          </button>
        </div>
      </aside>
    </>
  );
}
