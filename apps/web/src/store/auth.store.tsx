'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/lib/api';
import {
  clearSession,
  clearStaffSession,
  getSession,
  getStaffSession,
  setSession,
  setStaffSession,
} from '@/lib/auth/session';
import { useToast } from '@/providers/toast.provider';

export type AuthUser = {
  id: string;
  phone: string;
  name?: string;
  email?: string | null;
  role?: 'CUSTOMER' | 'STAFF';
  isOwner?: boolean;
  restrictFinancials?: boolean;
  permissions?: string[];
};

type AuthStore = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  loginOpen: boolean;
  setLoginOpen: (open: boolean) => void;
  postLoginRedirect: string | null;
  setPostLoginRedirect: (path: string | null) => void;
  setAuth: (user: AuthUser, token: string) => void;
  refreshAuth: () => Promise<void>;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthStore>({
  user: null,
  token: null,
  loading: true,
  loginOpen: false,
  setLoginOpen: () => {},
  postLoginRedirect: null,
  setPostLoginRedirect: () => {},
  setAuth: () => {},
  refreshAuth: async () => {},
  clearAuth: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStaff = pathname?.startsWith('/staff') ?? false;
  const { showToast } = useToast();

  const [customerUser, setCustomerUser] = useState<AuthUser | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [staffUser, setStaffUser] = useState<AuthUser | null>(null);
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [postLoginRedirect, setPostLoginRedirect] = useState<string | null>(null);

  const clearCustomerAuth = useCallback(() => {
    setCustomerUser(null);
    setCustomerToken(null);
    clearSession();
  }, []);

  const clearStaffAuth = useCallback(() => {
    setStaffUser(null);
    setStaffToken(null);
    clearStaffSession();
  }, []);

  const clearAuth = useCallback(() => {
    if (isStaff) {
      clearStaffAuth();
    } else {
      clearCustomerAuth();
    }
  }, [isStaff, clearCustomerAuth, clearStaffAuth]);

  useEffect(() => {
    let active = true;
    const existing = isStaff ? getStaffSession() : getSession();
    if (!existing) {
      if (isStaff) {
        setStaffUser(null);
        setStaffToken(null);
      } else {
        setCustomerUser(null);
        setCustomerToken(null);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    if (isStaff) {
      setStaffToken(existing.token);
    } else {
      setCustomerToken(existing.token);
    }

    authApi
      .me()
      .then((res) => {
        if (!active) return;
        const u = res.user as AuthUser;
        // Enforce strict portal separation even if a token was tampered with
        if (isStaff && u.role !== 'STAFF') {
          clearStaffAuth();
          return;
        }
        if (!isStaff && u.role === 'STAFF') {
          clearCustomerAuth();
          return;
        }
        const hydrated: AuthUser = {
          id: u.id,
          phone: u.phone ?? existing.meta?.phone ?? '',
          name: u.name ?? existing.meta?.name,
          email: u.email ?? null,
          role: u.role,
          isOwner: u.isOwner,
          restrictFinancials: u.restrictFinancials,
          permissions: u.permissions,
        };
        if (isStaff) {
          setStaffUser(hydrated);
          setStaffSession(existing.token, { name: hydrated.name, phone: hydrated.phone });
        } else {
          setCustomerUser(hydrated);
          setSession(existing.token, { name: hydrated.name, phone: hydrated.phone });
        }
      })
      .catch((err: { status?: number }) => {
        if (!active) return;
        if (err?.status === 401) {
          if (isStaff) clearStaffAuth();
          else clearCustomerAuth();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isStaff, clearCustomerAuth, clearStaffAuth]);

  useEffect(() => {
    const handleExpired = () => {
      clearAuth();
      showToast('Your session has expired. Please sign in again.', 'warning');
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/staff')) {
        window.location.href = '/staff/login';
      } else {
        setLoginOpen(true);
      }
    };
    window.addEventListener('ah:session-expired', handleExpired);
    return () => window.removeEventListener('ah:session-expired', handleExpired);
  }, [clearAuth, showToast]);

  const setAuth = (nextUser: AuthUser, nextToken: string) => {
    if (nextUser.role === 'STAFF') {
      setStaffUser(nextUser);
      setStaffToken(nextToken);
      setStaffSession(nextToken, { name: nextUser.name, phone: nextUser.phone });
    } else {
      const customerRecord: AuthUser = { ...nextUser, role: 'CUSTOMER' };
      setCustomerUser(customerRecord);
      setCustomerToken(nextToken);
      setSession(nextToken, { name: customerRecord.name, phone: customerRecord.phone });
    }
  };

  const refreshAuth = useCallback(async () => {
    const existing = isStaff ? getStaffSession() : getSession();
    if (!existing) return;
    const res = await authApi.me();
    const u = res.user;
    const hydrated: AuthUser = {
      id: u.id,
      phone: u.phone ?? existing.meta?.phone ?? '',
      name: u.name ?? existing.meta?.name,
      email: u.email ?? null,
      role: u.role,
      isOwner: u.isOwner,
      restrictFinancials: u.restrictFinancials,
      permissions: u.permissions,
    };
    if (isStaff) {
      setStaffUser(hydrated);
      setStaffSession(existing.token, { name: hydrated.name, phone: hydrated.phone });
    } else {
      setCustomerUser(hydrated);
      setSession(existing.token, { name: hydrated.name, phone: hydrated.phone });
    }
  }, [isStaff]);

  const user = isStaff ? staffUser : customerUser;
  const token = isStaff ? staffToken : customerToken;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginOpen,
        setLoginOpen,
        postLoginRedirect,
        setPostLoginRedirect,
        setAuth,
        refreshAuth,
        clearAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
