'use client';

import { StaffFilterDropdown } from '@/components/staff/StaffFilterDropdown';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { downloadCsv } from '@/lib/staffUtils';
import { Download, Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type AuditRecord = {
  id: string;
  actor: string;
  timestamp: string;
  action: string;
  entity: string;
  entityTone: 'green' | 'blue';
  details: string;
  before: string;
  after: string;
  reason: string;
};

export default function StaffAuditLogsPage() {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('All');
  const [selected, setSelected] = useState<AuditRecord | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = (await adminApi.auditLogs()) as Array<{
        id: string;
        actorId?: string | null;
        action: string;
        entityType: string;
        entityId?: string | null;
        before?: unknown;
        after?: unknown;
        reason?: string | null;
        createdAt: string;
        actor?: { name?: string; email?: string } | null;
      }>;
      const mapped: AuditRecord[] = (Array.isArray(res) ? res : []).map((row) => ({
        id: row.id,
        actor: row.actor?.name || row.actor?.email || row.actorId || 'System',
        timestamp: new Date(row.createdAt).toLocaleString('en-GH'),
        action: row.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
        entity: row.entityId ? `${row.entityType} (${row.entityId.slice(-6).toUpperCase()})` : row.entityType,
        entityTone: row.action.toLowerCase().includes('approve') ? 'green' : 'blue',
        details: row.reason || row.entityType,
        before: row.before ? JSON.stringify(row.before, null, 2) : '—',
        after: row.after ? JSON.stringify(row.after, null, 2) : '—',
        reason: row.reason || 'Recorded automatically by audit service',
      }));
      setLogs(mapped);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const actorOptions = ['All', ...Array.from(new Set(logs.map((l) => l.actor)))];

  const visible = logs.filter((row) => {
    if (actorFilter !== 'All' && row.actor !== actorFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.actor.toLowerCase().includes(q) ||
      row.action.toLowerCase().includes(q) ||
      row.entity.toLowerCase().includes(q) ||
      row.details.toLowerCase().includes(q)
    );
  });

  return (
    <div data-node-id="7:28149">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Audit logs
          </h1>
          <p className="dash-sub">
            Immutable operational &amp; financial audit trail.
          </p>
        </div>
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, action, entity or reason…"
            aria-label="Search audit logs"
          />
        </label>

        <StaffFilterDropdown
          label="Actor"
          value={actorFilter}
          options={actorOptions}
          onChange={setActorFilter}
        />

        <button
          type="button"
          className="button"
          style={{ background: '#fff' }}
          onClick={() =>
            downloadCsv(
              'audit-logs.csv',
              ['Timestamp', 'Actor', 'Action', 'Entity', 'Details'],
              visible.map((r) => [r.timestamp, r.actor, r.action, r.entity, r.details]),
            )
          }
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>

      <section className="acct-panel" style={{ padding: 0 }}>
        <div className="staff-table-head staff-audit-cols">
          <span>ACTOR</span>
          <span>ACTION</span>
          <span>ENTITY</span>
          <span>DETAILS</span>
          <span>TIME</span>
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadLogs} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No audit events found"
            description="No audit log entries match your current search or actor filter."
          />
        ) : (
          visible.map((row) => (
            <button
              key={row.id}
              type="button"
              className="staff-table-row staff-audit-cols"
              onClick={() => setSelected(row)}
            >
              <div>
                <strong title={row.actor}>{row.actor}</strong>
              </div>
              <span className="staff-cell-text" title={row.action}>{row.action}</span>
              <div>
                <span className={`acct-pill ${row.entityTone}`}>{row.entity}</span>
              </div>
              <span className="staff-cell-muted" title={row.details}>{row.details}</span>
              <span className="staff-cell-muted">{row.timestamp}</span>
            </button>
          ))
        )}
      </section>

      {selected && (
        <div
          className="login-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Audit entry detail"
          onClick={() => setSelected(null)}
        >
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="login-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X size={17} />
            </button>
            <div className="ship-eyebrow">{selected.entity}</div>
            <h2 style={{ marginTop: 6 }}>{selected.action}</h2>
            <p className="login-sub">
              {selected.actor} · {selected.timestamp}
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-body)', marginBottom: 12 }}>
              {selected.reason}
            </p>
            <div className="req-row-2">
              <div className="review-diff-box">
                <span>Before</span>
                <pre style={{ margin: '6px 0 0', fontSize: 11, whiteSpace: 'pre-wrap' }}>
                  {selected.before}
                </pre>
              </div>
              <div className="review-diff-box">
                <span>After</span>
                <pre style={{ margin: '6px 0 0', fontSize: 11, whiteSpace: 'pre-wrap' }}>
                  {selected.after}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
