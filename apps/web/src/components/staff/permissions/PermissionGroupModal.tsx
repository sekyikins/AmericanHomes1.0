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
  onSubmit,
  onClose,
}: PermissionGroupModalProps) {
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
        Effective access combines groups and explicit overrides. Approval remains separate
        from performance.
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
            maxHeight: 340,
            overflowY: 'auto',
          }}
        >
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
            }}
          >
            <span>ASSIGNED PERMISSIONS</span>
            <span>{selectedCodes.length} selected</span>
          </div>
          {PERMISSION_MODULES.map((mod) => (
            <div
              key={mod.module}
              style={{
                padding: '12px 14px',
                borderBottom: '0.8px solid var(--line)',
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  marginBottom: 8,
                }}
              >
                {mod.module}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
                  gap: 8,
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
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={isOwnerGroup}
                      checked={selectedCodes.includes(p.code)}
                      onChange={() => onToggleCode(p.code)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {selectedCodes.some((c) => !KNOWN_PERMISSION_CODES.has(c)) && (
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
