'use client';

import { StaffProfileModal } from '@/components/staff/staff/StaffProfileModal';
import {
  ActiveFilterChips,
  HierarchicalFilterDropdown,
  SortableHeader,
} from '@/components/staff/TableControls';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { permissionsApi, staffApi } from '@/lib/api';
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
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';
import {
  ChevronRight,
  Download,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

type StaffMember = {
  id: string;
  name: string;
  phone: string;
  email: string;
  jobTitle: string;
  accessLabel: string;
  tone: 'green' | 'blue';
  details: string;
  status: 'Active' | 'Inactive';
  groups: string[];
  restrictFinancials?: boolean;
  isOwner?: boolean;
};

export default function StaffAccountsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canManageStaff = Boolean(user?.isOwner || user?.permissions?.includes('staff.manage'));
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groupMap, setGroupMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValueMap>({});
  const [sort, setSort] = useState<SortState>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [restrictFinancials, setRestrictFinancials] = useState(false);

  const availableGroups = Object.keys(groupMap);

  const fetchStaff = (silent = false) => {
    if (!silent) setLoadingList(true);
    setLoadError(null);
    Promise.all([
      staffApi.list(),
      permissionsApi.listGroups().catch(() => null),
    ])
      .then(([staffRows, groupRows]) => {
        if (Array.isArray(groupRows)) {
          const map: Record<string, string> = {};
          for (const g of groupRows as Array<{ id: string; name: string }>) {
            map[g.name] = g.id;
          }
          setGroupMap(map);
        }
        if (Array.isArray(staffRows)) {
          const mapped: StaffMember[] = (
            staffRows as Array<{
              id: string;
              isActive: boolean;
              isOwner?: boolean;
              restrictFinancials?: boolean;
              jobTitle?: string | null;
              user?: { name?: string; phone?: string; email?: string };
              groupAssignments?: Array<{ group?: { name?: string } }>;
            }>
          ).map((row) => {
            const groups = (row.groupAssignments ?? [])
              .map((ga) => ga.group?.name)
              .filter((n): n is string => Boolean(n));
            return {
              id: row.id,
              name: row.user?.name || row.user?.email || 'Staff member',
              phone: row.user?.phone || '',
              email: row.user?.email || '',
              jobTitle: row.jobTitle || (row.isOwner ? 'Owner' : 'Staff'),
              accessLabel: row.isActive ? 'Active access' : 'Inactive',
              tone: row.isOwner ? 'green' : 'blue',
              details: groups.length > 0 ? groups.join(', ') : (row.user?.email || 'Staff account'),
              status: row.isActive ? 'Active' : 'Inactive',
              groups,
              restrictFinancials: Boolean(row.restrictFinancials),
              isOwner: Boolean(row.isOwner),
            };
          });
          setStaff(mapped);
        }
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Unable to load staff accounts.');
      })
      .finally(() => {
        setLoadingList(false);
      });
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filterDefs: FilterCategoryDef<StaffMember>[] = useMemo(
    () => [
      { key: 'status', label: 'Status', accessor: (m) => m.status },
      { key: 'role', label: 'Role', accessor: (m) => m.jobTitle },
      { key: 'access', label: 'Access', accessor: (m) => m.accessLabel },
    ],
    [],
  );

  const sortDefs: SortColumnDef<StaffMember>[] = useMemo(
    () => [
      { key: 'name', type: 'string', accessor: (m) => m.name },
      { key: 'jobTitle', type: 'string', accessor: (m) => m.jobTitle },
      {
        key: 'status',
        type: 'status',
        statusOrder: ['Active', 'Inactive'],
        accessor: (m) => m.status,
      },
      { key: 'details', type: 'string', accessor: (m) => m.details },
    ],
    [],
  );

  const filterCategories = useMemo(() => deriveFilterCategories(staff, filterDefs), [staff, filterDefs]);

  const visible = useMemo(() => {
    const searched = staff.filter((member) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        member.name.toLowerCase().includes(q) ||
        member.phone.toLowerCase().includes(q) ||
        member.jobTitle.toLowerCase().includes(q)
      );
    });
    return applyFiltersAndSort(searched, filters, filterDefs, sort, sortDefs);
  }, [staff, search, filters, filterDefs, sort, sortDefs]);

  const hasActiveFilters = Object.values(filters).some((vals) => vals && vals.length > 0);

  const openCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setJobTitle('');
    setStatus('Active');
    setSelectedGroups(availableGroups[0] ? [availableGroups[0]] : []);
    setRestrictFinancials(false);
  };

  const openEdit = (member: StaffMember) => {
    setModalMode('edit');
    setEditingId(member.id);
    setFullName(member.name);
    setPhone(member.phone);
    setEmail(member.email);
    setPassword('');
    setJobTitle(member.jobTitle);
    setStatus(member.status);
    setSelectedGroups(member.groups);
    setRestrictFinancials(Boolean(member.restrictFinancials));
  };

  const toggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  };

  const executeSave = async () => {
    if (saving || !fullName.trim() || !phone.trim()) return;
    setSaving(true);
    const detailsText =
      selectedGroups.length > 0 ? selectedGroups.join(', ') : 'No group assigned';
    const groupIds = selectedGroups.map((g) => groupMap[g]).filter(Boolean);

    try {
      if (modalMode === 'create') {
        const created = (await staffApi.create({
          name: fullName.trim(),
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(password ? { password } : {}),
          ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
          ...(groupIds.length > 0 ? { permissionGroupIds: groupIds } : {}),
          ...(user?.isOwner ? { restrictFinancials } : {}),
        })) as { id?: string } | null;
        showToast(`Created staff account for ${fullName.trim()}`, 'success');
        fetchStaff(true);
      } else if (modalMode === 'edit' && editingId) {
        await staffApi.update(editingId, {
          name: fullName.trim(),
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(password ? { password } : {}),
          ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
          isActive: status === 'Active',
          permissionGroupIds: groupIds,
          ...(user?.isOwner ? { restrictFinancials } : {}),
        });
        if (status === 'Inactive') {
          await staffApi.deactivate(editingId);
        }
        setStaff((prev) =>
          prev.map((m) =>
            m.id === editingId
              ? {
                  ...m,
                  name: fullName.trim(),
                  phone: phone.trim(),
                  jobTitle: jobTitle.trim() || m.jobTitle,
                  accessLabel: status === 'Active' ? 'Active access' : 'Inactive',
                  tone: status === 'Active' ? (m.isOwner ? 'green' : 'blue') : 'blue',
                  details: detailsText,
                  status,
                  groups: selectedGroups,
                }
              : m,
          ),
        );
        showToast(
          status === 'Inactive'
            ? `Deactivated staff account for ${fullName.trim()}`
            : `Updated staff account for ${fullName.trim()}`,
          status === 'Inactive' ? 'warning' : 'success',
        );
        fetchStaff(true);
      }
      setConfirmDeactivate(false);
      setModalMode(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save staff account changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !fullName.trim() || !phone.trim()) return;
    const existing = editingId ? staff.find((m) => m.id === editingId) : null;
    if (modalMode === 'edit' && status === 'Inactive' && existing?.status !== 'Inactive') {
      setConfirmDeactivate(true);
      return;
    }
    await executeSave();
  };

  return (
    <div data-node-id="25:65207">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Staff accounts
          </h1>
          <p className="dash-sub">Team profiles, roles and account status.</p>
        </div>

        {canManageStaff && (
          <button type="button" className="button primary" onClick={openCreate}>
            <Plus size={15} />
            <span>Add staff account</span>
          </button>
        )}
      </div>

      <div
        className="settings-perm-banner"
        style={{
          marginTop: 0,
          marginBottom: 18,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <ShieldCheck size={17} color="var(--green)" style={{ marginTop: 1 }} />
          <div>
            <strong>Owner account: {staff.find((m) => m.isOwner)?.name || 'Owner'}</strong>
            <span>
              Only the owner can manage other managers, unrestricted financial controls and
              owner-level settings.
            </span>
          </div>
        </div>
        <span className="acct-pill green" style={{ flexShrink: 0 }}>
          ● Protected
        </span>
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff accounts..."
            aria-label="Search staff accounts"
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
              'staff-accounts.csv',
              ['Name', 'Phone', 'Role', 'Access', 'Details', 'Status'],
              visible.map((m) => [m.name, m.phone, m.jobTitle, m.accessLabel, m.details, m.status]),
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
          <SortableHeader label="NAME / REFERENCE" sortKey="name" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="ROLE / TYPE" sortKey="jobTitle" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="ACCESS / STATUS" sortKey="status" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="DETAILS" sortKey="details" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <span />
        </div>

        {loadingList ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={4} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={fetchStaff} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No staff accounts match"
            description="Adjust your search term or clear filters to see all staff accounts."
            action={
              search.trim() || hasActiveFilters ? (
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
          visible.map((member) => (
            <button
              key={member.id}
              type="button"
              className="staff-table-row staff-perm-cols"
              onClick={() => openEdit(member)}
            >
              <div>
                <strong>{member.name}</strong>
                <small>{member.phone}</small>
              </div>
              <span className="staff-cell-muted">{member.jobTitle}</span>
              <div>
                <span className={`acct-pill ${member.tone}`}>● {member.accessLabel}</span>
              </div>
              <span className="staff-cell-muted">{member.details}</span>
              <ChevronRight size={15} color="var(--green)" />
            </button>
          ))
        )}
      </section>

      <StaffProfileModal
        modalMode={modalMode}
        fullName={fullName}
        phone={phone}
        email={email}
        password={password}
        jobTitle={jobTitle}
        status={status}
        availableGroups={availableGroups}
        selectedGroups={selectedGroups}
        restrictFinancials={restrictFinancials}
        canRestrictFinancials={Boolean(user?.isOwner)}
        saving={saving}
        onFullNameChange={setFullName}
        onPhoneChange={setPhone}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onJobTitleChange={setJobTitle}
        onStatusChange={setStatus}
        onToggleGroup={toggleGroup}
        onRestrictFinancialsChange={setRestrictFinancials}
        onSubmit={handleSubmit}
        onClose={() => setModalMode(null)}
      />

      <ConfirmDialog
        open={confirmDeactivate}
        title="Deactivate staff account?"
        targetName={fullName}
        description="This staff account will be marked Inactive."
        consequence="The staff member will immediately lose access to the Staff Portal until reactivated."
        reversible={true}
        destructive={true}
        confirmLabel="Deactivate account"
        loading={saving}
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={executeSave}
      />
    </div>
  );
}
