const CUSTOMER_TOKEN_KEY = 'ah_token';
const CUSTOMER_META_KEY = 'ah_user_meta';
const STAFF_TOKEN_KEY = 'ah_staff_token';
const STAFF_META_KEY = 'ah_staff_meta';

export type SessionUserMeta = { name?: string; phone?: string };

function readSession(tokenKey: string, metaKey: string): { token: string; meta?: SessionUserMeta } | null {
  if (typeof window === 'undefined') return null;
  const token = sessionStorage.getItem(tokenKey);
  if (!token) return null;
  try {
    const rawMeta = sessionStorage.getItem(metaKey);
    return { token, meta: rawMeta ? (JSON.parse(rawMeta) as SessionUserMeta) : undefined };
  } catch {
    return { token };
  }
}

function writeSession(tokenKey: string, metaKey: string, token: string, meta?: SessionUserMeta): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(tokenKey, token);
    if (meta) {
      sessionStorage.setItem(metaKey, JSON.stringify(meta));
    }
  }
}

function removeSession(tokenKey: string, metaKey: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(metaKey);
  }
}

export function getSession(): { token: string; meta?: SessionUserMeta } | null {
  return readSession(CUSTOMER_TOKEN_KEY, CUSTOMER_META_KEY);
}

export function setSession(token: string, meta?: SessionUserMeta): void {
  writeSession(CUSTOMER_TOKEN_KEY, CUSTOMER_META_KEY, token, meta);
}

export function clearSession(): void {
  removeSession(CUSTOMER_TOKEN_KEY, CUSTOMER_META_KEY);
}

export function getStaffSession(): { token: string; meta?: SessionUserMeta } | null {
  return readSession(STAFF_TOKEN_KEY, STAFF_META_KEY);
}

export function setStaffSession(token: string, meta?: SessionUserMeta): void {
  writeSession(STAFF_TOKEN_KEY, STAFF_META_KEY, token, meta);
}

export function clearStaffSession(): void {
  removeSession(STAFF_TOKEN_KEY, STAFF_META_KEY);
}
