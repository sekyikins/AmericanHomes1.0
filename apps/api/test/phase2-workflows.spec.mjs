import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';

const require = createRequire('D:/All Projects/AmericanHomes/package.json');
const { PrismaClient } = require('@prisma/client');

const PORT = '3098';
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

test('Phase 2 End-to-End Business Workflows & Authorization', async (t) => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString().slice(-6);
  const child = spawn('node', ['apps/api/dist/main.js'], {
    env: { ...process.env, PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const ready = await waitForServer();
    assert.equal(ready, true, 'API server should start');

    // 1. Staff Login password enforcement & RBAC negative test
    const badLogin = await req('POST', '/auth/staff-login', {
      email: 'owner@americanhomes.gh',
      password: 'WrongPassword123',
    });
    assert.equal(badLogin.status, 401);

    const ownerLogin = await req('POST', '/auth/staff-login', {
      email: 'owner@americanhomes.gh',
      password: process.env.OWNER_PASSWORD ?? 'Owner@AmericanHomes2026!',
    });
    assert.equal(ownerLogin.status, 201);
    const ownerToken = ownerLogin.body.token;
    assert.ok(ownerToken);

    const custVer = await req('POST', '/auth/verify-otp', {
      phone: `+233249${suffix}`,
      otp: '123456',
      mode: 'signup',
      name: 'Phase 2 Customer',
    });
    assert.equal(custVer.status, 201);
    assert.equal(custVer.body.verified, true);
    const custToken = custVer.body.token;
    assert.ok(custToken, 'Customer token should be issued on signup');

    // Customer must be blocked (403) from staff endpoints
    const forbiddenShip = await req('GET', '/shipments', undefined, custToken);
    assert.equal(forbiddenShip.status, 403);
    const forbiddenAudit = await req('GET', '/audit', undefined, custToken);
    assert.equal(forbiddenAudit.status, 403);

    // 2. Shipment -> Manifest -> Receiving -> Discrepancy -> Closure Gate
    const shp = await req('POST', '/shipments', {
      reference: `SHP-P2-${suffix}`,
      providerName: 'Maersk',
    }, ownerToken);
    assert.equal(shp.status, 201);

    const man = await req('POST', `/shipments/${shp.body.id}/manifest`, {
      items: [{ productName: 'Test Sofa', quantity: 5, unitCostCents: 100000 }],
    }, ownerToken);
    assert.equal(man.status, 201);
    const manifestItemId = man.body.items[0].id;

    // Create product + variant for receiving admission
    const prod = await req('POST', '/catalogue/products', {
      name: `Sofa P2 ${suffix}`,
      category: 'living-room',
    }, ownerToken);
    assert.equal(prod.status, 201);
    const variant = await req('POST', `/catalogue/products/${prod.body.id}/variants`, {
      name: 'Charcoal',
      priceCents: 350000,
    }, ownerToken);
    assert.equal(variant.status, 201);

    // Receiving on PLANNED shipment must be blocked (409) until ARRIVED
    const blockedRcv = await req('POST', '/receiving/sessions', { shipmentId: shp.body.id }, ownerToken);
    assert.equal(blockedRcv.status, 409);

    const inTransit = await req('PATCH', `/shipments/${shp.body.id}/status`, { status: 'IN_TRANSIT' }, ownerToken);
    assert.equal(inTransit.status, 200);
    const arrived = await req('PATCH', `/shipments/${shp.body.id}/status`, { status: 'ARRIVED' }, ownerToken);
    assert.equal(arrived.status, 200);

    const rcv = await req('POST', '/receiving/sessions', { shipmentId: shp.body.id }, ownerToken);
    assert.equal(rcv.status, 201);

    // Receive 3 instead of 5 -> creates MISSING(2) discrepancy & UNAVAILABLE StockLot(3)
    const line = await req('POST', `/receiving/sessions/${rcv.body.id}/lines`, {
      manifestItemId,
      variantId: variant.body.id,
      receivedQty: 3,
      condition: 'GOOD',
    }, ownerToken);
    assert.equal(line.status, 201);
    assert.equal(line.body.discrepancies.length, 1);
    assert.equal(line.body.discrepancies[0].type, 'MISSING');

    const balAfterRecv = await req('GET', `/inventory/balance/${variant.body.id}`, undefined, ownerToken);
    assert.equal(balAfterRecv.body.unavailable, 3);
    assert.equal(balAfterRecv.body.available, 0);

    // Attempt to close shipment with unresolved discrepancy -> must be 400
    const blockedClose = await req('POST', `/shipments/${shp.body.id}/close`, {}, ownerToken);
    assert.equal(blockedClose.status, 400);

    // Resolve discrepancy -> now close succeeds
    const resolved = await req('POST', `/receiving/discrepancies/${line.body.discrepancies[0].id}/resolve`, {
      resolution: 'SHORT_SHIPPED_CONFIRMED',
    }, ownerToken);
    assert.equal(resolved.status, 201);
    const closed = await req('POST', `/shipments/${shp.body.id}/close`, {}, ownerToken);
    assert.equal(closed.status, 201);

    // 3. Onboarding sequence & Publication Gate
    // Photography before cleaning -> 400
    const badPhoto = await req('POST', `/catalogue/products/${prod.body.id}/preparation`, {
      step: 'PHOTOGRAPHY',
    }, ownerToken);
    assert.equal(badPhoto.status, 400);

    // Publish before onboarding/price/available stock -> 400
    const badPub = await req('POST', `/catalogue/products/${prod.body.id}/publish`, {}, ownerToken);
    assert.equal(badPub.status, 400);

    // 4. Product Request Withdrawal Cutoff
    const preq = await req('POST', '/product-requests', {
      productName: 'Dyson V15',
      description: 'Cordless Vacuum',
      quantity: 1,
    }, custToken);
    assert.equal(preq.status, 201);

    // Withdraw before supplier confirmation -> withdrawn: true
    const w1 = await req('POST', `/product-requests/${preq.body.id}/withdraw`, { reason: 'Changed mind' }, custToken);
    assert.equal(w1.status, 201);
    assert.equal(w1.body.withdrawn, true);

    // Second request: group -> sourcing -> provider confirm -> withdrawal escalates
    const preq2 = await req('POST', '/product-requests', {
      productName: 'Dyson V15',
      description: 'Cordless Vacuum 2',
      quantity: 1,
    }, custToken);
    const grp = await req('POST', '/sourcing/groups', { name: `Grp-${suffix}`, requestIds: [preq2.body.id] }, ownerToken);
    const src = await req('POST', '/sourcing', { shipmentId: shp.body.id, groupId: grp.body.id, description: 'Dyson V15', quantity: 1 }, ownerToken);
    const conf = await req('POST', `/sourcing/${src.body.id}/confirm-provider`, { providerRef: 'SUP-99' }, ownerToken);
    assert.equal(conf.status, 201);
    const w2 = await req('POST', `/product-requests/${preq2.body.id}/withdraw`, { reason: 'Too late' }, custToken);
    assert.equal(w2.status, 201);
    assert.equal(w2.body.withdrawn, false);
    assert.equal(w2.body.requiresManagementReview, true);

    // 5. Checkout -> Late Webhook Exception (without overselling)
    // Add available stock directly via Prisma for checkout test
    await prisma.stockLot.create({
      data: { variantId: variant.body.id, quantity: 1, available: 1, held: 0, unavailable: 0 },
    });
    // Complete onboarding + price approval (by second staff) + publish
    for (const step of ['INSPECTION', 'CLEANING', 'PHOTOGRAPHY', 'WRAPPING']) {
      const r = await req('POST', `/catalogue/products/${prod.body.id}/preparation`, { step }, ownerToken);
      assert.equal(r.status, 201);
    }
    const prop = await req('POST', `/catalogue/variants/${variant.body.id}/price-proposals`, {
      proposedPriceCents: 350000,
    }, ownerToken);
    // Owner is permitted to approve price proposal directly (non-owner self-approval is blocked 403)
    const ownerApp = await req('POST', `/catalogue/price-approvals/${prop.body.id}/approve`, {}, ownerToken);
    assert.equal(ownerApp.status, 201);
    const pub = await req('POST', `/catalogue/products/${prod.body.id}/publish`, {}, ownerToken);
    assert.equal(pub.status, 201);

    const chk = await req('POST', '/orders/checkout', {
      items: [{ variantId: variant.body.id, quantity: 1 }],
    }, custToken);
    assert.equal(chk.status, 201);

    const payInit = await req('POST', '/payments/initialize', {
      orderId: chk.body.order.id,
      amountCents: 350000,
      channel: 'paystack_momo',
    }, custToken);
    assert.equal(payInit.status, 201);

    // Simulate checkout session expiry before late webhook arrives
    await prisma.checkoutSession.update({
      where: { id: chk.body.checkoutSession.id },
      data: { status: 'EXPIRED' },
    });
    let paystackKey = process.env.PAYSTACK_SECRET_KEY || '';
    for (const envPath of ['apps/api/.env', '.env']) {
      if (!paystackKey && existsSync(envPath)) {
        const match = readFileSync(envPath, 'utf8').match(/^PAYSTACK_SECRET_KEY=(.*)$/m);
        if (match) paystackKey = match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
    const whPayload = { event: 'charge.success', data: { reference: payInit.body.reference } };
    const whSig = createHmac('sha512', paystackKey).update(JSON.stringify(whPayload)).digest('hex');
    const whRes = await fetch(`${BASE}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': whSig },
      body: JSON.stringify(whPayload),
    });
    const whJson = await whRes.json();
    assert.equal(whRes.status, 201);
    assert.equal(whJson.exception, true);
  } finally {
    child.kill();
    await prisma.$disconnect();
  }
});
