const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

function isStaffRoute(): boolean {
  return typeof window !== 'undefined' && Boolean(window.location?.pathname?.startsWith('/staff'));
}

function getActiveTokenKey(): string {
  return isStaffRoute() ? 'ah_staff_token' : 'ah_token';
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(getActiveTokenKey());
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    if (
      res.status === 401 &&
      token &&
      typeof window !== 'undefined' &&
      !path.startsWith('/auth/staff-login') &&
      !path.startsWith('/auth/verify-otp')
    ) {
      sessionStorage.removeItem(getActiveTokenKey());
      window.dispatchEvent(new CustomEvent('ah:session-expired'));
    }
    const error = (await res.json().catch(() => ({ message: 'Request failed' }))) as {
      message?: string | string[];
    };
    const msg = Array.isArray(error.message)
      ? error.message.join(', ')
      : (error.message ?? 'Request failed');
    throw Object.assign(new Error(msg), { status: res.status });
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
