'use client';

import { PermissionGroupModal } from '@/components/staff/permissions/PermissionGroupModal';
import {
  ActiveFilterChips,
  HierarchicalFilterDropdown,
  SortableHeader,
} from '@/components/staff/TableControls';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { permissionsApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
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
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

type PermissionGroupRow = {
  id: string;
  name: string;
  refCode: string;
  roleType: string;
  permissionCount: number;
  tone: 'green' | 'blue';
  membersLabel: string;
  permissionCodes: string[];
};

export default function StaffPermissionsPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<PermissionGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValueMap>({});
  const [sort, setSort] = useState<SortState>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [groupName, setGroupName] = useState('');
  const [membersLabel, setMembersLabel] = useState('Permission group');
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadGroups = () => {
    setLoading(true);
    setLoadError(null);
    permissionsApi
      .listGroups()
      .then((rows) => {
        const mapped: PermissionGroupRow[] = (
          Array.isArray(rows)
            ? (rows as Array<{
                id: string;
                name: string;
                description?: string;
                permissions?: Array<{ permission?: { code?: string } }>;
              }>)
            : []
        ).map((g) => {
          const codes = Array.from(
            new Set(
              (g.permissions ?? [])
                .map((gp) => gp.permission?.code)
                .filter((c): c is string => Boolean(c)),
            ),
          );
          return {
            id: g.id,
            name: g.name,
            refCode: g.id.slice(0, 12),
            roleType: 'Permission group',
            permissionCount: codes.length,
            tone: g.name.toLowerCase().includes('owner') ? 'green' : 'blue',
            membersLabel: g.description || 'Permission group',
            permissionCodes: codes,
          };
        });
        setGroups(mapped);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Unable to load permission groups.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (!modalMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalMode(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalMode]);

  const filterDefs: FilterCategoryDef<PermissionGroupRow>[] = useMemo(
    () => [
      { key: 'roleType', label: 'Role type', accessor: (g) => g.roleType },
      { key: 'scope', label: 'Scope', accessor: (g) => g.membersLabel },
    ],
    [],
  );

  const sortDefs: SortColumnDef<PermissionGroupRow>[] = useMemo(
    () => [
      { key: 'name', type: 'string', accessor: (g) => g.name },
      { key: 'permissionCount', type: 'number', accessor: (g) => g.permissionCount },
      { key: 'membersLabel', type: 'string', accessor: (g) => g.membersLabel },
    ],
    [],
  );

  const filterCategories = useMemo(() => deriveFilterCategories(groups, filterDefs), [groups, filterDefs]);

  const visible = useMemo(() => {
    const searched = groups.filter((g) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        g.membersLabel.toLowerCase().includes(q) ||
        g.refCode.toLowerCase().includes(q)
      );
    });
    return applyFiltersAndSort(searched, filters, filterDefs, sort, sortDefs);
  }, [groups, search, filters, filterDefs, sort, sortDefs]);

  const hasActiveFilters = Object.values(filters).some((vals) => vals && vals.length > 0);

  const openCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setGroupName('');
    setMembersLabel('');
    setSelectedCodes([]);
  };

  const openEdit = (group: PermissionGroupRow) => {
    setModalMode('edit');
    setEditingId(group.id);
    setGroupName(group.name);
    setMembersLabel(group.membersLabel);
    setSelectedCodes(group.permissionCodes);
  };

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const isOwnerGroup = modalMode === 'edit' && groupName.trim().toLowerCase() === 'owner';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || saving || isOwnerGroup) return;
    const permissionCodes = Array.from(new Set(selectedCodes));
    setSaving(true);
    try {
      if (modalMode === 'create') {
        const created = (await permissionsApi.createGroup({
          name: groupName.trim(),
          description: membersLabel.trim() || undefined,
          permissionCodes,
        })) as { id?: string } | null;
        setGroups((prev) => [
          ...prev,
          {
            id: created?.id ?? String(Date.now()),
            name: groupName.trim(),
            refCode: (created?.id ?? String(Date.now())).slice(0, 12),
            roleType: 'Permission group',
            permissionCount: permissionCodes.length,
            tone: 'blue',
            membersLabel: membersLabel.trim() || 'Permission group',
            permissionCodes,
          },
        ]);
        showToast(`Created permission group "${groupName.trim()}"`, 'success');
      } else if (modalMode === 'edit' && editingId) {
        await permissionsApi.updateGroup(editingId, {
          name: groupName.trim(),
          description: membersLabel.trim() || undefined,
          permissionCodes,
        });
        setGroups((prev) =>
          prev.map((g) =>
            g.id === editingId
              ? {
                  ...g,
                  name: groupName.trim(),
                  membersLabel: membersLabel.trim() || 'Permission group',
                  permissionCount: permissionCodes.length,
                  permissionCodes,
                }
              : g,
          ),
        );
        showToast(`Updated "${groupName.trim()}" (${permissionCodes.length} permissions)`, 'success');
      }
      setModalMode(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save permission group', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-node-id="7:24210">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Permission management
          </h1>
          <p className="dash-sub">
            Understand effective access from groups and individual overrides.
          </p>
        </div>

        <button type="button" className="button primary" onClick={openCreate}>
          <Plus size={15} />
          <span>Create permission group</span>
        </button>
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
            <strong>Owner account: Mr. Zero</strong>
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
            placeholder="Search permission management..."
            aria-label="Search permission groups"
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
              'permission-groups.csv',
              ['Group', 'Reference', 'Role Type', 'Members', 'Permissions Count'],
              visible.map((g) => [
                g.name,
                g.refCode,
                g.roleType,
                g.membersLabel,
                g.permissionCount,
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
        <div
          className="staff-table-head"
          style={{ gridTemplateColumns: '1.3fr 0.9fr 1.6fr 28px' }}
        >
          <SortableHeader label="GROUP" sortKey="name" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="PERMISSIONS" sortKey="permissionCount" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="DESCRIPTION" sortKey="membersLabel" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={4} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadGroups} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No permission groups found"
            description="Create a permission group or clear your search filter."
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
          visible.map((group) => (
            <button
              key={group.id}
              type="button"
              className="staff-table-row"
              style={{ gridTemplateColumns: '1.3fr 0.9fr 1.6fr 28px' }}
              onClick={() => openEdit(group)}
            >
              <div>
                <strong>{group.name}</strong>
              </div>
              <div>
                <span className={`acct-pill ${group.tone}`}>
                  ● {group.permissionCount} permissions
                </span>
              </div>
              <span className="staff-cell-muted">{group.membersLabel}</span>
              <ChevronRight size={15} color="var(--green)" />
            </button>
          ))
        )}
      </section>

      <PermissionGroupModal
        modalMode={modalMode}
        groupName={groupName}
        membersLabel={membersLabel}
        selectedCodes={selectedCodes}
        isOwnerGroup={isOwnerGroup}
        saving={saving}
        onGroupNameChange={setGroupName}
        onMembersLabelChange={setMembersLabel}
        onToggleCode={toggleCode}
        onSubmit={handleSubmit}
        onClose={() => setModalMode(null)}
      />
    </div>
  );
}
