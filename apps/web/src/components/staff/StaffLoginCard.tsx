'use client';

import { ArrowRight, Eye, EyeOff, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { authApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';

export function StaffLoginCard({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const { setAuth } = useAuth();
  const { showToast } = useToast();
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [staffMfaCode, setStaffMfaCode] = useState('');
  const [staffError, setStaffError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStaffLogin = async (e: FormEvent) => {
    e.preventDefault();
    setStaffError('');
    if (submitting || !staffEmail.trim() || !staffPassword) return;
    setSubmitting(true);
    try {
      const res = await authApi.staffLogin(
        staffEmail.trim(),
        staffPassword,
        staffMfaCode.trim() || undefined,
      );
      let permissions: string[] = [];
      let restrictFinancials = false;
      let resolvedName = res.name || staffEmail.trim();
      let resolvedEmail = res.email || staffEmail.trim();
      let resolvedPhone = res.phone || '';
      setAuth(
        {
          id: res.userId,
          phone: resolvedPhone,
          name: resolvedName,
          email: resolvedEmail,
          role: 'STAFF',
          isOwner: res.isOwner,
        },
        res.token,
      );
      try {
        const me = await authApi.me();
        permissions = me.user.permissions ?? [];
        restrictFinancials = Boolean(me.user.restrictFinancials);
        if (me.user.name) resolvedName = me.user.name;
        if (me.user.email) resolvedEmail = me.user.email;
        if (me.user.phone) resolvedPhone = me.user.phone;
      } catch {
        // Keep base staff session if me() fails momentarily
      }
      setAuth(
        {
          id: res.userId,
          phone: resolvedPhone,
          name: resolvedName,
          email: resolvedEmail,
          role: 'STAFF',
          isOwner: res.isOwner,
          restrictFinancials,
          permissions,
        },
        res.token,
      );
      showToast(`Welcome, ${resolvedName}`, 'success');
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/staff/dashboard');
      }
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'Invalid email, password, or MFA code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-card" data-node-id="1:1352">
      <div className="login-inner">
        <div className="brand" style={{ marginBottom: 44 }}>
          <span className="brand-mark" aria-hidden="true" style={{ overflow: 'hidden', padding: 0 }}>
            <img
              src="/images/americanhomes-emblem.png"
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </span>
          <span>
            American<span style={{ color: 'var(--green)' }}>Homes</span>
          </span>
        </div>

        <div className="eyebrow">Staff &amp; Owner Portal</div>
        <h1 className="login-title">Sign in with staff email</h1>
        <p className="login-subtitle">
          Use your registered staff or owner email and password.
        </p>
        <form onSubmit={handleStaffLogin} className="login-form">
          <label className="login-label" htmlFor="staff-email-input">
            Staff email
          </label>
          <input
            id="staff-email-input"
            type="email"
            className="login-phone-input"
            value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value)}
            placeholder="owner@americanhomes.gh"
            required
            style={{ width: '100%', marginBottom: 14 }}
          />

          <label className="login-label" htmlFor="staff-password-input">
            Password
          </label>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input
              id="staff-password-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="login-phone-input"
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{ width: '100%', paddingRight: 42 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 0,
                background: 'transparent',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <label className="login-label" htmlFor="staff-mfa-input">
            MFA code (if enabled)
          </label>
          <input
            id="staff-mfa-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            className="login-phone-input"
            value={staffMfaCode}
            onChange={(e) => setStaffMfaCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6-digit authenticator code"
            style={{ width: '100%', marginBottom: 18 }}
          />

          {staffError && (
            <div role="alert" style={{ color: '#b42318', fontSize: 12, marginBottom: 12 }}>
              {staffError}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="login-submit"
            loading={submitting}
            loadingText="Signing in…"
            disabled={!staffEmail.trim() || !staffPassword}
          >
            <span>Sign in to Staff Portal</span>
            <ArrowRight size={16} strokeWidth={2.2} />
          </Button>
        </form>
      </div>
    </div>
  );
}
