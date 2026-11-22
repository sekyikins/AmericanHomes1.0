'use client';

import {
  ActiveFilterChips,
  HierarchicalFilterDropdown,
  SortableHeader,
} from '@/components/staff/TableControls';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { downloadCsv } from '@/lib/staffUtils';
import {
  applyFiltersAndSort,
  cycleSort,
  deriveFilterCategories,
  type FilterCategoryDef,
  type FilterValueMap,
  type SortColumnDef,
  type SortState,
} from '@/lib/tableUtils';
import {
  ChevronRight,
  Download,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  consentSummary: string;
  activityLabel: string;
  tone: 'green' | 'blue';
  totalSpent: string;
  whatsappTx: boolean;
};

export default function StaffCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValueMap>({});
  const [sort, setSort] = useState<SortState>(null);
  const [selected, setSelected] = useState<CustomerRecord | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = (await adminApi.customers()) as Array<{
        id: string;
        whatsappOptIn?: boolean;
        user?: { name?: string; phone?: string; email?: string };
        _count?: { orders?: number; reservations?: number; productRequests?: number };
        orders?: Array<{ totalCents?: number }>;
      }>;
      const mapped: CustomerRecord[] = (Array.isArray(res) ? res : []).map((c) => {
        const ordersCount = c._count?.orders ?? c.orders?.length ?? 0;
        const resCount = c._count?.reservations ?? 0;
        const reqCount = c._count?.productRequests ?? 0;
        const spentCents = (c.orders ?? []).reduce((s, o) => s + (o.totalCents ?? 0), 0);
        const whatsappTx = Boolean(c.whatsappOptIn);
        return {
          id: c.id,
          name: c.user?.name || c.user?.phone || 'Customer',
          phone: c.user?.phone || '—',
          email: c.user?.email || '',
          consentSummary: whatsappTx ? 'WhatsApp on' : 'Opted out',
          activityLabel: `${ordersCount} orders · ${resCount} holds · ${reqCount} requests`,
          tone: whatsappTx ? 'green' : 'blue',
          totalSpent: `GHS ${(spentCents / 100).toLocaleString()}`,
          whatsappTx,
        };
      });
      setCustomers(mapped);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filterDefs: FilterCategoryDef<CustomerRecord>[] = useMemo(
    () => [
      { key: 'consent', label: 'Consent', accessor: (c) => c.consentSummary },
      { key: 'activity', label: 'Activity', accessor: (c) => c.activityLabel },
    ],
    [],
  );

  const sortDefs: SortColumnDef<CustomerRecord>[] = useMemo(
    () => [
      { key: 'name', type: 'string', accessor: (c) => c.name },
      { key: 'email', type: 'string', accessor: (c) => c.email },
      { key: 'consentSummary', type: 'string', accessor: (c) => c.consentSummary },
      { key: 'activityLabel', type: 'string', accessor: (c) => c.activityLabel },
    ],
    [],
  );

  const filterCategories = useMemo(() => deriveFilterCategories(customers, filterDefs), [customers, filterDefs]);

  const visible = useMemo(() => {
    const searched = customers.filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
    return applyFiltersAndSort(searched, filters, filterDefs, sort, sortDefs);
  }, [customers, search, filters, filterDefs, sort, sortDefs]);

  const hasActiveFilters = Object.values(filters).some((vals) => vals && vals.length > 0);

  return (
    <div data-node-id="26:65245">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Customers
          </h1>
          <p className="dash-sub">
            Customer accounts, order history and notification consent.
          </p>
        </div>
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name, phone or email…"
            aria-label="Search customer name, phone or email"
          />
        </label>

        <HierarchicalFilterDropdown
          categories={filterCategories}
          selected={filters}
          onChange={setFilters}
        />

        <button
          type="button"
          className="button"
          style={{ background: '#fff' }}
          onClick={() =>
            downloadCsv(
              'customers.csv',
              ['Name', 'Phone', 'Email', 'Consent', 'Activity', 'Total spent'],
              visible.map((c) => [
                c.name,
                c.phone,
                c.email,
                c.consentSummary,
                c.activityLabel,
                c.totalSpent,
              ]),
            )
          }
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>

      <ActiveFilterChips
        categories={filterCategories}
        selected={filters}
        onChange={setFilters}
      />

      <section className="acct-panel" style={{ padding: 0 }}>
        <div className="staff-table-head staff-perm-cols">
          <SortableHeader label="CUSTOMER" sortKey="name" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="EMAIL" sortKey="email" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="CONSENT" sortKey="consentSummary" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="ACTIVITY" sortKey="activityLabel" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadCustomers} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No customers found"
            description="No customer accounts match your current search or filter."
            action={
              search || hasActiveFilters ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setSearch('');
                    setFilters({});
                  }}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          visible.map((c) => (
            <button
              key={c.id}
              type="button"
              className="staff-table-row staff-perm-cols"
              onClick={() => setSelected(c)}
            >
              <div>
                <strong>{c.name}</strong>
                <small>{c.phone}</small>
              </div>
              <span className="staff-cell-muted">{c.email || '—'}</span>
              <div>
                <span className={`acct-pill ${c.tone}`}>● {c.consentSummary}</span>
              </div>
              <span className="staff-cell-muted">{c.activityLabel}</span>
              <ChevronRight size={15} color="var(--green)" />
            </button>
          ))
        )}
      </section>

      {selected && (
        <div
          className="login-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Customer detail"
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
            <div className="ship-eyebrow">CUSTOMER PROFILE</div>
            <h2 style={{ marginTop: 6 }}>{selected.name}</h2>
            <p className="login-sub">
              {selected.phone} {selected.email ? `· ${selected.email}` : ''}
            </p>
            <dl className="ship-dl">
              <div className="ship-dl-row">
                <dt>Activity summary</dt>
                <dd>{selected.activityLabel}</dd>
              </div>
              <div className="ship-dl-row">
                <dt>Total spent</dt>
                <dd>{selected.totalSpent}</dd>
              </div>
              <div className="ship-dl-row">
                <dt>WhatsApp consent</dt>
                <dd>{selected.whatsappTx ? 'Opted in' : 'Opted out'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
