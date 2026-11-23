'use client';

import { ArrowLeft, ArrowRight, Home, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { authApi, notificationsApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';

const COUNTRY_CODES = [
  { flag: '🇬🇭', code: '+233' },
  { flag: '🇺🇸', code: '+1' },
  { flag: '🇬🇧', code: '+44' },
  { flag: '🇳🇬', code: '+234' },
];

export function LoginCard({
  onClose,
  onSuccess,
  initialStep = 'phone',
}: {
  onClose?: () => void;
  onSuccess?: () => void;
  initialStep?: 'phone' | 'otp';
}) {
  const router = useRouter();
  const { setAuth, postLoginRedirect, setPostLoginRedirect } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<'phone' | 'otp'>(initialStep);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [countryIndex, setCountryIndex] = useState(0);
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selected = COUNTRY_CODES[countryIndex];
  const [storedPhone, setStoredPhone] = useState<string | null>(null);
  const TitleTag = onClose ? 'h2' : 'h1';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = sessionStorage.getItem('ah_otp_phone');
    if (saved) {
      setStoredPhone(saved);
    } else if (initialStep === 'otp' && !phone.trim()) {
      setStep('phone');
    }
  }, [initialStep, phone]);

  const cleanDigits = phone.replace(/\D/g, '').replace(/^0+/, '');
  const fullPhone = cleanDigits
    ? `${selected.code}${cleanDigits}`
    : storedPhone || `${selected.code}245550198`;

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAccountNotFound(false);
    if (submitting || !cleanDigits) return;
    if (authMode === 'signup' && !fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    const targetPhone = `${selected.code}${cleanDigits}`;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ah_otp_phone', targetPhone);
      setStoredPhone(targetPhone);
    }
    setSubmitting(true);
    try {
      const res = await authApi.requestOtp(targetPhone, authMode);
      if (authMode === 'signin' && res.accountExists === false) {
        setAccountNotFound(true);
        return;
      }
      setStep('otp');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to send verification code. Please check your phone number.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (submitting || otp.trim().length < 4) return;
    setSubmitting(true);
    try {
      const res = await authApi.verifyOtp(fullPhone, otp.trim(), {
        mode: authMode,
        ...(authMode === 'signup'
          ? {
              name: fullName.trim() || undefined,
              email: email.trim() || undefined,
              whatsappOptIn,
            }
          : {}),
      });
      if (!res.verified || !res.token) {
        setFormError('Invalid verification code. Please check and try again.');
        return;
      }
      setAuth(
        {
          id: res.userId ?? fullPhone,
          phone: res.phone ?? fullPhone,
          name: res.name ?? (fullName.trim() || 'Customer'),
          email: res.email ?? (email.trim() || null),
          role: 'CUSTOMER',
        },
        res.token,
      );
      if (authMode === 'signup' && whatsappOptIn) {
        notificationsApi.recordWhatsAppConsent(true, 'CUSTOMER_SIGNUP').catch(() => {});
      }
      showToast(
        authMode === 'signup' ? 'Account created and signed in' : 'Signed in successfully',
        'success',
      );
      const targetRedirect = postLoginRedirect;
      if (targetRedirect) {
        setPostLoginRedirect(null);
        onClose?.();
        router.push(targetRedirect);
      } else if (onSuccess) {
        onSuccess();
      } else {
        router.push('/account');
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Verification failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-card" data-node-id="1:1352" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button
          type="button"
          className="login-close"
          onClick={onClose}
          aria-label="Close sign in dialog"
        >
          <X size={17} strokeWidth={2} />
        </button>
      )}

      <div className="login-inner">
        <Link className="brand" href="/" onClick={onClose} style={{ marginBottom: 44 }}>
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
        </Link>

        {step === 'phone' ? (
          <>
            <div className="eyebrow">
              {authMode === 'signup' ? 'Create an account' : 'Welcome to AmericanHomes'}
            </div>
            <TitleTag id="login-modal-title" className="login-title">
              {authMode === 'signup' ? 'Sign up with your phone' : 'Sign in with your phone'}
            </TitleTag>
            <p className="login-subtitle">
              {authMode === 'signup'
                ? 'Create your customer account to track orders, reservations, and requests.'
                : 'Browse freely. Sign in only when you’re ready to transact.'}
            </p>

            <form onSubmit={handleSendCode} className="login-form">
              {authMode === 'signup' && (
                <>
                  <label className="login-label" htmlFor="signup-name-input">
                    Full name
                  </label>
                  <input
                    id="signup-name-input"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ama Mensah"
                    className="login-phone-input"
                    style={{ width: '100%', marginBottom: 14 }}
                  />

                  <label className="login-label" htmlFor="signup-email-input">
                    Email address (optional)
                  </label>
                  <input
                    id="signup-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ama@example.com"
                    className="login-phone-input"
                    style={{ width: '100%', marginBottom: 14 }}
                  />
                </>
              )}

              <label className="login-label" htmlFor="login-phone-input">
                Phone number
              </label>
              <div className="login-phone-group">
                <select
                  aria-label="Country code"
                  className="login-country-btn"
                  value={countryIndex}
                  onChange={(e) => {
                    setCountryIndex(Number(e.target.value));
                    setAccountNotFound(false);
                  }}
                >
                  {COUNTRY_CODES.map((c, idx) => (
                    <option key={c.code} value={idx}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  id="login-phone-input"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (accountNotFound) setAccountNotFound(false);
                    if (formError) setFormError(null);
                  }}
                  placeholder="24 555 0198"
                  className="login-phone-input"
                />
              </div>

              {authMode === 'signup' && (
                <label className="req-checkbox-row" style={{ marginTop: 14, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={whatsappOptIn}
                    onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  />
                  <span>Opt in to WhatsApp notifications for order &amp; collection updates</span>
                </label>
              )}

              {accountNotFound && (
                <div
                  role="alert"
                  style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    border: '1px solid #f59e0b',
                    background: '#fffbeb',
                    color: '#92400e',
                    fontSize: 12.5,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <span>
                    No account found for <strong>{fullPhone}</strong>. Sign up with this number, or
                    go back and check your phone number.
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="button primary"
                      style={{ minHeight: 34, fontSize: 12, padding: '0 12px' }}
                      onClick={() => {
                        setAccountNotFound(false);
                        setFormError(null);
                        setAuthMode('signup');
                      }}
                    >
                      Sign up with this number
                    </button>
                    <button
                      type="button"
                      className="button"
                      style={{ minHeight: 34, fontSize: 12, padding: '0 12px', background: '#fff' }}
                      onClick={() => {
                        setAccountNotFound(false);
                        document.getElementById('login-phone-input')?.focus();
                      }}
                    >
                      Change number
                    </button>
                  </div>
                </div>
              )}

              {formError && (
                <div
                  role="alert"
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    border: '1px solid #f0c2bd',
                    background: '#fdf3f2',
                    color: '#b42318',
                    fontSize: 12.5,
                  }}
                >
                  {formError}
                </div>
              )}

              <button
                type="submit"
                className="button primary login-submit"
                disabled={submitting}
                aria-busy={submitting || undefined}
              >
                <span>
                  {submitting
                    ? 'Sending code…'
                    : authMode === 'signup'
                      ? 'Continue & send code'
                      : 'Send verification code'}
                </span>
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>
            </form>

            <div
              style={{
                marginTop: 14,
                textAlign: 'center',
                fontSize: 12.5,
                color: 'var(--muted)',
              }}
            >
              {authMode === 'signin' ? (
                <>
                  New to AmericanHomes?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setAccountNotFound(false);
                      setFormError(null);
                    }}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: 'var(--green)',
                      fontWeight: 700,
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setAccountNotFound(false);
                      setFormError(null);
                    }}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: 'var(--green)',
                      fontWeight: 700,
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>

            <div className="login-notice">A 6-digit verification code will be sent via SMS.</div>
          </>
        ) : step === 'otp' ? (
          <>
            <div className="eyebrow">Verify your phone</div>
            <TitleTag className="login-title">Enter verification code</TitleTag>
            <p className="login-subtitle">
              We sent a 6-digit code to <strong style={{ color: 'var(--ink)' }}>{fullPhone}</strong>.{' '}
              <button
                type="button"
                onClick={() => {
                  setOtp('');
                  setStep('phone');
                }}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--green)',
                  fontWeight: 700,
                  padding: 0,
                  fontSize: 12,
                }}
              >
                Change
              </button>
            </p>

            <form onSubmit={handleVerifyOtp} className="login-form">
              <label className="login-label" htmlFor="login-otp-input">
                One-time code
              </label>
              <input
                id="login-otp-input"
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="login-phone-input"
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: 20,
                  letterSpacing: 8,
                  marginBottom: 18,
                }}
              />

              {formError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 14,
                    padding: '10px 12px',
                    border: '1px solid #f0c2bd',
                    background: '#fdf3f2',
                    color: '#b42318',
                    fontSize: 12.5,
                  }}
                >
                  {formError}
                </div>
              )}

              <button
                type="submit"
                className="button primary login-submit"
                disabled={submitting}
                aria-busy={submitting || undefined}
              >
                <span>{submitting ? 'Verifying…' : 'Verify & sign in'}</span>
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>

              <button
                type="button"
                onClick={() => setStep('phone')}
                style={{
                  marginTop: 12,
                  width: '100%',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--muted)',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <ArrowLeft size={13} /> Back to phone number
              </button>
            </form>

            <div className="login-notice">
              Enter the 6-digit verification code sent to your phone via SMS.
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      data-node-id="1:1351"
      onClick={onClose}
    >
      <LoginCard onClose={onClose} onSuccess={onClose} />
    </div>
  );
}
