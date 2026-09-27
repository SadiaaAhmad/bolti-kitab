/**
 * Bolti Kitab — Billing Repository
 *
 * Parameterized PostgreSQL queries for payments, idempotency intents,
 * subscriptions, concurrency locks, and selective catalog entitlements.
 */

import pg from 'pg';
import { pool, withTransaction } from '../../db/pool.js';
import type {
  PaymentRecord,
  SubscriptionRecord,
  SubscriptionPlanRecord,
  EntitlementRecord,
  PaymentGateway,
  PaymentType,
} from './types.js';

export interface UserSubscriptionDbRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'expired';
  gateway_subscription_id: string | null;
  current_period_start: Date;
  current_period_end: Date;
  plan_name: string;
  billing_interval: 'monthly' | 'annual';
  price_cents: number;
  currency: string;
  is_period_ended: boolean;
}

export interface UserEntitlementDbRow {
  id: string;
  book_id: string;
  grant_type: 'subscription' | 'direct_purchase' | 'promotional';
  status: 'active' | 'revoked' | 'expired';
  expires_at: Date | null;
  created_at: Date;
  title: string;
  title_urdu: string | null;
}

// ─── Concurrency: User-Row Lock ───────────────────────────────────────────────
export async function lockUserForBilling(client: pg.PoolClient, userId: string): Promise<void> {
  const sql = `SELECT id FROM users WHERE id = $1 FOR UPDATE`;
  const res = await client.query(sql, [userId]);
  if (res.rowCount === 0) {
    const err = new Error('User not found.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
}

// ─── Idempotency & Intent Lookups ─────────────────────────────────────────────
export async function findPaymentByIdempotencyKey(
  key: string,
  client?: pg.PoolClient,
): Promise<PaymentRecord | null> {
  const sql = `SELECT * FROM payments WHERE idempotency_key = $1 LIMIT 1`;
  const executor = client ?? pool;
  const res = await executor.query<PaymentRecord>(sql, [key]);
  return res.rows[0] ?? null;
}

export async function findPendingPaymentForBook(
  userId: string,
  bookId: string,
  client?: pg.PoolClient,
): Promise<PaymentRecord | null> {
  const sql = `
    SELECT * FROM payments
    WHERE user_id = $1
      AND book_id = $2
      AND payment_type = 'direct_purchase'
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const executor = client ?? pool;
  const res = await executor.query<PaymentRecord>(sql, [userId, bookId]);
  return res.rows[0] ?? null;
}

export async function findPendingPaymentForSubscription(
  userId: string,
  client?: pg.PoolClient,
): Promise<PaymentRecord | null> {
  const sql = `
    SELECT * FROM payments
    WHERE user_id = $1
      AND payment_type = 'subscription'
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const executor = client ?? pool;
  const res = await executor.query<PaymentRecord>(sql, [userId]);
  return res.rows[0] ?? null;
}

export async function findDirectPurchaseEntitlement(
  userId: string,
  bookId: string,
  client?: pg.PoolClient,
): Promise<EntitlementRecord | null> {
  const sql = `
    SELECT * FROM entitlements
    WHERE user_id = $1
      AND book_id = $2
      AND grant_type = 'direct_purchase'
      AND status = 'active'
    LIMIT 1
  `;
  const executor = client ?? pool;
  const res = await executor.query<EntitlementRecord>(sql, [userId, bookId]);
  return res.rows[0] ?? null;
}

export async function findUnexpiredSubscription(
  userId: string,
  client?: pg.PoolClient,
): Promise<SubscriptionRecord | null> {
  const sql = `
    SELECT * FROM subscriptions
    WHERE user_id = $1
      AND current_period_end > CURRENT_TIMESTAMP
    ORDER BY current_period_end DESC
    LIMIT 1
  `;
  const executor = client ?? pool;
  const res = await executor.query<SubscriptionRecord>(sql, [userId]);
  return res.rows[0] ?? null;
}

export async function expireStaleSubscriptions(client: pg.PoolClient, userId: string): Promise<void> {
  const sql = `
    UPDATE subscriptions
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND status IN ('active', 'past_due')
      AND current_period_end <= CURRENT_TIMESTAMP
  `;
  await client.query(sql, [userId]);
}

// ─── Intent Reservation & Updates ─────────────────────────────────────────────
export async function insertPendingPayment(
  client: pg.PoolClient,
  params: {
    userId: string;
    paymentType: PaymentType;
    bookId: string | null;
    planId: string | null;
    gateway: PaymentGateway;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
  },
): Promise<PaymentRecord> {
  const sql = `
    INSERT INTO payments (
      user_id, payment_type, book_id, plan_id, gateway,
      amount_cents, currency, status, idempotency_key, gateway_tx_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, NULL)
    RETURNING *
  `;
  const res = await client.query<PaymentRecord>(sql, [
    params.userId,
    params.paymentType,
    params.bookId,
    params.planId,
    params.gateway,
    params.amountCents,
    params.currency,
    params.idempotencyKey,
  ]);
  const row = res.rows[0];
  if (!row) throw new Error('Failed to insert pending payment');
  return row;
}

export async function updatePaymentGatewayTxId(
  paymentId: string,
  gatewayTxId: string,
  client?: pg.PoolClient,
): Promise<PaymentRecord> {
  const sql = `
    UPDATE payments
    SET gateway_tx_id = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const executor = client ?? pool;
  const res = await executor.query<PaymentRecord>(sql, [gatewayTxId, paymentId]);
  const row = res.rows[0];
  if (!row) throw new Error('Failed to update payment gateway_tx_id');
  return row;
}

export async function findPaymentByGatewayTxIdForUpdate(
  client: pg.PoolClient,
  gatewayTxId: string,
): Promise<PaymentRecord | null> {
  const sql = `SELECT * FROM payments WHERE gateway_tx_id = $1 FOR UPDATE`;
  const res = await client.query<PaymentRecord>(sql, [gatewayTxId]);
  return res.rows[0] ?? null;
}

// ─── Catalog & Plan Lookups ───────────────────────────────────────────────────
export async function findBookForPurchase(bookId: string): Promise<{
  id: string;
  title: string;
  price_cents: number;
  currency: string;
  status: string;
} | null> {
  const sql = `SELECT id, title, price_cents, currency, status FROM books WHERE id = $1 LIMIT 1`;
  const res = await pool.query(sql, [bookId]);
  return res.rows[0] ?? null;
}

export async function findPlanForPurchase(planId: string): Promise<SubscriptionPlanRecord | null> {
  const sql = `SELECT * FROM subscription_plans WHERE id = $1 AND is_active = TRUE LIMIT 1`;
  const res = await pool.query<SubscriptionPlanRecord>(sql, [planId]);
  return res.rows[0] ?? null;
}

export async function findSubscriptionById(subscriptionId: string): Promise<SubscriptionRecord | null> {
  const sql = `SELECT * FROM subscriptions WHERE id = $1 LIMIT 1`;
  const res = await pool.query<SubscriptionRecord>(sql, [subscriptionId]);
  return res.rows[0] ?? null;
}

// ─── Fulfillment: Direct Purchase ─────────────────────────────────────────────
export async function fulfillDirectPurchase(
  client: pg.PoolClient,
  paymentId: string,
  userId: string,
  bookId: string,
): Promise<PaymentRecord> {
  // 1. Mark payment succeeded
  const paySql = `
    UPDATE payments
    SET status = 'succeeded', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  const payRes = await client.query<PaymentRecord>(paySql, [paymentId]);

  // 2. Upsert direct_purchase entitlement with lifetime grant (expires_at = NULL)
  const entSql = `
    INSERT INTO entitlements (user_id, book_id, grant_type, status, expires_at)
    VALUES ($1, $2, 'direct_purchase', 'active', NULL)
    ON CONFLICT (user_id, book_id, grant_type)
    DO UPDATE SET status = 'active', expires_at = NULL, updated_at = CURRENT_TIMESTAMP
  `;
  await client.query(entSql, [userId, bookId]);

  const row = payRes.rows[0];
  if (!row) throw new Error('Failed to fulfill payment');
  return row;
}

// ─── Fulfillment: New Subscription ────────────────────────────────────────────
export async function fulfillSubscription(
  client: pg.PoolClient,
  paymentId: string,
  userId: string,
  planId: string,
  billingInterval: 'monthly' | 'annual',
): Promise<{ payment: PaymentRecord; subscription: SubscriptionRecord }> {
  // 1. Create subscription using true calendar interval
  const intervalSql = billingInterval === 'monthly' ? "INTERVAL '1 month'" : "INTERVAL '1 year'";
  const subSql = `
    INSERT INTO subscriptions (
      user_id, plan_id, status, gateway_subscription_id, current_period_start, current_period_end
    ) VALUES (
      $1, $2, 'active', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ${intervalSql}
    )
    RETURNING *
  `;
  const subRes = await client.query<SubscriptionRecord>(subSql, [userId, planId]);
  const subscription = subRes.rows[0];
  if (!subscription) throw new Error('Failed to create subscription');

  // 2. Update payment with subscription_id and status succeeded
  const paySql = `
    UPDATE payments
    SET status = 'succeeded', subscription_id = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const payRes = await client.query<PaymentRecord>(paySql, [subscription.id, paymentId]);
  const payment = payRes.rows[0];
  if (!payment) throw new Error('Failed to update subscription payment');

  // 3. Selective entitlement materialization: published, active, subscription-eligible books
  const entSql = `
    INSERT INTO entitlements (user_id, book_id, grant_type, status, expires_at)
    SELECT $1, b.id, 'subscription', 'active', $2
    FROM books b
    WHERE b.status = 'active' AND b.is_subscription_eligible = TRUE
    ON CONFLICT (user_id, book_id, grant_type)
    DO UPDATE SET
      expires_at = EXCLUDED.expires_at,
      status = 'active',
      updated_at = CURRENT_TIMESTAMP
  `;
  await client.query(entSql, [userId, subscription.current_period_end]);

  return { payment, subscription };
}

// ─── Fulfillment: Subscription Renewal ────────────────────────────────────────
export async function fulfillSubscriptionRenewal(
  client: pg.PoolClient,
  subscriptionId: string,
  paymentId: string,
  billingInterval: 'monthly' | 'annual',
): Promise<{ payment: PaymentRecord; subscription: SubscriptionRecord }> {
  // 1. Advance period in-place using true calendar interval
  const intervalSql = billingInterval === 'monthly' ? "INTERVAL '1 month'" : "INTERVAL '1 year'";
  const subSql = `
    UPDATE subscriptions
    SET current_period_start = current_period_end,
        current_period_end = current_period_end + ${intervalSql},
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  const subRes = await client.query<SubscriptionRecord>(subSql, [subscriptionId]);
  const subscription = subRes.rows[0];
  if (!subscription) throw new Error('Failed to renew subscription');

  // 2. Mark renewal payment succeeded
  const paySql = `
    UPDATE payments
    SET status = 'succeeded', subscription_id = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const payRes = await client.query<PaymentRecord>(paySql, [subscription.id, paymentId]);
  const payment = payRes.rows[0];
  if (!payment) throw new Error('Failed to update renewal payment');

  // 3. Upsert/extend active eligible books
  const entSql = `
    INSERT INTO entitlements (user_id, book_id, grant_type, status, expires_at)
    SELECT $1, b.id, 'subscription', 'active', $2
    FROM books b
    WHERE b.status = 'active' AND b.is_subscription_eligible = TRUE
    ON CONFLICT (user_id, book_id, grant_type)
    DO UPDATE SET
      expires_at = EXCLUDED.expires_at,
      status = 'active',
      updated_at = CURRENT_TIMESTAMP
  `;
  await client.query(entSql, [subscription.user_id, subscription.current_period_end]);

  // 4. Expire subscription entitlements for books that are no longer eligible or active
  const expireSql = `
    UPDATE entitlements
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND grant_type = 'subscription'
      AND book_id NOT IN (
        SELECT id FROM books WHERE status = 'active' AND is_subscription_eligible = TRUE
      )
  `;
  await client.query(expireSql, [subscription.user_id]);

  return { payment, subscription };
}

// ─── Cancellation ─────────────────────────────────────────────────────────────
export async function cancelUserSubscription(userId: string): Promise<SubscriptionRecord | null> {
  const sql = `
    UPDATE subscriptions
    SET status = 'canceled', updated_at = CURRENT_TIMESTAMP
    WHERE id = (
      SELECT id FROM subscriptions
      WHERE user_id = $1
        AND status IN ('active', 'past_due')
        AND current_period_end > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    )
    RETURNING *
  `;
  const res = await pool.query<SubscriptionRecord>(sql, [userId]);
  return res.rows[0] ?? null;
}

// ─── Query Endpoints ──────────────────────────────────────────────────────────
export async function getUserSubscription(userId: string): Promise<UserSubscriptionDbRow | null> {
  const sql = `
    SELECT
      s.id, s.user_id, s.plan_id, s.status, s.gateway_subscription_id,
      s.current_period_start, s.current_period_end,
      p.name AS plan_name, p.billing_interval, p.price_cents, p.currency,
      (s.current_period_end <= CURRENT_TIMESTAMP) AS is_period_ended
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = $1
    ORDER BY s.created_at DESC
    LIMIT 1
  `;
  const res = await pool.query<UserSubscriptionDbRow>(sql, [userId]);
  return res.rows[0] ?? null;
}

export async function getUserEntitlements(
  userId: string,
  includeExpired: boolean,
): Promise<UserEntitlementDbRow[]> {
  const sql = `
    SELECT
      e.id, e.book_id, e.grant_type, e.status, e.expires_at, e.created_at,
      b.title, b.title_urdu
    FROM entitlements e
    JOIN books b ON e.book_id = b.id
    WHERE e.user_id = $1
      AND (
        $2 = TRUE OR
        (e.status = 'active' AND (e.expires_at IS NULL OR e.expires_at > CURRENT_TIMESTAMP))
      )
    ORDER BY e.created_at DESC
  `;
  const res = await pool.query<UserEntitlementDbRow>(sql, [userId, includeExpired]);
  return res.rows;
}
