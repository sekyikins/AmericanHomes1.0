'use client';

import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Info,
  LogOut,
  Phone,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AccountCommunicationsTab,
  AccountNotificationsTab,
  AccountSecurityTab,
} from '@/components/customer/AccountSettingsTabs';
import { ConfirmDialog } from '@/components/ui';
import { authApi, usersApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';

type SettingsTab = 'profile' | 'communications' | 'notifications' | 'security';

const TABS: { id: SettingsTab; label: string; Icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', Icon: User },
  { id: 'communications', label: 'Communications', Icon: Phone },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'security', label: 'Security', Icon: Shield },
];

export function AccountSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user, setAuth, clearAuth, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const [whatsappTx, setWhatsappTx] = useState(true);
  const [promos, setPromos] = useState(false);

  const [notifOrders, setNotifOrders] = useState(true);
  const [notifReservations, setNotifReservations] = useState(true);
  const [notifRequests, setNotifRequests] = useState(true);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [showOtherDevices, setShowOtherDevices] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    const parts = (user.name ?? '').trim().split(/\s+/).filter(Boolean);
    setFirstName(parts[0] ?? '');
    setLastName(parts.slice(1).join(' '));
    setEmail(user.email ?? '');
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmSignOut) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, confirmSignOut, onClose]);

  if (!open) return null;

  const displayPhone = user?.phone ?? '—';

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      await usersApi.updateMe({
        ...(fullName ? { name: fullName } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      await refreshAuth();
      setSaved(true);
      showToast('Account settings saved', 'success');
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (revokingOthers) return;
    setRevokingOthers(true);
    try {
      const res = await authApi.revokeOtherSessions();
      if (res.token && user) {
        setAuth(user, res.token);
      }
      showToast('Signed out of all other sessions. Your current session remains active.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to sign out of other sessions.',
        'error',
      );
    } finally {
      setRevokingOthers(false);
    }
  };

  const handleConfirmSignOut = () => {
    clearAuth();
    setConfirmSignOut(false);
    onClose();
    showToast('Signed out of your account', 'info');
    router.push('/');
  };

  return (
    <div
      className="login-backdrop acct-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Account settings"
      onClick={onClose}
    >
      <div className="acct-modal" data-node-id="11:64553" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="login-close"
          onClick={onClose}
          aria-label="Close account settings"
        >
          <X size={17} strokeWidth={2} />
        </button>

        <div className="acct-modal-head">
          <div className="eyebrow">My AmericanHomes</div>
          <h2>Account settings</h2>
          <p>Manage your personal details, communication consent and security preferences.</p>
        </div>

        <div className="acct-modal-body">
          <div className="acct-modal-nav" role="tablist" aria-label="Settings sections">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => {
                  setActiveTab(id);
                  setSaved(false);
                }}
                className={`acct-nav-btn ${activeTab === id ? 'active' : ''}`}
              >
                <span className="acct-nav-left">
                  <Icon size={16} />
                  <span>{label}</span>
                </span>
                <ChevronRight size={14} color="var(--muted)" />
              </button>
            ))}
          </div>

          <section className="acct-modal-pane">
            {activeTab === 'profile' && (
              <div data-node-id="11:64553">
                <div className="acct-pane-head">
                  <div>
                    <h3>Personal profile</h3>
                    <p>Keep your collection and contact information current.</p>
                  </div>
                  <span className="acct-avatar">
                    {(firstName[0] ?? 'C').toUpperCase()}
                    {(lastName[0] ?? '').toUpperCase()}
                  </span>
                </div>

                <div className="req-row-2" style={{ marginTop: 20 }}>
                  <div className="req-field">
                    <label htmlFor="acct-first">
                      <strong>First name</strong>
                    </label>
                    <input
                      id="acct-first"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="req-field">
                    <label htmlFor="acct-last">
                      <strong>Last name</strong>
                    </label>
                    <input
                      id="acct-last"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="req-field">
                  <label>
                    <strong>Phone number</strong>
                  </label>
                  <div className="acct-verified-phone">
                    <span>{displayPhone}</span>
                    <span className="acct-verified-tag">
                      <CheckCircle2 size={14} /> Verified
                    </span>
                  </div>
                  <small className="acct-hint">
                    Your verified phone number is used to sign in and receive transactional updates.
                  </small>
                </div>

                <div className="req-field">
                  <label htmlFor="acct-email">
                    <strong>Email address</strong>
                    <small>Optional</small>
                  </label>
                  <input
                    id="acct-email"
                    type="email"
                    value={email}
                    placeholder="Add email address"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="request-info-banner" style={{ marginBottom: 0 }}>
                  <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    To change your verified phone number, contact AmericanHomes support for identity
                    verification.
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'communications' && (
              <AccountCommunicationsTab
                whatsappTx={whatsappTx}
                setWhatsappTx={setWhatsappTx}
                promos={promos}
                setPromos={setPromos}
              />
            )}

            {activeTab === 'notifications' && (
              <AccountNotificationsTab
                notifOrders={notifOrders}
                setNotifOrders={setNotifOrders}
                notifReservations={notifReservations}
                setNotifReservations={setNotifReservations}
                notifRequests={notifRequests}
                setNotifRequests={setNotifRequests}
              />
            )}

            {activeTab === 'security' && (
              <AccountSecurityTab
                displayPhone={displayPhone}
                showOtherDevices={showOtherDevices}
                setShowOtherDevices={setShowOtherDevices}
                revokingOthers={revokingOthers}
                onRevokeOtherSessions={handleRevokeOtherSessions}
              />
            )}

            <div className="acct-modal-footer">
              <div className="acct-modal-footer-left">
                <button
                  type="button"
                  className="button acct-signout-btn"
                  onClick={() => setConfirmSignOut(true)}
                >
                  <LogOut size={15} />
                  <span>Sign out</span>
                </button>
                {saved && (
                  <span className="acct-saved-msg">
                    <CheckCircle2 size={14} /> Changes saved
                  </span>
                )}
              </div>
              <div className="acct-modal-footer-actions">
                <button type="button" className="button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out of your account?"
        description="You will be signed out of your customer session on this browser."
        reversible={true}
        confirmLabel="Sign out"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={handleConfirmSignOut}
      />
    </div>
  );
}
