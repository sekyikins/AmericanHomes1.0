import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(__dirname, '../src');

function setupBrowserMocks({ token = 'test-jwt-token', status = 401, body = { message: 'Unauthorized' } } = {}) {
  const storage = new Map();
  if (token) storage.set('ah_token', token);

  const dispatchedEvents = [];
  const listeners = new Map();

  const mockWindow = {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) ?? [];
      listeners.set(type, list.filter((x) => x !== fn));
    },
    dispatchEvent(evt) {
      dispatchedEvents.push(evt);
      for (const fn of listeners.get(evt.type) ?? []) {
        fn(evt);
      }
      return true;
    },
  };

  globalThis.window = mockWindow;
  globalThis.sessionStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'Error',
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  return { storage, dispatchedEvents };
}

test('api.get clears ah_token and dispatches ah:session-expired on 401 for protected routes', async () => {
  const { storage, dispatchedEvents } = setupBrowserMocks({
    token: 'expired-token',
    status: 401,
    body: { message: 'Token expired' },
  });

  const { api } = await import('../src/lib/api/client.ts');

  await assert.rejects(() => api.get('/orders'), /Token expired/);
  assert.equal(storage.has('ah_token'), false);
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].type, 'ah:session-expired');
});

test('api.post does not dispatch ah:session-expired on 401 from login endpoints', async () => {
  const { dispatchedEvents } = setupBrowserMocks({
    token: 'existing-token',
    status: 401,
    body: { message: 'Invalid email or password' },
  });

  const { api } = await import('../src/lib/api/client.ts');

  await assert.rejects(() => api.post('/auth/staff-login', {}), /Invalid email or password/);
  await assert.rejects(() => api.post('/auth/verify-otp', {}), /Invalid email or password/);
  assert.equal(dispatchedEvents.length, 0);
});

test('api.post joins array validation messages from API responses', async () => {
  setupBrowserMocks({
    status: 400,
    body: { message: ['productName is required', 'quantity must be positive'] },
  });

  const { api } = await import('../src/lib/api/client.ts');

  await assert.rejects(
    () => api.post('/requests', {}),
    /productName is required, quantity must be positive/,
  );
});

test('ConfirmDialog provides accessible alertdialog, Escape handling, and consequence metadata', () => {
  const source = fs.readFileSync(path.join(webSrc, 'components/ui/confirm-dialog.tsx'), 'utf8');
  assert.match(source, /role="alertdialog"/);
  assert.match(source, /e\.key === 'Escape'/);
  assert.match(source, /targetName/);
  assert.match(source, /reversible/);
  assert.match(source, /consequence/);
  assert.match(source, /confirmLabel/);
});

test('Button supports loading state, loadingText, disabled guard, and aria-busy', () => {
  const source = fs.readFileSync(path.join(webSrc, 'components/ui/button.tsx'), 'utf8');
  assert.match(source, /loading\?: boolean/);
  assert.match(source, /loadingText\?: string/);
  assert.match(source, /disabled \|\| loading/);
  assert.match(source, /aria-busy=\{loading \|\| undefined\}/);
});

test('ToastProvider exposes status live region and all 4 feedback tones', () => {
  const source = fs.readFileSync(path.join(webSrc, 'providers/toast.provider.tsx'), 'utf8');
  assert.match(source, /'success' \| 'error' \| 'warning' \| 'info'/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
});

test('Auth guards keep staff and customer routes isolated and require sign-out confirmation', () => {
  const adminShell = fs.readFileSync(path.join(webSrc, 'components/staff/AdminShell.tsx'), 'utf8');
  const accountLayout = fs.readFileSync(
    path.join(webSrc, 'app/(customer-account)/account/layout.tsx'),
    'utf8',
  );
  const accountSettingsModal = fs.readFileSync(
    path.join(webSrc, 'components/customer/AccountSettingsModal.tsx'),
    'utf8',
  );
  const customerHeader = fs.readFileSync(
    path.join(webSrc, 'components/storefront/CustomerHeader.tsx'),
    'utf8',
  );

  assert.match(adminShell, /user\.role !== 'STAFF'/);
  assert.match(adminShell, /<ConfirmDialog/);
  assert.match(adminShell, /mobileNavOpen/);
  assert.match(accountLayout, /!user \|\| user\.role === 'STAFF'/);
  assert.match(accountSettingsModal, /<ConfirmDialog/);
  assert.doesNotMatch(customerHeader, /Sign out/);
});
