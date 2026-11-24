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
import { useEffect, useRef, useState } from 'react';
import {
  AccountCommunicationsTab,
  AccountNotificationsTab,
  AccountSecurityTab,
} from '@/components/customer/AccountSettingsTabs';
import { Button, ConfirmDialog } from '@/components/ui';
import { authApi, usersApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';

type SettingsTab = 'profile' | 'communications' | 'notifications' | 'security';

const SETTINGS_TAB_STORAGE_KEY = 'ah_acct_settings_active_tab';
const SETTINGS_DRAFT_STORAGE_KEY = 'ah_acct_settings_draft';

const TABS: { id: SettingsTab; label: string; Icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', Icon: User },
  { id: 'communications', label: 'Communications', Icon: Phone },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'security', label: 'Security', Icon: Shield },
];

function isValidSettingsTab(val: unknown): val is SettingsTab {
  return (
    val === 'profile' ||
    val === 'communications' ||
    val === 'notifications' ||
    val === 'security'
  );
}

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
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.sessionStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
      if (isValidSettingsTab(stored)) return stored;
    }
    return 'profile';
  });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [hasUnsavedProfileEdits, setHasUnsavedProfileEdits] = useState(false);

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

  const tabListRef = useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = useRef<Record<SettingsTab, HTMLButtonElement | null>>({
    profile: null,
    communications: null,
    notifications: null,
    security: null,
  });
  const initializedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(SETTINGS_DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          userId?: string;
          activeTab?: SettingsTab;
          firstName?: string;
          lastName?: string;
          email?: string;
          hasUnsavedProfileEdits?: boolean;
          whatsappTx?: boolean;
          promos?: boolean;
          notifOrders?: boolean;
          notifReservations?: boolean;
          notifRequests?: boolean;
        };
        if (isValidSettingsTab(parsed.activeTab)) {
          setActiveTab(parsed.activeTab);
        }
        if (parsed.hasUnsavedProfileEdits && (!user?.id || parsed.userId === user.id)) {
          setFirstName(parsed.firstName ?? '');
          setLastName(parsed.lastName ?? '');
          setEmail(parsed.email ?? '');
          setHasUnsavedProfileEdits(true);
          if (user?.id) initializedUserIdRef.current = user.id;
        }
        if (typeof parsed.whatsappTx === 'boolean') setWhatsappTx(parsed.whatsappTx);
        if (typeof parsed.promos === 'boolean') setPromos(parsed.promos);
        if (typeof parsed.notifOrders === 'boolean') setNotifOrders(parsed.notifOrders);
        if (typeof parsed.notifReservations === 'boolean') setNotifReservations(parsed.notifReservations);
        if (typeof parsed.notifRequests === 'boolean') setNotifRequests(parsed.notifRequests);
      }
    } catch {
      // ignore storage errors
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (hasUnsavedProfileEdits && initializedUserIdRef.current === user.id) return;
    initializedUserIdRef.current = user.id;
    const parts = (user.name ?? '').trim().split(/\s+/).filter(Boolean);
    setFirstName(parts[0] ?? '');
    setLastName(parts.slice(1).join(' '));
    setEmail(user.email ?? '');
  }, [user, hasUnsavedProfileEdits]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(SETTINGS_TAB_STORAGE_KEY, activeTab);
      window.sessionStorage.setItem(
        SETTINGS_DRAFT_STORAGE_KEY,
        JSON.stringify({
          userId: user?.id,
          activeTab,
          firstName,
          lastName,
          email,
          hasUnsavedProfileEdits,
          whatsappTx,
          promos,
          notifOrders,
          notifReservations,
          notifRequests,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [
    user?.id,
    activeTab,
    firstName,
    lastName,
    email,
    hasUnsavedProfileEdits,
    whatsappTx,
    promos,
    notifOrders,
    notifReservations,
    notifRequests,
  ]);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      const btn = tabButtonRefs.current[activeTab];
      const container = tabListRef.current;
      if (btn && container) {
        const targetLeft =
          btn.offsetLeft - container.clientWidth / 2 + btn.clientWidth / 2;
        container.scrollTo({
          left: Math.max(0, targetLeft),
          behavior: 'smooth',
        });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, activeTab]);

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
      setHasUnsavedProfileEdits(false);
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
          <div
            ref={tabListRef}
            className="acct-modal-nav"
            role="tablist"
            aria-label="Settings sections"
          >
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                ref={(el) => {
                  tabButtonRefs.current[id] = el;
                }}
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

                <div className="req-row-2 acct-name-grid" style={{ marginTop: 16 }}>
                  <div className="req-field">
                    <label htmlFor="acct-first">
                      <strong>First name</strong>
                    </label>
                    <input
                      id="acct-first"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setHasUnsavedProfileEdits(true);
                      }}
                    />
                  </div>
                  <div className="req-field">
                    <label htmlFor="acct-last">
                      <strong>Last name</strong>
                    </label>
                    <input
                      id="acct-last"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setHasUnsavedProfileEdits(true);
                      }}
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
                    Used for sign-in and transactional updates. Contact support to change your verified
                    number.
                  </small>
                </div>

                <div className="req-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="acct-email">
                    <strong>Email address</strong>
                    <small>Optional</small>
                  </label>
                  <input
                    id="acct-email"
                    type="email"
                    value={email}
                    placeholder="Add email address"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setHasUnsavedProfileEdits(true);
                    }}
                  />
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
                  disabled={saving}
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
                <button type="button" className="button" disabled={saving} onClick={onClose}>
                  Cancel
                </button>
                <Button
                  type="button"
                  variant="primary"
                  loading={saving}
                  loadingText="Saving…"
                  onClick={handleSave}
                >
                  Save changes
                </Button>
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
