'use client';

import { CheckCircle2, Search, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { StaffFilterDropdown } from '@/components/staff/StaffFilterDropdown';
import { StaffModal } from '@/components/staff/StaffModal';
import { Button, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { governanceApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';

type StaffReportRow = {
  id: string;
  title: string;
  category: string;
  description: string;
  isAnonymous: boolean;
  reporterName: string;
  reviewerName: string | null;
  status: 'SUBMITTED' | 'ADDRESSED' | 'DECLINED';
  resolution: string | null;
  createdAt: string;
};

export default function StaffReportsPage() {
  const { user, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const [reports, setReports] = useState<StaffReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'REQUESTS' | 'REPORTS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'All reports' | 'Submitted' | 'Addressed' | 'Declined'>('All reports');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<StaffReportRow | null>(null);
  const [pendingAction, setPendingAction] = useState<'ADDRESSED' | 'DECLINED' | null>(null);
  const [resolution, setResolution] = useState('');
  const [acting, setActing] = useState(false);

  const canActOnReport = (row: StaffReportRow) =>
    Boolean(
      user?.isOwner ||
        user?.permissions?.includes('staff_reports.manage') ||
        (row.category === 'PROFILE_CHANGE' && user?.permissions?.includes('staff.manage')),
    );

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await governanceApi.listStaffReports();
      setReports(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          id: String(r.id),
          title: String(r.title ?? 'Report'),
          category: String(r.category ?? 'GENERAL'),
          description: String(r.description ?? ''),
          isAnonymous: Boolean(r.isAnonymous),
          reporterName: r.isAnonymous ? 'Anonymous' : String(r.reporterName ?? 'Staff member'),
          reviewerName: r.reviewerName ? String(r.reviewerName) : null,
          status: String(r.status ?? 'SUBMITTED') as StaffReportRow['status'],
          resolution: r.resolution ? String(r.resolution) : null,
          createdAt: r.createdAt
            ? new Date(String(r.createdAt)).toLocaleString('en-GH')
            : 'Recent',
        })),
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load reports & requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const visible = reports.filter((r) => {
    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'REQUESTS' ? r.category === 'PROFILE_CHANGE' : r.category !== 'PROFILE_CHANGE');
    const matchesStatus =
      statusFilter === 'All reports' || r.status === statusFilter.toUpperCase();
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.reporterName.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q);
    return matchesType && matchesStatus && matchesSearch;
  });

  const handleConfirmAction = async () => {
    if (!selected || !pendingAction || acting) return;
    setActing(true);
    try {
      await governanceApi.actOnStaffReport(selected.id, {
        action: pendingAction,
        resolution: resolution.trim() || undefined,
      });
      if (pendingAction === 'ADDRESSED' && selected.category === 'PROFILE_CHANGE') {
        await refreshAuth().catch(() => {});
      }
      showToast(
        pendingAction === 'ADDRESSED'
          ? selected.category === 'PROFILE_CHANGE'
            ? 'Profile change approved and applied'
            : 'Report marked as addressed'
          : 'Report declined',
        pendingAction === 'ADDRESSED' ? 'success' : 'info',
      );
      setSelected(null);
      setPendingAction(null);
      setResolution('');
      await loadReports();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update report.', 'error');
    } finally {
      setActing(false);
    }
  };

  const badgeClass = (status: StaffReportRow['status']) => {
    if (status === 'ADDRESSED') return 'green';
    if (status === 'DECLINED') return 'red';
    return 'amber';
  };

  return (
    <div data-node-id="staff-reports-view">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Staff reports & requests
          </h1>
          <p className="dash-sub">
            Internal staff reports, workplace requests, and profile change approvals.
          </p>
        </div>
      </div>

      <div className="ship-tabs-bar" style={{ marginBottom: 16 }}>
        {(
          [
            { id: 'ALL', label: 'All' },
            { id: 'REQUESTS', label: 'Requests' },
            { id: 'REPORTS', label: 'Reports' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ship-tab-btn${typeFilter === tab.id ? ' active' : ''}`}
            onClick={() => setTypeFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports by title, category, or reporter..."
            aria-label="Search staff reports & requests"
          />
        </label>

        <StaffFilterDropdown
          label="Status"
          value={statusFilter}
          options={['All reports', 'Submitted', 'Addressed', 'Declined']}
          onChange={(v) => setStatusFilter(v as typeof statusFilter)}
        />
      </div>

      <section className="acct-panel" style={{ padding: 0, overflowX: 'auto' }}>
        <div
          className="staff-table-head"
          style={{ gridTemplateColumns: 'minmax(260px, 1.8fr) 120px 140px 130px max-content', minWidth: 740 }}
        >
          <span>REPORT / REQUEST</span>
          <span>CATEGORY</span>
          <span>SUBMITTED BY</span>
          <span>STATUS</span>
          <span style={{ textAlign: 'right' }}>ACTION</span>
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={4} />
          </div>
        ) : loadError ? (
          <div style={{ padding: 16 }}>
            <ErrorState message={loadError} onRetry={loadReports} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No staff reports or requests found"
            description="Submitted staff reports and profile change requests will appear here."
          />
        ) : (
          visible.map((r) => (
            <div
              key={r.id}
              className="staff-table-row"
              style={{
                gridTemplateColumns: 'minmax(260px, 1.8fr) 120px 140px 130px max-content',
                minWidth: 740,
                cursor: 'default',
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)' }}>
                  {r.title}
                </strong>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {r.description}
                </span>
                <small style={{ display: 'block', fontSize: 11, color: '#8c9aa0', marginTop: 4 }}>
                  {r.createdAt}
                  {r.reviewerName ? ` · Reviewed by ${r.reviewerName}` : ''}
                </small>
                {r.resolution && (
                  <small style={{ display: 'block', marginTop: 4, color: 'var(--green)' }}>
                    Resolution: {r.resolution}
                  </small>
                )}
              </div>

              <div>
                <span className="acct-pill blue">{r.category.replace('_', ' ')}</span>
              </div>

              <div>
                {r.isAnonymous ? (
                  <span className="acct-pill">Anonymous</span>
                ) : (
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                    {r.reporterName}
                  </span>
                )}
              </div>

              <div>
                <span className={`acct-pill ${badgeClass(r.status)}`}>● {r.status}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                {r.status === 'SUBMITTED' && canActOnReport(r) ? (
                  <>
                    <button
                      type="button"
                      className="button primary"
                      style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                      onClick={() => {
                        setSelected(r);
                        setPendingAction('ADDRESSED');
                        setResolution('');
                      }}
                    >
                      <CheckCircle2 size={13} />
                      <span>{r.category === 'PROFILE_CHANGE' ? 'Approve' : 'Address'}</span>
                    </button>
                    <button
                      type="button"
                      className="button"
                      style={{
                        height: 32,
                        padding: '0 10px',
                        fontSize: 12,
                        color: 'var(--alert)',
                        background: '#fff',
                      }}
                      onClick={() => {
                        setSelected(r);
                        setPendingAction('DECLINED');
                        setResolution('');
                      }}
                    >
                      <XCircle size={13} />
                      <span>Decline</span>
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {r.status === 'SUBMITTED' ? 'View only' : 'Completed'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      <StaffModal
        open={Boolean(selected && pendingAction)}
        variant="settings"
        label={pendingAction === 'ADDRESSED' ? 'Address staff report' : 'Decline staff report'}
        onClose={() => {
          setSelected(null);
          setPendingAction(null);
        }}
      >
        <div className="eyebrow">Staff report decision</div>
        <h2 className="review-title" style={{ marginTop: 4 }}>
          {pendingAction === 'ADDRESSED'
            ? selected?.category === 'PROFILE_CHANGE'
              ? 'Approve profile change'
              : 'Mark report as addressed'
            : 'Decline staff report'}
        </h2>
        <p className="review-sub">{selected?.title}</p>

        <div className="req-field" style={{ marginTop: 16 }}>
          <label htmlFor="report-resolution">
            <strong>Resolution note (optional)</strong>
          </label>
          <textarea
            id="report-resolution"
            rows={3}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Record action taken or reason for decision..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            className="button"
            onClick={() => {
              setSelected(null);
              setPendingAction(null);
            }}
          >
            Cancel
          </button>
          <Button
            type="button"
            variant="primary"
            loading={acting}
            loadingText="Updating…"
            onClick={handleConfirmAction}
          >
            Confirm {pendingAction === 'ADDRESSED' ? 'Addressed' : 'Declined'}
          </Button>
        </div>
      </StaffModal>
    </div>
  );
}
