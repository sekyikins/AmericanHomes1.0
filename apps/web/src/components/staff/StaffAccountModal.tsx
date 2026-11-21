'use client';

import { FileText, KeyRound, ShieldAlert, User } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import { authApi, governanceApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';

type Tab = 'profile' | 'password' | 'report';

export function StaffAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, setAuth } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');

  // Profile change request fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // General report fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    setName(user.name ?? '');
    setEmail(user.email ?? '');
    setPhone(user.phone ?? '');
    setReason('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [user, open]);

  const handleRequestProfileChange = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingChange || !user) return;
    const requestedChanges: { name?: string; email?: string; phone?: string } = {};
    if (name.trim() && name.trim() !== (user.name ?? '').trim()) {
      requestedChanges.name = name.trim();
    }
    if (email.trim().toLowerCase() !== (user.email ?? '').trim().toLowerCase()) {
      requestedChanges.email = email.trim().toLowerCase();
    }
    if (phone.trim().replace(/\s+/g, '') !== (user.phone ?? '').trim().replace(/\s+/g, '')) {
      requestedChanges.phone = phone.trim().replace(/\s+/g, '');
    }

    if (Object.keys(requestedChanges).length === 0) {
      showToast('Make a change to your name, email, or phone before submitting.', 'info');
      return;
    }

    setSubmittingChange(true);
    try {
      const summary = Object.entries(requestedChanges)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      await governanceApi.createStaffReport({
        title: `Profile change request (${user.name || user.email || 'Staff'})`,
        category: 'PROFILE_CHANGE',
        description: reason.trim()
          ? `${summary} — Reason: ${reason.trim()}`
          : `Requested updates: ${summary}`,
        requestedChanges,
      });
      showToast('Profile change request submitted for approval', 'success');
      setReason('');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit change request.', 'error');
    } finally {
      setSubmittingChange(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (savingPassword) return;
    if (!currentPassword) {
      showToast('Enter your current password.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await authApi.changeStaffPassword(currentPassword, newPassword);
      if (res.token && user) {
        setAuth(user, res.token);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully', 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSubmitReport = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingReport || !title.trim() || !description.trim()) return;
    setSubmittingReport(true);
    try {
      await governanceApi.createStaffReport({
        title: title.trim(),
        category,
        description: description.trim(),
        isAnonymous,
      });
      setTitle('');
      setCategory('GENERAL');
      setDescription('');
      setIsAnonymous(false);
      showToast(
        isAnonymous ? 'Anonymous staff report submitted' : 'Staff report submitted',
        'success',
      );
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit report.', 'error');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <StaffModal open={open} variant="settings" label="Staff account" onClose={onClose}>
      <div className="eyebrow">Staff account</div>
      <h2 className="review-title" style={{ marginTop: 4 }}>
        {user?.name || (user?.isOwner ? 'Owner' : 'Staff Member')}
      </h2>
      <p className="review-sub">
        {user?.isOwner ? 'Owner account' : 'Authorised staff'} · {user?.email || 'No email'}
      </p>

      <div className="ship-tabs-bar" role="tablist" aria-label="Account sections" style={{ marginTop: 16, marginBottom: 18 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'profile'}
          className={`ship-tab-btn${tab === 'profile' ? ' active' : ''}`}
          onClick={() => setTab('profile')}
        >
          <User size={14} style={{ display: 'inline', marginRight: 6 }} />
          Account details
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'password'}
          className={`ship-tab-btn${tab === 'password' ? ' active' : ''}`}
          onClick={() => setTab('password')}
        >
          <KeyRound size={14} style={{ display: 'inline', marginRight: 6 }} />
          Password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'report'}
          className={`ship-tab-btn${tab === 'report' ? ' active' : ''}`}
          onClick={() => setTab('report')}
        >
          <FileText size={14} style={{ display: 'inline', marginRight: 6 }} />
          Submit report
        </button>
      </div>

      {tab === 'profile' ? (
        <form onSubmit={handleRequestProfileChange}>
          <div className="req-field">
            <label htmlFor="staff-acct-name">
              <strong>Full name</strong>
            </label>
            <input
              id="staff-acct-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="req-row-2">
            <div className="req-field">
              <label htmlFor="staff-acct-email">
                <strong>Staff email</strong>
              </label>
              <input
                id="staff-acct-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@americanhomes.gh"
              />
            </div>
            <div className="req-field">
              <label htmlFor="staff-acct-role">
                <strong>Role</strong>
              </label>
              <input id="staff-acct-role" value={user?.isOwner ? 'Owner' : 'Authorised staff'} disabled />
            </div>
          </div>

          <div className="req-field">
            <label htmlFor="staff-acct-phone">
              <strong>Phone number</strong>
            </label>
            <input
              id="staff-acct-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233..."
            />
          </div>

          <div className="req-field">
            <label htmlFor="staff-acct-reason">
              <strong>Reason for change (optional)</strong>
            </label>
            <input
              id="staff-acct-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Updated personal phone or display name"
            />
            <small className="acct-hint">
              Profile edits are sent as a change request and take effect immediately once approved
              by an authorised user.
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              loading={submittingChange}
              loadingText="Submitting…"
            >
              Request update
            </Button>
          </div>
        </form>
      ) : tab === 'password' ? (
        <form onSubmit={handleChangePassword}>
          <div className="req-field">
            <label htmlFor="staff-pw-current">
              <strong>Current password</strong>
            </label>
            <input
              id="staff-pw-current"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div className="req-field">
            <label htmlFor="staff-pw-new">
              <strong>New password</strong>
            </label>
            <input
              id="staff-pw-new"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div className="req-field">
            <label htmlFor="staff-pw-confirm">
              <strong>Confirm new password</strong>
            </label>
            <input
              id="staff-pw-confirm"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              loading={savingPassword}
              loadingText="Updating…"
            >
              Update password
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmitReport}>
          <div className="req-field">
            <label htmlFor="staff-report-title">
              <strong>Subject / title</strong>
            </label>
            <input
              id="staff-report-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the report or request"
            />
          </div>

          <div className="req-field">
            <label htmlFor="staff-report-category">
              <strong>Category</strong>
            </label>
            <select
              id="staff-report-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="GENERAL">General</option>
              <option value="OPERATIONS">Operations</option>
              <option value="SAFETY">Safety</option>
              <option value="HR">HR &amp; Workplace</option>
              <option value="SYSTEM">System / Portal</option>
            </select>
          </div>

          <div className="req-field">
            <label htmlFor="staff-report-desc">
              <strong>Details</strong>
            </label>
            <textarea
              id="staff-report-desc"
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, observation, or request clearly..."
            />
          </div>

          <label className="req-checkbox-row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            <div>
              <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <ShieldAlert size={14} /> Submit anonymously
              </strong>
              <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11.5 }}>
                Your name and staff ID will be recorded as Anonymous in the database.
              </small>
            </div>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              loading={submittingReport}
              loadingText="Submitting…"
            >
              Submit report
            </Button>
          </div>
        </form>
      )}
    </StaffModal>
  );
}
