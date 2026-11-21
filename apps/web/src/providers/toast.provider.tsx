'use client';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

const TONE_STYLES: Record<ToastTone, { bg: string; border: string; color: string }> = {
  success: { bg: '#eff8f3', border: '#a6d9be', color: '#14532d' },
  error: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
  info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 380,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const st = TONE_STYLES[t.tone];
          const Icon =
            t.tone === 'success'
              ? CheckCircle2
              : t.tone === 'error'
                ? XCircle
                : t.tone === 'warning'
                  ? AlertTriangle
                  : Info;
          return (
            <div
              key={t.id}
              role="status"
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: st.bg,
                border: `1px solid ${st.border}`,
                color: st.color,
                borderRadius: 0,
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{
                  border: 0,
                  background: 'transparent',
                  color: st.color,
                  cursor: 'pointer',
                  padding: 2,
                  display: 'inline-flex',
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
