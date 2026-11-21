import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';

const require = createRequire('D:/All Projects/AmericanHomes/package.json');
const { PrismaClient } = require('@prisma/client');

const PORT = '3099';
const BASE = `http://127.0.0.1:${PORT}/api`;

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch {}
    await delay(300);
  }
  return false;
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, body: json };
}

test('Phase 2 Extended E2E: Auth, Concurrency, Dual-Control, Partial Collection, Returns, Store Credit, Notifications & Exports', async () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString().slice(-6);
  const child = spawn('node', ['apps/api/dist/main.js'], {
    env: { ...process.env, PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const ready = await waitForServer();
    assert.equal(ready, true, 'API server should start');

    // 1. Owner login
    const ownerLogin = await req('POST', '/auth/staff-login', {
      email: 'owner@americanhomes.gh',
      password: process.env.OWNER_PASSWORD ?? 'Owner@AmericanHomes2026!',
    });
    assert.equal(ownerLogin.status, 201);
    const ownerToken = ownerLogin.body.token;
    assert.ok(ownerToken);

    // 2. Customer OTP: wrong OTP rejected, valid signup succeeds, revoke-other-sessions invalidates old token
    const custPhone1 = `+233201${suffix}`;
    const custPhone2 = `+233202${suffix}`;
    const badOtp = await req('POST', '/auth/verify-otp', {
      phone: custPhone1,
      otp: '999999',
      mode: 'signup',
    });
    assert.equal(badOtp.status, 201);
    assert.equal(badOtp.body.verified, false);

    const cust1Signup = await req('POST', '/auth/verify-otp', {
      phone: custPhone1,
      otp: '123456',
      mode: 'signup',
      name: `Cust One ${suffix}`,
    });
    assert.equal(cust1Signup.status, 201);
    assert.equal(cust1Signup.body.verified, true);
    const cust1OldToken = cust1Signup.body.token;

    const revoked = await req('POST', '/auth/revoke-other-sessions', {}, cust1OldToken);
    assert.equal(revoked.status, 201);
    assert.equal(revoked.body.revoked, true);
    const cust1Token = revoked.body.token;
    assert.ok(cust1Token);

    // Old token must now fail with 401; new token succeeds with 200
    const oldMe = await req('GET', '/auth/me', undefined, cust1OldToken);
    assert.equal(oldMe.status, 401);
    const newMe = await req('GET', '/auth/me', undefined, cust1Token);
    assert.equal(newMe.status, 200);

    const cust2Signup = await req('POST', '/auth/verify-otp', {
      phone: custPhone2,
      otp: '123456',
      mode: 'signup',
      name: `Cust Two ${suffix}`,
    });
    assert.equal(cust2Signup.status, 201);
    const cust2Token = cust2Signup.body.token;

    // 3. Create restricted Staff user + Permission Group, verify password change revokes old token & entity permission checks
    const groupRes = await req(
      'POST',
      '/permissions/groups',
      {
        name: `QA Ops ${suffix}`,
        permissionCodes: [
          'orders.view',
          'orders.create_walk_in',
          'payments.view',
          'payments.record_manual',
          'stocktakes.view',
          'stocktakes.manage',
          'inventory.view',
          'inventory.adjust',
          'reports.view',
          'reports.export',
        ],
      },
      ownerToken,
    );
    assert.equal(groupRes.status, 201);

    const staffEmail = `qa.staff.${suffix}@americanhomes.gh`;
    const staffInitPass = 'StaffPass!2026';
    const staffNewPass = 'StaffPassUpdated!2026';
    const staffRes = await req(
      'POST',
      '/staff',
      {
        name: `QA Staff ${suffix}`,
        email: staffEmail,
        phone: `+233551${suffix}`,
        password: staffInitPass,
        jobTitle: 'QA Clerk',
        permissionGroupId: groupRes.body.id,
        restrictFinancials: false,
      },
      ownerToken,
    );
    assert.equal(staffRes.status, 201);

    const staffLogin1 = await req('POST', '/auth/staff-login', {
      email: staffEmail,
      password: staffInitPass,
    });
    assert.equal(staffLogin1.status, 201);
    const staffOldToken = staffLogin1.body.token;

    const pwChange = await req(
      'POST',
      '/auth/staff-change-password',
      { currentPassword: staffInitPass, newPassword: staffNewPass },
      staffOldToken,
    );
    assert.equal(pwChange.status, 201);
    const staffToken = pwChange.body.token;
    assert.ok(staffToken);

    // Old staff token must now be 401
    const oldStaffCheck = await req('GET', '/auth/me', undefined, staffOldToken);
    assert.equal(oldStaffCheck.status, 401);

    // Restricted staff cannot export AUDIT (lacks audit.view -> 403), but CAN export ORDERS (XLSX & PDF)
    const deniedAuditExport = await req(
      'POST',
      '/reports/exports',
      { type: 'AUDIT', format: 'CSV' },
      staffToken,
    );
    assert.equal(deniedAuditExport.status, 403);

    const xlsxExport = await req(
      'POST',
      '/reports/exports',
      { type: 'ORDERS', format: 'XLSX' },
      staffToken,
    );
    assert.equal(xlsxExport.status, 201);
    assert.ok(xlsxExport.body.contentBase64?.startsWith('UEsDB'), 'XLSX should be a valid ZIP archive');

    const pdfExport = await req(
      'POST',
      '/reports/exports',
      { type: 'ORDERS', format: 'PDF' },
      staffToken,
    );
    assert.equal(pdfExport.status, 201);
    assert.ok(pdfExport.body.contentBase64?.startsWith('JVBERi0'), 'PDF should start with %PDF- header');

    // 4. Product + Stocktake + Adjustment Dual-Control + Concurrent Last-Unit Checkout Race
    const prod = await req(
      'POST',
      '/catalogue/products',
      { name: `QA Table ${suffix}`, category: 'dining' },
      ownerToken,
    );
    assert.equal(prod.status, 201);
    const variant = await req(
      'POST',
      `/catalogue/products/${prod.body.id}/variants`,
      { name: 'Oak', priceCents: 200000 },
      ownerToken,
    );
    assert.equal(variant.status, 201);

    // Seed 1 available unit and complete onboarding + price + publish
    await prisma.stockLot.create({
      data: { variantId: variant.body.id, quantity: 1, available: 1, held: 0, unavailable: 0 },
    });
    for (const step of ['INSPECTION', 'CLEANING', 'PHOTOGRAPHY', 'WRAPPING']) {
      const r = await req('POST', `/catalogue/products/${prod.body.id}/preparation`, { step }, ownerToken);
      assert.equal(r.status, 201);
    }
    const prop = await req(
      'POST',
      `/catalogue/variants/${variant.body.id}/price-proposals`,
      { proposedPriceCents: 200000 },
      ownerToken,
    );
    await req('POST', `/catalogue/price-approvals/${prop.body.id}/approve`, {}, ownerToken);
    const pub = await req('POST', `/catalogue/products/${prod.body.id}/publish`, {}, ownerToken);
    assert.equal(pub.status, 201);

    // Stocktake + adjustment proposal
    const st = await req('POST', '/stocktakes', { reference: `STK-QA-${suffix}` }, staffToken);
    assert.equal(st.status, 201);
    const stLine = await req(
      'POST',
      `/stocktakes/${st.body.id}/lines`,
      { lines: [{ variantId: variant.body.id, countedQty: 1 }] },
      staffToken,
    );
    assert.equal(stLine.status, 201);

    // Concurrent last-unit checkout race: two customers try to buy the 1 available unit simultaneously
    const [race1, race2] = await Promise.all([
      req('POST', '/orders/checkout', { items: [{ variantId: variant.body.id, quantity: 1 }] }, cust1Token),
      req('POST', '/orders/checkout', { items: [{ variantId: variant.body.id, quantity: 1 }] }, cust2Token),
    ]);
    const statuses = [race1.status, race2.status].sort((a, b) => a - b);
    assert.equal(statuses[0], 201, 'Exactly one concurrent checkout must succeed');
    assert.equal(statuses[1], 409, 'Second concurrent checkout must fail with 409 without overselling');
    const winningCheckout = race1.status === 201 ? race1.body : race2.body;
    const winningToken = race1.status === 201 ? cust1Token : cust2Token;
    const losingToken = race1.status === 201 ? cust2Token : cust1Token;

    // 5. Paystack webhook + duplicate idempotency + verifyPayment settlement
    const payInit = await req(
      'POST',
      '/payments/initialize',
      { orderId: winningCheckout.order.id, amountCents: 200000, channel: 'paystack_momo' },
      winningToken,
    );
    assert.equal(payInit.status, 201);

    let paystackKey = process.env.PAYSTACK_SECRET_KEY || '';
    for (const envPath of ['apps/api/.env', '.env']) {
      if (!paystackKey && existsSync(envPath)) {
        const match = readFileSync(envPath, 'utf8').match(/^PAYSTACK_SECRET_KEY=(.*)$/m);
        if (match) paystackKey = match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
    const whPayload = { event: 'charge.success', data: { reference: payInit.body.reference } };
    const whSig = createHmac('sha512', paystackKey).update(JSON.stringify(whPayload)).digest('hex');

    const wh1 = await fetch(`${BASE}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': whSig },
      body: JSON.stringify(whPayload),
    });
    const wh1Json = await wh1.json();
    assert.equal(wh1.status, 201);
    assert.equal(wh1Json.settled, true);

    // Duplicate webhook must be idempotent
    const wh2 = await fetch(`${BASE}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': whSig },
      body: JSON.stringify(whPayload),
    });
    const wh2Json = await wh2.json();
    assert.equal(wh2.status, 201);
    assert.equal(wh2Json.idempotent, true);

    // Receipt IDOR check: winning customer & owner can view; losing customer gets 403
    const ownReceipt = await req('GET', `/notifications/receipt/${winningCheckout.order.id}`, undefined, winningToken);
    assert.equal(ownReceipt.status, 200);
    const idorReceipt = await req('GET', `/notifications/receipt/${winningCheckout.order.id}`, undefined, losingToken);
    assert.equal(idorReceipt.status, 403);

    // 6. Walk-in sale (qty 2), Manual Payment Dual-Control, Partial Collection, Return + Store Credit
    await prisma.stockLot.create({
      data: { variantId: variant.body.id, quantity: 2, available: 2, held: 0, unavailable: 0 },
    });
    const walkIn = await req(
      'POST',
      '/orders/walk-in',
      {
        customerId: cust1Signup.body.userId,
        lines: [{ variantId: variant.body.id, quantity: 2, unitPriceCents: 200000 }],
      },
      staffToken,
    );
    assert.equal(walkIn.status, 201);
    assert.equal(walkIn.body.source, 'WALK_IN');
    const orderLineId = walkIn.body.lines[0].id;

    const manualPay = await req(
      'POST',
      '/payments/manual',
      { orderId: walkIn.body.id, amountCents: 400000, method: 'CASH', reference: `RCP-${suffix}` },
      staffToken,
    );
    assert.equal(manualPay.status, 201);

    // Owner approves manual payment (staff self-approval blocked if they had permission)
    const payApprove = await req('POST', `/payments/${manualPay.body.id}/approve`, {}, ownerToken);
    assert.equal(payApprove.status, 201);

    // Partial collection: 1 of 2
    const col1 = await req(
      'POST',
      '/collections',
      { orderId: walkIn.body.id, lines: [{ orderLineId, quantity: 1 }] },
      ownerToken,
    );
    assert.equal(col1.status, 201);
    assert.equal(col1.body.fulfilmentStatus, 'PARTIALLY_COLLECTED');

    // Second collection: remaining 1 of 2 -> COLLECTED
    const col2 = await req(
      'POST',
      '/collections',
      { orderId: walkIn.body.id, lines: [{ orderLineId, quantity: 1 }] },
      ownerToken,
    );
    assert.equal(col2.status, 201);
    assert.equal(col2.body.fulfilmentStatus, 'COLLECTED');

    // Return + Store Credit settlement
    const ret = await req(
      'POST',
      '/returns',
      { orderId: walkIn.body.id, reason: 'Minor scratch discovered after collection' },
      cust1Token,
    );
    assert.equal(ret.status, 201);

    const retApprove = await req(
      'POST',
      `/returns/${ret.body.id}/decision`,
      {
        approved: true,
        settlementType: 'STORE_CREDIT',
        refundAmountCents: 50000,
        disposition: 'RESTOCK',
        variantId: variant.body.id,
        quantity: 1,
        notes: 'Approved store credit QA',
      },
      ownerToken,
    );
    assert.equal(retApprove.status, 201);
    const creditEntries = await prisma.storeCreditEntry.findMany({
      where: { returnRequestId: ret.body.id },
    });
    assert.equal(creditEntries.length, 1);
    assert.equal(creditEntries[0].amountCents, 50000);

    // 7. Notification preferences & WhatsApp consent
    const prefUpdate = await req(
      'PATCH',
      '/notifications/preferences',
      { ordersPayments: true, promotions: false },
      cust1Token,
    );
    assert.equal(prefUpdate.status, 200);
    const consent = await req(
      'POST',
      '/notifications/whatsapp-consent',
      { granted: true, source: 'ACCOUNT_SETTINGS' },
      cust1Token,
    );
    assert.equal(consent.status, 201);

    // 8. Deactivate temporary QA staff account (revokes token)
    const deact = await req('DELETE', `/staff/${staffRes.body.id}`, undefined, ownerToken);
    assert.equal(deact.status, 200);
    const deactCheck = await req('GET', '/auth/me', undefined, staffToken);
    assert.equal(deactCheck.status, 401);
  } finally {
    child.kill();
    await prisma.$disconnect();
  }
});
