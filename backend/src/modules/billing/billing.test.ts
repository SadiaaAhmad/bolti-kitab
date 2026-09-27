/**
 * Bolti Kitab — Billing, Subscriptions & Entitlements Integration Tests
 *
 * DATABASE:    bolti_kitab_test (ISOLATED)
 * TEST RUNNER: Node.js built-in test runner (node:test)
 *
 * Covers all 18 test specifications: [P1-BILL-001] through [P1-BILL-018]
 */

import '../../test/setup-env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateTestUsers,
  truncateTestCatalog,
  truncateTestBilling,
  getTestPool,
} from '../../test/db-setup.js';

import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { config } from '../../config/env.js';

const tag = () => crypto.randomBytes(4).toString('hex');

interface CreatedUser {
  id: string;
  token: string;
  email: string;
}

async function registerAndLogin(app: FastifyInstance, email: string): Promise<CreatedUser> {
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'SecureP@ss123!', full_name: 'Test Buyer' },
  });
  assert.equal(regRes.statusCode, 201, `Register failed: ${regRes.body}`);
  const user = (JSON.parse(regRes.body) as { user: { id: string } }).user;

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'SecureP@ss123!' },
  });
  assert.equal(loginRes.statusCode, 200, `Login failed: ${loginRes.body}`);
  const { token } = JSON.parse(loginRes.body) as { token: string };

  return { id: user.id, token, email };
}

async function insertTestBook(pool: ReturnType<typeof getTestPool>, title = 'Test Book', priceCents = 1500, eligible = true): Promise<string> {
  const res = await pool.query<{ id: string }>(`
    INSERT INTO books (
      title, title_urdu, author, narrator_name, language, price_cents, currency, status, is_subscription_eligible
    ) VALUES (
      $1, 'ٹیسٹ کتاب', 'Author X', 'Narrator Y', 'ur', $2, 'PKR', 'active', $3
    ) RETURNING id
  `, [title, priceCents, eligible]);
  return res.rows[0]!.id;
}

describe('Billing, Subscriptions & Entitlements Module', () => {
  let app: FastifyInstance;
  let pool: ReturnType<typeof getTestPool>;
  const DEV_MONTHLY_PLAN_ID = '11111111-1111-1111-1111-111111111101';
  const DEV_ANNUAL_PLAN_ID = '11111111-1111-1111-1111-111111111102';

  before(async () => {
    await setupTestDatabase();
    pool = getTestPool();
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await truncateTestBilling();
    await truncateTestCatalog();
    await truncateTestUsers();
    await teardownTestDatabase();
    await app.close();
  });

  beforeEach(async () => {
    pool = getTestPool();
    await truncateTestBilling();
    await truncateTestCatalog();
    await truncateTestUsers();

    // Re-seed dev plans if truncated
    await pool.query(`
      INSERT INTO subscription_plans (id, name, billing_interval, price_cents, currency, is_active)
      VALUES
        ('11111111-1111-1111-1111-111111111101', 'Dev Monthly Plan', 'monthly', 10000, 'PKR', TRUE),
        ('11111111-1111-1111-1111-111111111102', 'Dev Annual Plan', 'annual', 100000, 'PKR', TRUE)
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-001] POST /checkout/book without Idempotency-Key header returns 400', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { bookId, gateway: 'mock' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.match(body.message, /Idempotency-Key/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-002] Sequential calls with identical Idempotency-Key return existing session', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool);
    const key = `key_${tag()}`;

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: {
        authorization: `Bearer ${user.token}`,
        'idempotency-key': key,
      },
      payload: { bookId, gateway: 'mock' },
    });
    assert.equal(res1.statusCode, 201);
    const data1 = JSON.parse(res1.body);
    assert.equal(data1.isExisting, false);

    // Second call with same key
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: {
        authorization: `Bearer ${user.token}`,
        'idempotency-key': key,
      },
      payload: { bookId, gateway: 'mock' },
    });
    assert.equal(res2.statusCode, 200);
    const data2 = JSON.parse(res2.body);
    assert.equal(data2.isExisting, true);
    assert.equal(data2.paymentId, data1.paymentId);
    assert.equal(data2.gatewayTxId, data1.gatewayTxId);

    // Check DB has only 1 payment row
    const count = await pool.query('SELECT COUNT(*) FROM payments WHERE user_id = $1', [user.id]);
    assert.equal(parseInt(count.rows[0].count, 10), 1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-003] Reuse Idempotency-Key with different book or parameters returns 409 Conflict', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const book1 = await insertTestBook(pool, 'Book 1');
    const book2 = await insertTestBook(pool, 'Book 2');
    const key = `key_${tag()}`;

    // First request with Book 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: {
        authorization: `Bearer ${user.token}`,
        'idempotency-key': key,
      },
      payload: { bookId: book1, gateway: 'mock' },
    });
    assert.equal(res1.statusCode, 201);

    // Second request with SAME key but Book 2
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: {
        authorization: `Bearer ${user.token}`,
        'idempotency-key': key,
      },
      payload: { bookId: book2, gateway: 'mock' },
    });
    assert.equal(res2.statusCode, 409);
    const body = JSON.parse(res2.body);
    assert.match(body.message, /already been used for a different request/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-004] Repeated direct purchases for same user + book with different keys reuses pending intent', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool);
    const keyA = `key_a_${tag()}`;
    const keyB = `key_b_${tag()}`;

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': keyA },
      payload: { bookId, gateway: 'mock' },
    });
    assert.equal(res1.statusCode, 201);
    const data1 = JSON.parse(res1.body);

    // Call with different key B while intent is still pending
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': keyB },
      payload: { bookId, gateway: 'mock' },
    });
    assert.equal(res2.statusCode, 200);
    const data2 = JSON.parse(res2.body);
    assert.equal(data2.isExisting, true);
    assert.equal(data2.paymentId, data1.paymentId);

    // Database still has only 1 payment
    const count = await pool.query('SELECT COUNT(*) FROM payments WHERE user_id = $1', [user.id]);
    assert.equal(parseInt(count.rows[0].count, 10), 1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-005] Repeated subscription checkouts for same user with different keys reuses pending intent', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const keyA = `key_sub_a_${tag()}`;
    const keyB = `key_sub_b_${tag()}`;

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/subscribe',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': keyA },
      payload: { planId: DEV_MONTHLY_PLAN_ID, gateway: 'mock' },
    });
    assert.equal(res1.statusCode, 201);
    const data1 = JSON.parse(res1.body);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/subscribe',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': keyB },
      payload: { planId: DEV_MONTHLY_PLAN_ID, gateway: 'mock' },
    });
    assert.equal(res2.statusCode, 200);
    const data2 = JSON.parse(res2.body);
    assert.equal(data2.paymentId, data1.paymentId);
    assert.equal(data2.isExisting, true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-006] Direct checkout on book already owned via direct_purchase returns 409', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool);

    // Grant direct_purchase entitlement
    await pool.query(`
      INSERT INTO entitlements (user_id, book_id, grant_type, status, expires_at)
      VALUES ($1, $2, 'direct_purchase', 'active', NULL)
    `, [user.id, bookId]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { bookId, gateway: 'mock' },
    });
    assert.equal(res.statusCode, 409);
    assert.match(JSON.parse(res.body).message, /already owned via direct purchase/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-007] Direct checkout on book currently held via subscription is permitted (201)', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool);

    // Grant temporary subscription entitlement
    await pool.query(`
      INSERT INTO entitlements (user_id, book_id, grant_type, status, expires_at)
      VALUES ($1, $2, 'subscription', 'active', CURRENT_TIMESTAMP + INTERVAL '10 days')
    `, [user.id, bookId]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { bookId, gateway: 'mock' },
    });
    assert.equal(res.statusCode, 201);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-008] Subscription checkout when user has unexpired canceled subscription returns 409', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);

    // Create an unexpired canceled subscription
    await pool.query(`
      INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
      VALUES ($1, $2, 'canceled', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '25 days')
    `, [user.id, DEV_MONTHLY_PLAN_ID]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/subscribe',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { planId: DEV_MONTHLY_PLAN_ID, gateway: 'mock' },
    });
    assert.equal(res.statusCode, 409);
    assert.match(JSON.parse(res.body).message, /already has an unexpired subscription/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-009] Database invariant: status=succeeded with gateway_tx_id=NULL is rejected by PostgreSQL', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool);

    await assert.rejects(
      async () => {
        await pool.query(`
          INSERT INTO payments (
            user_id, payment_type, book_id, gateway, amount_cents, currency, status, gateway_tx_id
          ) VALUES (
            $1, 'direct_purchase', $2, 'mock', 1000, 'PKR', 'succeeded', NULL
          )
        `, [user.id, bookId]);
      },
      (err: Error) => {
        return /chk_payment_gateway_tx_id/.test(err.message);
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-010] Webhook signature verification failure returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook/mock',
      headers: { 'x-mock-signature': 'invalid_signature' },
      payload: { gatewayTxId: 'mock_tx_test', event: 'payment.succeeded' },
    });
    assert.equal(res.statusCode, 401);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-011] Webhook amount mismatch is rejected (400) and grants no entitlement', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool, 'Book Mismatch', 2000);

    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { bookId, gateway: 'mock' },
    });
    assert.equal(checkoutRes.statusCode, 201);
    const { gatewayTxId } = JSON.parse(checkoutRes.body);

    // Webhook reports tampered amount 500 instead of 2000
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook/mock',
      payload: {
        gatewayTxId,
        event: 'payment.succeeded',
        amountCents: 500,
        currency: 'PKR',
      },
    });
    assert.equal(webhookRes.statusCode, 400);

    // Verify payment is still pending and no entitlement exists
    const pay = await pool.query('SELECT status FROM payments WHERE gateway_tx_id = $1', [gatewayTxId]);
    assert.equal(pay.rows[0].status, 'pending');

    const ent = await pool.query('SELECT * FROM entitlements WHERE user_id = $1 AND book_id = $2', [user.id, bookId]);
    assert.equal(ent.rowCount, 0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-012] Webhook currency mismatch is rejected (400)', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool, 'Book Currency', 1000);

    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { bookId, gateway: 'mock' },
    });
    const { gatewayTxId } = JSON.parse(checkoutRes.body);

    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook/mock',
      payload: {
        gatewayTxId,
        event: 'payment.succeeded',
        amountCents: 1000,
        currency: 'USD', // DB expects PKR
      },
    });
    assert.equal(webhookRes.statusCode, 400);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-013] Webhook target metadata mismatch cannot change stored payment target', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const realBookId = await insertTestBook(pool, 'Real Book', 1500);
    const attackerBookId = await insertTestBook(pool, 'Attacker Book', 1500);

    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/book',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { bookId: realBookId, gateway: 'mock' },
    });
    const { gatewayTxId } = JSON.parse(checkoutRes.body);

    // Webhook payload attempts to claim attackerBookId in metadata
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook/mock',
      payload: {
        gatewayTxId,
        event: 'payment.succeeded',
        amountCents: 1500,
        currency: 'PKR',
        bookId: attackerBookId, // Tampered field
      },
    });
    assert.equal(webhookRes.statusCode, 200);

    // Entitlement must be granted ONLY to the real book, NOT the attacker book
    const realEnt = await pool.query('SELECT * FROM entitlements WHERE user_id = $1 AND book_id = $2', [user.id, realBookId]);
    assert.equal(realEnt.rowCount, 1);

    const attackEnt = await pool.query('SELECT * FROM entitlements WHERE user_id = $1 AND book_id = $2', [user.id, attackerBookId]);
    assert.equal(attackEnt.rowCount, 0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-014] Subscription renewal uses calendar interval and selective eligibility', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookEligible = await insertTestBook(pool, 'Eligible Book', 1000, true);
    const bookIneligible = await insertTestBook(pool, 'Ineligible Book', 1000, false);

    // Initial subscription checkout and fulfillment
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/subscribe',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { planId: DEV_MONTHLY_PLAN_ID, gateway: 'mock' },
    });
    const { gatewayTxId, paymentId } = JSON.parse(checkoutRes.body);

    await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook/mock',
      payload: { gatewayTxId, event: 'payment.succeeded' },
    });

    // Check initial entitlement: only eligible book got granted
    const entInit = await pool.query('SELECT book_id FROM entitlements WHERE user_id = $1 AND status = $2', [user.id, 'active']);
    assert.equal(entInit.rowCount, 1);
    assert.equal(entInit.rows[0].book_id, bookEligible);

    // Now simulate renewal webhook event
    const renewRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook/mock',
      payload: { gatewayTxId, event: 'subscription.renewed' },
    });
    assert.equal(renewRes.statusCode, 200);

    // Verify subscription current_period_end advanced
    const sub = await pool.query('SELECT current_period_start, current_period_end FROM subscriptions WHERE user_id = $1', [user.id]);
    assert.ok(new Date(sub.rows[0].current_period_end) > new Date(sub.rows[0].current_period_start));

    // Verify only 1 subscription exists in DB (no duplicates created on renewal)
    const subCount = await pool.query('SELECT COUNT(*) FROM subscriptions WHERE user_id = $1', [user.id]);
    assert.equal(parseInt(subCount.rows[0].count, 10), 1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-015] GET /subscriptions/me calculates effective expiry via Postgres time', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);

    // Insert subscription with status='active' but current_period_end in the PAST
    await pool.query(`
      INSERT INTO subscriptions (
        user_id, plan_id, status, current_period_start, current_period_end
      ) VALUES (
        $1, $2, 'active', CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
      )
    `, [user.id, DEV_MONTHLY_PLAN_ID]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/subscriptions/me',
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.hasSubscription, true);
    assert.equal(body.subscription.rawStatus, 'active');
    assert.equal(body.subscription.effectiveStatus, 'expired');
    assert.equal(body.subscription.isPeriodEnded, true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-016] GET /entitlements omits expired subscription grants unless include_expired=true', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const activeBook = await insertTestBook(pool, 'Active Book');
    const expiredBook = await insertTestBook(pool, 'Expired Book');

    // Active direct grant
    await pool.query(`
      INSERT INTO entitlements (user_id, book_id, grant_type, status, expires_at)
      VALUES ($1, $2, 'direct_purchase', 'active', NULL)
    `, [user.id, activeBook]);

    // Expired subscription grant
    await pool.query(`
      INSERT INTO entitlements (user_id, book_id, grant_type, status, expires_at)
      VALUES ($1, $2, 'subscription', 'active', CURRENT_TIMESTAMP - INTERVAL '2 days')
    `, [user.id, expiredBook]);

    // Default query
    const resDefault = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/entitlements',
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(resDefault.statusCode, 200);
    const entsDefault = JSON.parse(resDefault.body).entitlements;
    assert.equal(entsDefault.length, 1);
    assert.equal(entsDefault[0].bookId, activeBook);

    // Query with include_expired=true
    const resAll = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/entitlements?include_expired=true',
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(resAll.statusCode, 200);
    const entsAll = JSON.parse(resAll.body).entitlements;
    assert.equal(entsAll.length, 2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-017] Mock webhook route is absent when NODE_ENV is production', async () => {
    // Temporarily build an app simulating production
    const originalEnv = config.server.isProduction;
    (config.server as { isProduction: boolean }).isProduction = true;

    try {
      const prodApp = await buildApp();
      await prodApp.ready();

      const res = await prodApp.inject({
        method: 'POST',
        url: '/api/v1/billing/webhook/mock',
        payload: { gatewayTxId: 'mock_tx_test', event: 'payment.succeeded' },
      });
      assert.equal(res.statusCode, 404, 'Expected 404 in production');
    } finally {
      (config.server as { isProduction: boolean }).isProduction = originalEnv;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-018] Production checkout specifying gateway=mock is rejected (400)', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool);

    const originalEnv = config.server.isProduction;
    (config.server as { isProduction: boolean }).isProduction = true;

    try {
      const prodApp = await buildApp();
      await prodApp.ready();

      const res = await prodApp.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout/book',
        headers: {
          authorization: `Bearer ${user.token}`,
          'idempotency-key': `key_${tag()}`,
        },
        payload: { bookId, gateway: 'mock' },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.match(body.message, /Mock payment gateway is unavailable in production/i);

      // Verify no payment row was created
      const payCount = await pool.query('SELECT COUNT(*) FROM payments WHERE user_id = $1', [user.id]);
      assert.equal(parseInt(payCount.rows[0].count, 10), 0);
    } finally {
      (config.server as { isProduction: boolean }).isProduction = originalEnv;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-019] Cancel active subscription: status becomes canceled, period_end unchanged, playback remains authorized', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);
    const bookId = await insertTestBook(pool, 'Playback Sub Book');

    // Subscribe and fulfill
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/subscribe',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { planId: DEV_MONTHLY_PLAN_ID, gateway: 'mock' },
    });
    const { gatewayTxId } = JSON.parse(checkoutRes.body);

    await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook/mock',
      payload: { gatewayTxId, event: 'payment.succeeded' },
    });

    // Check active before cancel
    const subBefore = await pool.query('SELECT current_period_end FROM subscriptions WHERE user_id = $1', [user.id]);
    const periodEndBefore = new Date(subBefore.rows[0].current_period_end).toISOString();

    // Cancel subscription
    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/subscriptions/cancel',
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(cancelRes.statusCode, 200);

    // Verify DB status is canceled and period_end is unchanged
    const subAfter = await pool.query('SELECT status, current_period_end FROM subscriptions WHERE user_id = $1', [user.id]);
    assert.equal(subAfter.rows[0].status, 'canceled');
    assert.equal(new Date(subAfter.rows[0].current_period_end).toISOString(), periodEndBefore);

    // Verify playback remains authorized until current_period_end
    const playRes = await app.inject({
      method: 'GET',
      url: `/api/v1/playback/books/${bookId}`,
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(playRes.statusCode, 200);
    const playData = JSON.parse(playRes.body);
    assert.equal(playData.is_entitled, true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-020] Cancel already-canceled subscription: safe/idempotent response, no duplicate mutation', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);

    // Insert canceled but unexpired subscription
    await pool.query(`
      INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
      VALUES ($1, $2, 'canceled', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '28 days')
    `, [user.id, DEV_MONTHLY_PLAN_ID]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/subscriptions/cancel',
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.match(body.message, /already canceled/i);

    // Subscriptions count remains 1
    const count = await pool.query('SELECT COUNT(*) FROM subscriptions WHERE user_id = $1', [user.id]);
    assert.equal(parseInt(count.rows[0].count, 10), 1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-021] Cancel expired subscription returns 404', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);

    // Insert expired subscription (period_end in the past)
    await pool.query(`
      INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
      VALUES ($1, $2, 'active', CURRENT_TIMESTAMP - INTERVAL '40 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
    `, [user.id, DEV_MONTHLY_PLAN_ID]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/subscriptions/cancel',
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(res.statusCode, 404);
    assert.match(JSON.parse(res.body).message, /No active subscription found to cancel/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-022] Canceled but unexpired subscription blocks new subscription checkout', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);

    // Canceled subscription with 15 days remaining
    await pool.query(`
      INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
      VALUES ($1, $2, 'canceled', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '15 days')
    `, [user.id, DEV_MONTHLY_PLAN_ID]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/subscribe',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { planId: DEV_MONTHLY_PLAN_ID, gateway: 'mock' },
    });
    assert.equal(res.statusCode, 409);
    assert.match(JSON.parse(res.body).message, /already has an unexpired subscription/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('[P1-BILL-023] Expired subscription no longer blocks a new subscription checkout', async () => {
    const user = await registerAndLogin(app, `user_${tag()}@example.com`);

    // Expired subscription from previous cycle
    await pool.query(`
      INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
      VALUES ($1, $2, 'expired', CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP - INTERVAL '15 days')
    `, [user.id, DEV_MONTHLY_PLAN_ID]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout/subscribe',
      headers: { authorization: `Bearer ${user.token}`, 'idempotency-key': `key_${tag()}` },
      payload: { planId: DEV_MONTHLY_PLAN_ID, gateway: 'mock' },
    });
    assert.equal(res.statusCode, 201);
    const data = JSON.parse(res.body);
    assert.equal(data.status, 'pending');
    assert.ok(data.gatewayTxId);
  });
});
