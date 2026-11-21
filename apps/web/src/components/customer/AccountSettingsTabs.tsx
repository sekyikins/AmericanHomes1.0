'use client';

import {
  Activity,
  Clock,
  FileText,
  Info,
  LogOut,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`acct-switch ${checked ? 'on' : ''}`}
    >
      <span className="acct-switch-thumb" />
    </button>
  );
}

export function AccountCommunicationsTab({
  whatsappTx,
  setWhatsappTx,
  promos,
  setPromos,
}: {
  whatsappTx: boolean;
  setWhatsappTx: (v: boolean) => void;
  promos: boolean;
  setPromos: (v: boolean) => void;
}) {
  return (
    <div data-node-id="10:62134">
      <div className="acct-pane-head">
        <div>
          <h3>Communication preferences</h3>
          <p>Transactional messages and promotions are controlled separately.</p>
        </div>
      </div>

      <div className="acct-toggle-list">
        <div className="acct-toggle-row">
          <div className="acct-toggle-left">
            <span className="acct-circle-icon">
              <Phone size={16} />
            </span>
            <div>
              <strong>Transactional WhatsApp messages</strong>
              <p>Order, payment, reservation, request and collection updates.</p>
              <small style={{ color: 'var(--green)', fontWeight: 700 }}>
                Recommended for active transactions
              </small>
            </div>
          </div>
          <Toggle checked={whatsappTx} onChange={setWhatsappTx} label="Transactional WhatsApp" />
        </div>

        <div className="acct-toggle-row">
          <div className="acct-toggle-left">
            <span className="acct-circle-icon">
              <Sparkles size={16} />
            </span>
            <div>
              <strong>Promotional announcements</strong>
              <p>New arrivals, special offers and occasional product highlights.</p>
            </div>
          </div>
          <Toggle checked={promos} onChange={setPromos} label="Promotional announcements" />
        </div>
      </div>

      <div className="request-info-banner" style={{ marginBottom: 0 }}>
        <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Your choice is recorded.</strong>
          <span>
            Turning off promotions does not stop essential transactional messages about active orders
            or requests.
          </span>
        </div>
      </div>
    </div>
  );
}

export function AccountNotificationsTab({
  notifOrders,
  setNotifOrders,
  notifReservations,
  setNotifReservations,
  notifRequests,
  setNotifRequests,
}: {
  notifOrders: boolean;
  setNotifOrders: (v: boolean) => void;
  notifReservations: boolean;
  setNotifReservations: (v: boolean) => void;
  notifRequests: boolean;
  setNotifRequests: (v: boolean) => void;
}) {
  return (
    <div data-node-id="10:62779">
      <div className="acct-pane-head">
        <div>
          <h3>In-app notifications</h3>
          <p>Choose the activity you want to see in your notification centre.</p>
        </div>
      </div>

      <div className="acct-toggle-list">
        <div className="acct-toggle-row">
          <div className="acct-toggle-left">
            <span className="acct-circle-icon">
              <ShoppingBag size={16} />
            </span>
            <div>
              <strong>Orders and payments</strong>
              <p>Payment verification, order status and collection readiness.</p>
            </div>
          </div>
          <Toggle checked={notifOrders} onChange={setNotifOrders} label="Orders and payments" />
        </div>

        <div className="acct-toggle-row">
          <div className="acct-toggle-left">
            <span className="acct-circle-icon">
              <Clock size={16} />
            </span>
            <div>
              <strong>Reservations</strong>
              <p>Approval decisions, payment deadlines and expiry reminders.</p>
            </div>
          </div>
          <Toggle checked={notifReservations} onChange={setNotifReservations} label="Reservations" />
        </div>

        <div className="acct-toggle-row">
          <div className="acct-toggle-left">
            <span className="acct-circle-icon">
              <FileText size={16} />
            </span>
            <div>
              <strong>Product Requests</strong>
              <p>Review outcomes, sourcing progress and allocation offers.</p>
            </div>
          </div>
          <Toggle checked={notifRequests} onChange={setNotifRequests} label="Product Requests" />
        </div>
      </div>

      <div className="request-info-banner" style={{ marginBottom: 0 }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          AmericanHomes sends only important shipment milestones—not routine in-transit updates.
        </span>
      </div>
    </div>
  );
}

export function AccountSecurityTab({
  displayPhone,
  showOtherDevices,
  setShowOtherDevices,
  revokingOthers,
  onRevokeOtherSessions,
}: {
  displayPhone: string;
  showOtherDevices: boolean;
  setShowOtherDevices: React.Dispatch<React.SetStateAction<boolean>>;
  revokingOthers: boolean;
  onRevokeOtherSessions: () => void;
}) {
  return (
    <div data-node-id="10:64099">
      <div className="acct-pane-head">
        <div>
          <h3>Sign-in and security</h3>
          <p>Your account uses phone-number-based one-time codes.</p>
        </div>
      </div>

      <div className="acct-toggle-list">
        <div className="acct-toggle-row">
          <div className="acct-toggle-left">
            <span className="acct-circle-icon">
              <Phone size={16} />
            </span>
            <div>
              <strong>Phone OTP authentication</strong>
              <p>Verified number ending in {displayPhone.slice(-4)}</p>
            </div>
          </div>
          <span className="bag-stock-pill" style={{ marginTop: 0 }}>
            ● Active
          </span>
        </div>

        <div className="acct-toggle-row">
          <div className="acct-toggle-left">
            <span className="acct-circle-icon">
              <Activity size={16} />
            </span>
            <div>
              <strong>Current session</strong>
              <p>Active on this browser</p>
            </div>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => setShowOtherDevices((prev) => !prev)}
            aria-expanded={showOtherDevices}
          >
            {showOtherDevices ? 'Hide devices' : 'Other devices'}
          </button>
        </div>

        {showOtherDevices && (
          <div
            style={{
              padding: '12px 14px',
              marginTop: 8,
              border: '0.8px solid var(--line)',
              background: 'var(--paper)',
              fontSize: 12.5,
              color: 'var(--muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span>No other active devices signed into this account.</span>
          </div>
        )}

        <div className="acct-toggle-row">
          <div className="acct-toggle-left">
            <span className="acct-circle-icon">
              <Clock size={16} />
            </span>
            <div>
              <strong>Last successful sign-in</strong>
              <p>Active customer session</p>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="button"
        style={{ marginTop: 18 }}
        disabled={revokingOthers}
        onClick={onRevokeOtherSessions}
      >
        <LogOut size={15} />
        <span>{revokingOthers ? 'Signing out…' : 'Sign out of all other sessions'}</span>
      </button>
    </div>
  );
}
