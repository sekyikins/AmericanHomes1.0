import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  generateTotpCode,
  hashPassword,
  verifyPassword,
  verifyTotpCode,
} from '../dist/common/utils/password.js';
import {
  signSessionToken,
  verifySessionToken,
} from '../dist/common/utils/token.js';
import { PermissionsGuard } from '../dist/common/guards/permissions.guard.js';
import { OwnerOnlyGuard } from '../dist/common/guards/owner-only.guard.js';
import { PERMISSION_KEY } from '../dist/common/decorators/permissions.decorator.js';

function makeExecutionContext(user, metadataMap = {}) {
  const handler = () => {};
  const cls = class {};
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    _metadataMap: metadataMap,
  };
}

test('Password hashing and verification', () => {
  const hash = hashPassword('Owner@AmericanHomes2026!');
  assert.equal(verifyPassword('Owner@AmericanHomes2026!', hash), true);
  assert.equal(verifyPassword('WrongPassword!', hash), false);
});

test('TOTP MFA generation and verification', () => {
  const secret = 'test-mfa-secret-hex';
  const now = Date.now();
  const code = generateTotpCode(secret, now);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotpCode(secret, code, now), true);
  assert.equal(verifyTotpCode(secret, '000000', now), false);
});

test('Session token enforces 12h max TTL and rejects tampering', () => {
  const secret = 'unit-test-secret';
  const token = signSessionToken({ sub: 'u1', role: 'STAFF' }, secret, 999999);
  const payload = verifySessionToken(token, secret);
  assert.ok(payload);
  const nowSec = Math.floor(Date.now() / 1000);
  assert.ok(payload.exp - nowSec <= 12 * 3600 + 2);
  assert.equal(verifySessionToken(token + 'x', secret), null);
});

test('PermissionsGuard blocks customers, unauthorized staff, and financially-restricted managers', () => {
  const reflector = {
    getAllAndOverride: (key) => (key === PERMISSION_KEY ? 'reports.view' : false),
  };
  const guard = new PermissionsGuard(reflector);

  // Customer blocked
  assert.throws(
    () => guard.canActivate(makeExecutionContext({ id: 'c1', role: 'CUSTOMER', permissions: ['reports.view'] })),
    ForbiddenException,
  );

  // Staff missing permission blocked
  assert.throws(
    () => guard.canActivate(makeExecutionContext({ id: 's1', role: 'STAFF', permissions: ['orders.view'] })),
    ForbiddenException,
  );

  // Financially-restricted manager blocked even if group had reports.view
  assert.throws(
    () =>
      guard.canActivate(
        makeExecutionContext({
          id: 'm1',
          role: 'STAFF',
          isOwner: false,
          restrictFinancials: true,
          permissions: ['reports.view'],
        }),
      ),
    ForbiddenException,
  );

  // Unrestricted staff with permission allowed
  assert.equal(
    guard.canActivate(
      makeExecutionContext({
        id: 'm2',
        role: 'STAFF',
        isOwner: false,
        restrictFinancials: false,
        permissions: ['reports.view'],
      }),
    ),
    true,
  );

  // Owner always allowed
  assert.equal(
    guard.canActivate(makeExecutionContext({ id: 'o1', role: 'STAFF', isOwner: true, permissions: [] })),
    true,
  );
});

test('OwnerOnlyGuard rejects non-owners and allows owner', () => {
  const reflector = new Reflector();
  reflector.getAllAndOverride = () => true;
  const guard = new OwnerOnlyGuard(reflector);

  assert.throws(
    () => guard.canActivate(makeExecutionContext({ id: 'm1', role: 'STAFF', isOwner: false })),
    ForbiddenException,
  );
  assert.equal(
    guard.canActivate(makeExecutionContext({ id: 'o1', role: 'STAFF', isOwner: true })),
    true,
  );
});
