'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import { ArrowRight, Info } from 'lucide-react';
import type { FormEvent } from 'react';

interface StaffProfileModalProps {
  modalMode: 'create' | 'edit' | null;
  fullName: string;
  phone: string;
  email: string;
  password: string;
  jobTitle: string;
  status: 'Active' | 'Inactive';
  availableGroups: string[];
  selectedGroups: string[];
  saving: boolean;
  onFullNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onJobTitleChange: (value: string) => void;
  onStatusChange: (value: 'Active' | 'Inactive') => void;
  onToggleGroup: (group: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function StaffProfileModal({
  modalMode,
  fullName,
  phone,
  email,
  password,
  jobTitle,
  status,
  availableGroups,
  selectedGroups,
  saving,
  onFullNameChange,
  onPhoneChange,
  onEmailChange,
  onPasswordChange,
  onJobTitleChange,
  onStatusChange,
  onToggleGroup,
  onSubmit,
  onClose,
}: StaffProfileModalProps) {
  return (
    <StaffModal
      open={Boolean(modalMode)}
      label={modalMode === 'create' ? 'Create staff account' : 'Staff profile'}
      onClose={onClose}
    >
      <div className="review-top-row">
        <div className="eyebrow">
          {modalMode === 'create' ? 'New record' : fullName.toUpperCase()}
        </div>
        {modalMode === 'edit' && (
          <span className="acct-pill amber" style={{ marginRight: 36 }}>
            ● Action required
          </span>
        )}
      </div>

      <h2 className="review-title">
        {modalMode === 'create' ? 'Create staff account' : 'Staff profile'}
      </h2>
      <p className="review-sub">
        Assign permission groups without granting owner-level access.
      </p>

      <form onSubmit={onSubmit}>
        <div className="req-row-2" style={{ marginTop: 20 }}>
          <div className="req-field">
            <label htmlFor="staff-full-name">
              <strong>Full name</strong>
            </label>
            <input
              id="staff-full-name"
              required
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              placeholder="e.g. Kwame Asare"
            />
          </div>

          <div className="req-field">
            <label htmlFor="staff-phone">
              <strong>Phone number</strong>
            </label>
            <input
              id="staff-phone"
              required
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="+233 24 000 0000"
            />
          </div>
        </div>

        <div className="req-row-2">
          <div className="req-field">
            <label htmlFor="staff-email">
              <strong>Staff email</strong>
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="manager@americanhomes.gh"
            />
          </div>

          <div className="req-field">
            <label htmlFor="staff-password">
              <strong>{modalMode === 'create' ? 'Password' : 'New password (optional)'}</strong>
            </label>
            <input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder={modalMode === 'create' ? 'Set portal password' : 'Leave blank to keep current'}
            />
          </div>
        </div>

        <div className="req-row-2">
          <div className="req-field">
            <label htmlFor="staff-job">
              <strong>Job title</strong>
            </label>
            <input
              id="staff-job"
              value={jobTitle}
              onChange={(e) => onJobTitleChange(e.target.value)}
              placeholder="Operational role"
            />
          </div>

          <div className="req-field">
            <label htmlFor="staff-status">
              <strong>Account status</strong>
            </label>
            <select
              id="staff-status"
              value={status}
              onChange={(e) => onStatusChange(e.target.value as 'Active' | 'Inactive')}
              style={{
                width: '100%',
                padding: '11px 13px',
                border: '0.8px solid var(--line)',
                borderRadius: 4,
                background: '#fff',
                fontSize: 13,
              }}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="req-field">
          <label>
            <strong>Permission groups</strong>
          </label>
          <div
            style={{
              background: '#fff',
              border: '0.8px solid var(--line)',
              borderRadius: 4,
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {availableGroups.map((group) => (
              <label
                key={group}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: 'var(--ink-body)',
                  margin: 0,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group)}
                  onChange={() => onToggleGroup(group)}
                  style={{ width: 15, height: 15, accentColor: 'var(--green)' }}
                />
                <span>{group}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="request-info-banner" style={{ marginTop: 14 }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Manager groups do not automatically grant owner-level privileges.</span>
        </div>

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
      </form>
    </StaffModal>
  );
}
