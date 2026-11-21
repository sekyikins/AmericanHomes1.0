'use client';

import {
  SETTINGS_DEFAULTS,
  SETTINGS_SECTIONS,
  type SettingsTab,
} from '@/components/staff/settingsConfig';
import { StaffModal } from '@/components/staff/StaffModal';
import { Button, ListInputField, SettingsSkeleton } from '@/components/ui';
import { governanceApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';
import {
  ArrowRight,
  Bell,
  ChevronRight,
  Clock,
  CreditCard,
  PackageCheck,
  Receipt,
  Shield,
  Store,
  Truck,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

const SECTION_ICONS: Record<SettingsTab, typeof Store> = {
  business: Store,
  shipping: Truck,
  finance: Receipt,
  operations: Clock,
  collections: PackageCheck,
  payments: CreditCard,
  notifications: Bell,
  security: Shield,
};

export default function StaffSettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<string, string>>(SETTINGS_DEFAULTS);
  const [savedValues, setSavedValues] = useState<Record<string, string>>(SETTINGS_DEFAULTS);
  const [modalTab, setModalTab] = useState<SettingsTab | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    governanceApi
      .listSettings()
      .then((rows) => {
        const next = { ...SETTINGS_DEFAULTS };
        for (const r of (Array.isArray(rows) ? rows : []) as Array<{ key: string; value: string }>) {
          if (r.key in next || r.key) next[r.key] = r.value;
        }
        setValues(next);
        setSavedValues(next);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeSection = SETTINGS_SECTIONS.find((s) => s.id === modalTab) ?? null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeSection) return;
    if (!user?.isOwner) {
      showToast('Only the Owner can modify system settings', 'warning');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const pairs = activeSection.fields.map((f) => {
        const raw = (values[f.key] ?? '').trim();
        const normalized =
          f.type === 'list'
            ? raw.split(',').map((s) => s.trim()).filter(Boolean).join(', ')
            : raw;
        return [f.key, normalized] as const;
      });
      await Promise.all(pairs.map(([k, v]) => governanceApi.updateSetting(k, v)));
      setSavedValues((prev) => {
        const next = { ...prev };
        for (const [k, v] of pairs) next[k] = v;
        return next;
      });
      setModalTab(null);
      showToast('System settings saved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save system settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-node-id="5:17249">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            System settings
          </h1>
          <p className="dash-sub">
            Business, shipping, currency &amp; tax, operational windows, collections, payments,
            notifications and security configuration.
          </p>
        </div>
        <span className={`acct-pill ${user?.isOwner ? 'green' : 'blue'}`}>
          ● {user?.isOwner ? 'Owner access' : 'Read-only (Owner required)'}
        </span>
      </div>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <div className="settings-grid">
          {SETTINGS_SECTIONS.map((sec) => {
            const Icon = SECTION_ICONS[sec.id];
            return (
              <button
                key={sec.id}
                type="button"
                className="settings-card"
                onClick={() => setModalTab(sec.id)}
              >
                <span className="category-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <div className="settings-card-body">
                  <strong>{sec.title}</strong>
                  <span className="settings-card-val">{sec.summary(values)}</span>
                  <p>{sec.description}</p>
                </div>
                <ChevronRight size={15} color="var(--muted)" />
              </button>
            );
          })}
        </div>
      )}

      <StaffModal
        open={Boolean(activeSection)}
        label={activeSection?.title ?? 'Edit system setting'}
        onClose={() => setModalTab(null)}
      >
        {activeSection && (
          <>
            <div className="ship-eyebrow">SYSTEM SETTINGS</div>
            <h2 style={{ marginTop: 6 }}>{activeSection.title}</h2>
            <form onSubmit={handleSave}>
              {activeSection.fields.map((field) => (
                <div key={field.key} className="login-field">
                  <span>{field.label}</span>
                  {field.type === 'list' ? (
                    <ListInputField
                      value={values[field.key] ?? ''}
                      savedValue={savedValues[field.key] ?? ''}
                      placeholder={field.placeholder}
                      disabled={!user?.isOwner}
                      onChange={(next) =>
                        setValues((prev) => ({ ...prev, [field.key]: next }))
                      }
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="staff-field-select"
                      value={values[field.key] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    >
                      {(field.options ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={values[field.key] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      style={{
                        width: '100%',
                        border: '0.8px solid var(--line)',
                        padding: 10,
                        fontSize: 13,
                      }}
                    />
                  ) : (
                    <input
                      type={field.type ?? 'text'}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={values[field.key] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}

              {activeSection.banner && (
                <div className="request-info-banner" style={{ marginTop: 8 }}>
                  <Shield size={15} style={{ flexShrink: 0 }} />
                  <span>{activeSection.banner}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="button"
                  style={{ background: '#fff' }}
                  onClick={() => setModalTab(null)}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={saving}
                  loadingText="Saving…"
                  disabled={!user?.isOwner}
                >
                  <span>Save changes</span>
                  <ArrowRight size={15} />
                </Button>
              </div>
            </form>
          </>
        )}
      </StaffModal>
    </div>
  );
}
