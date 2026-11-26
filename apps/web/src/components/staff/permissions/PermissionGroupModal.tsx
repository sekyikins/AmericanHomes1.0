'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import {
  KNOWN_PERMISSION_CODES,
  PERMISSION_MODULES,
} from '@/lib/permissionCatalog';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';

interface PermissionGroupModalProps {
  modalMode: 'create' | 'edit' | null;
  groupName: string;
  membersLabel: string;
  selectedCodes: string[];
  isOwnerGroup: boolean;
  saving: boolean;
  onGroupNameChange: (value: string) => void;
  onMembersLabelChange: (value: string) => void;
  onToggleCode: (code: string) => void;
  onToggleSection: (codes: string[]) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function PermissionGroupModal({
  modalMode,
  groupName,
  membersLabel,
  selectedCodes,
  isOwnerGroup,
  saving,
  onGroupNameChange,
  onMembersLabelChange,
  onToggleCode,
  onToggleSection,
  onSubmit,
  onClose,
}: PermissionGroupModalProps) {
  const totalKnownCount = KNOWN_PERMISSION_CODES.size;
  return (
    <StaffModal
      open={Boolean(modalMode)}
      variant="review"
      label={modalMode === 'create' ? 'Create permission group' : 'Permission group'}
      onClose={onClose}
    >
      <div className="review-top-row">
        <div className="eyebrow">
          {modalMode === 'create' ? 'New record' : groupName.toUpperCase()}
        </div>
        {modalMode === 'edit' && (
          <span className="acct-pill amber" style={{ marginRight: 36 }}>
            ● Action required
          </span>
        )}
      </div>

      <h2 className="review-title">
        {modalMode === 'create' ? 'Create permission group' : 'Permission group'}
      </h2>
      <p className="review-sub">
        {isOwnerGroup
          ? 'Owner is an intrinsic system group that always exists. Anyone assigned to it automatically has unrestricted access to all permissions.'
          : 'Effective access combines groups and explicit overrides. Approval remains separate from performance.'}
      </p>

      <form onSubmit={onSubmit}>
        <div className="req-row-2" style={{ marginTop: 20 }}>
          <div className="req-field">
            <label htmlFor="perm-group-name">
              <strong>Group name</strong>
            </label>
            <input
              id="perm-group-name"
              required
              disabled={isOwnerGroup}
              value={groupName}
              onChange={(e) => onGroupNameChange(e.target.value)}
              placeholder="e.g. Warehouse supervisors"
            />
          </div>

          <div className="req-field">
            <label htmlFor="perm-members">
              <strong>Description</strong>
            </label>
            <input
              id="perm-members"
              disabled={isOwnerGroup}
              value={membersLabel}
              onChange={(e) => onMembersLabelChange(e.target.value)}
              placeholder="Role responsibilities and scope"
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            border: '0.8px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Pinned header — stays fixed while permission sections scroll below */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: '#f7f8f7',
              borderBottom: '0.8px solid var(--line)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              flexShrink: 0,
            }}
          >
            <span>ASSIGNED PERMISSIONS</span>
            <span>
              {isOwnerGroup
                ? `All ${totalKnownCount} permissions (Owner)`
                : `${selectedCodes.length} selected`}
            </span>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {PERMISSION_MODULES.map((mod) => {
              const modCodes = mod.permissions.map((p) => p.code);
              const checkedCount = isOwnerGroup
                ? modCodes.length
                : modCodes.filter((c) => selectedCodes.includes(c)).length;
              const allChecked = checkedCount === modCodes.length && modCodes.length > 0;
              const someChecked = checkedCount > 0 && checkedCount < modCodes.length;

              return (
                <div
                  key={mod.module}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '0.8px solid var(--line)',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: 'var(--ink)',
                      marginBottom: 8,
                      cursor: isOwnerGroup ? 'default' : 'pointer',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        disabled={isOwnerGroup}
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked;
                        }}
                        onChange={() => onToggleSection(modCodes)}
                        aria-label={`Select all permissions in ${mod.module}`}
                      />
                      <span>{mod.module}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                      {checkedCount}/{modCodes.length}
                    </span>
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
                      gap: 8,
                      paddingLeft: 22,
                    }}
                  >
                    {mod.permissions.map((p) => (
                      <label
                        key={p.code}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12.5,
                          color: 'var(--ink-body)',
                          cursor: isOwnerGroup ? 'default' : 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={isOwnerGroup}
                          checked={isOwnerGroup || selectedCodes.includes(p.code)}
                          onChange={() => onToggleCode(p.code)}
                        />
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {!isOwnerGroup && selectedCodes.some((c) => !KNOWN_PERMISSION_CODES.has(c)) && (
              <div style={{ padding: '12px 14px' }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: 'var(--ink)',
                    marginBottom: 8,
                  }}
                >
                  Other / Legacy Permissions
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
                    gap: 8,
                  }}
                >
                  {selectedCodes
                    .filter((c) => !KNOWN_PERMISSION_CODES.has(c))
                    .map((code) => (
                      <label
                        key={code}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12.5,
                          color: 'var(--ink-body)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={isOwnerGroup}
                          checked
                          onChange={() => onToggleCode(code)}
                        />
                        <span>{code}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="request-info-banner" style={{ marginTop: 18 }}>
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {isOwnerGroup
              ? 'The Owner permission group is locked and cannot be modified.'
              : 'Owner-only permissions and self-approval remain blocked regardless of group configuration.'}
          </span>
        </div>

        {!isOwnerGroup && (
          <div className="review-actions" style={{ borderTop: 0, paddingTop: 6 }}>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              loadingText="Saving…"
              style={{ minHeight: 44 }}
            >
              <span>{modalMode === 'create' ? 'Create record' : 'Save changes'}</span>
              <ArrowRight size={15} />
            </Button>
          </div>
        )}
      </form>
    </StaffModal>
  );
}
