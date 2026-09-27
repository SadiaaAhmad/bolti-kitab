/**
 * Bolti Kitab — Billing Service
 *
 * Coordinates checkout sessions, application-level idempotency checks,
 * user-row locking for concurrency control, webhook fulfillment with
 * strict amount/currency verification, and effective subscription expiry.
 */

import { withTransaction } from '../../db/pool.js';
import * as repo from './repository.js';
import { getPaymentProvider } from './providers/payment-provider.js';
import type {
  CheckoutBookInput,
  CheckoutSubscriptionInput,
  CheckoutSessionResponse,
  SubscriptionMeResponse,
  EntitlementDto,
  PaymentRecord,
} from './types.js';

function validateIdempotencyMatch(
  existing: PaymentRecord,
  expected: {
    paymentType: 'direct_purchase' | 'subscription';
    bookId: string | null;
    planId: string | null;
    gateway: string;
    amountCents: number;
    currency: string;
  },
): void {
  const matches =
    existing.payment_type === expected.paymentType &&
    existing.book_id === expected.bookId &&
    existing.plan_id === expected.planId &&
    existing.gateway === expected.gateway &&
    existing.amount_cents === expected.amountCents &&
    existing.currency === expected.currency;

  if (!matches) {
    const err = new Error(
      'Idempotency-Key has already been used for a different request',
    ) as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }
}

// ─── Direct Book Checkout ─────────────────────────────────────────────────────
export async function checkoutBook(
  userId: string,
  userEmail: string,
  input: CheckoutBookInput,
): Promise<CheckoutSessionResponse> {
  if (!input.idempotencyKey || typeof input.idempotencyKey !== 'string' || input.idempotencyKey.trim().length === 0) {
    const err = new Error("Header 'Idempotency-Key' is required for checkout.") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  const cleanIdempotencyKey = input.idempotencyKey.trim();

  // Validate gateway & provider availability (rejects mock in production)
  const provider = getPaymentProvider(input.gateway);

  // Validate book exists and is published
  const book = await repo.findBookForPurchase(input.bookId);
  if (!book) {
    const err = new Error('Book not found.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  if (book.status !== 'active') {
    const err = new Error('Book is not published for sale.') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  // Phase 1: Short DB Transaction to serialize user billing and reserve intent
  let paymentRecord: PaymentRecord | null = null;
  let isExisting = false;

  await withTransaction(async (client) => {
    // 1. Serialize billing operations for this user
    await repo.lockUserForBilling(client, userId);

    // 2. Check if Idempotency-Key already exists
    const existingByKey = await repo.findPaymentByIdempotencyKey(cleanIdempotencyKey, client);
    if (existingByKey) {
      validateIdempotencyMatch(existingByKey, {
        paymentType: 'direct_purchase',
        bookId: book.id,
        planId: null,
        gateway: input.gateway,
        amountCents: book.price_cents,
        currency: book.currency,
      });
      paymentRecord = existingByKey;
      isExisting = true;
      return;
    }

    // 3. Check if user already owns lifetime direct purchase
    const owned = await repo.findDirectPurchaseEntitlement(userId, book.id, client);
    if (owned) {
      const err = new Error('Book is already owned via direct purchase.') as Error & { statusCode?: number };
      err.statusCode = 409;
      throw err;
    }

    // 4. Check if a pending payment intent already exists for this user + book (e.g. double click with different keys)
    const pendingIntent = await repo.findPendingPaymentForBook(userId, book.id, client);
    if (pendingIntent) {
      paymentRecord = pendingIntent;
      isExisting = true;
      return;
    }

    // 5. Reserve new pending payment intent
    paymentRecord = await repo.insertPendingPayment(client, {
      userId,
      paymentType: 'direct_purchase',
      bookId: book.id,
      planId: null,
      gateway: input.gateway,
      amountCents: book.price_cents,
      currency: book.currency,
      idempotencyKey: cleanIdempotencyKey,
    });
  });

  const payment = paymentRecord!;

  // Phase 2: Outside DB Transaction — call provider or return existing session
  let gatewayTxId = payment.gateway_tx_id;
  let checkoutUrl = '';

  if (gatewayTxId) {
    checkoutUrl = `https://${input.gateway}-gateway.bolti-kitab.local/pay/${gatewayTxId}`;
  } else {
    // Call provider with mandatory idempotencyKey
    const session = await provider.createCheckoutSession({
      idempotencyKey: payment.idempotency_key || cleanIdempotencyKey,
      userId,
      userEmail,
      amountCents: payment.amount_cents,
      currency: payment.currency,
      targetType: 'book',
      targetId: book.id,
      metadata: { bookTitle: book.title },
    });

    gatewayTxId = session.gatewayTxId;
    checkoutUrl = session.checkoutUrl;

    // Update payment record with assigned gateway_tx_id
    await repo.updatePaymentGatewayTxId(payment.id, gatewayTxId);
  }

  return {
    paymentId: payment.id,
    gatewayTxId,
    checkoutUrl,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    status: payment.status,
    isExisting,
  };
}

// ─── Subscription Checkout ────────────────────────────────────────────────────
export async function checkoutSubscription(
  userId: string,
  userEmail: string,
  input: CheckoutSubscriptionInput,
): Promise<CheckoutSessionResponse> {
  if (!input.idempotencyKey || typeof input.idempotencyKey !== 'string' || input.idempotencyKey.trim().length === 0) {
    const err = new Error("Header 'Idempotency-Key' is required for checkout.") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  const cleanIdempotencyKey = input.idempotencyKey.trim();

  // Validate gateway & provider availability (rejects mock in production)
  const provider = getPaymentProvider(input.gateway);

  // Validate plan exists and is active
  const plan = await repo.findPlanForPurchase(input.planId);
  if (!plan) {
    const err = new Error('Subscription plan not found or inactive.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Phase 1: Short DB Transaction to serialize user billing and reserve intent
  let paymentRecord: PaymentRecord | null = null;
  let isExisting = false;

  await withTransaction(async (client) => {
    // 1. Serialize billing operations for this user
    await repo.lockUserForBilling(client, userId);

    // 2. Check if Idempotency-Key already exists
    const existingByKey = await repo.findPaymentByIdempotencyKey(cleanIdempotencyKey, client);
    if (existingByKey) {
      validateIdempotencyMatch(existingByKey, {
        paymentType: 'subscription',
        bookId: null,
        planId: plan.id,
        gateway: input.gateway,
        amountCents: plan.price_cents,
        currency: plan.currency,
      });
      paymentRecord = existingByKey;
      isExisting = true;
      return;
    }

    // 3. Mark any past-due or expired subscriptions that elapsed as 'expired'
    await repo.expireStaleSubscriptions(client, userId);

    // 4. Check for any unexpired subscription (active, past_due, or canceled with remaining time)
    const unexpired = await repo.findUnexpiredSubscription(userId, client);
    if (unexpired) {
      const err = new Error(
        `User already has an unexpired subscription ending at ${unexpired.current_period_end.toISOString()}. Cannot create a new subscription until the current period expires.`,
      ) as Error & { statusCode?: number };
      err.statusCode = 409;
      throw err;
    }

    // 5. Check if a pending subscription checkout already exists (e.g. double click with different keys)
    const pendingIntent = await repo.findPendingPaymentForSubscription(userId, client);
    if (pendingIntent) {
      paymentRecord = pendingIntent;
      isExisting = true;
      return;
    }

    // 6. Reserve new pending payment intent
    paymentRecord = await repo.insertPendingPayment(client, {
      userId,
      paymentType: 'subscription',
      bookId: null,
      planId: plan.id,
      gateway: input.gateway,
      amountCents: plan.price_cents,
      currency: plan.currency,
      idempotencyKey: cleanIdempotencyKey,
    });
  });

  const payment = paymentRecord!;

  // Phase 2: Outside DB Transaction — call provider or return existing session
  let gatewayTxId = payment.gateway_tx_id;
  let checkoutUrl = '';

  if (gatewayTxId) {
    checkoutUrl = `https://${input.gateway}-gateway.bolti-kitab.local/pay/${gatewayTxId}`;
  } else {
    const session = await provider.createCheckoutSession({
      idempotencyKey: payment.idempotency_key || cleanIdempotencyKey,
      userId,
      userEmail,
      amountCents: payment.amount_cents,
      currency: payment.currency,
      targetType: 'subscription',
      targetId: plan.id,
      metadata: { planName: plan.name },
    });

    gatewayTxId = session.gatewayTxId;
    checkoutUrl = session.checkoutUrl;

    await repo.updatePaymentGatewayTxId(payment.id, gatewayTxId);
  }

  return {
    paymentId: payment.id,
    gatewayTxId,
    checkoutUrl,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    status: payment.status,
    isExisting,
  };
}

// ─── Webhook Ingestion & Fulfillment ──────────────────────────────────────────
export async function handleWebhook(
  gateway: string,
  rawPayload: unknown,
  signature?: string,
): Promise<{ received: boolean; status: string }> {
  const provider = getPaymentProvider(gateway);
  const event = await provider.verifyWebhookEvent(rawPayload, signature);

  return await withTransaction(async (client) => {
    // 1. Locate and lock stored payment record
    const payment = await repo.findPaymentByGatewayTxIdForUpdate(client, event.gatewayTxId);
    if (!payment) {
      return { received: true, status: 'payment_not_found' };
    }

    // 2. Idempotency: skip if already succeeded
    if (payment.status === 'succeeded') {
      return { received: true, status: 'already_processed' };
    }

    // 3. Security Boundary: Strict Amount and Currency Verification
    if (event.amountCents !== undefined && event.amountCents !== payment.amount_cents) {
      const err = new Error(
        `Payment amount mismatch: stored=${payment.amount_cents}, webhook=${event.amountCents}`,
      ) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }
    if (event.currency !== undefined && event.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      const err = new Error(
        `Payment currency mismatch: stored=${payment.currency}, webhook=${event.currency}`,
      ) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    // 4. Fulfillment according to stored database targets strictly
    if (event.eventType === 'payment.succeeded') {
      if (payment.payment_type === 'direct_purchase' && payment.book_id) {
        await repo.fulfillDirectPurchase(client, payment.id, payment.user_id, payment.book_id);
        return { received: true, status: 'direct_purchase_fulfilled' };
      }

      if (payment.payment_type === 'subscription' && payment.plan_id) {
        const plan = await repo.findPlanForPurchase(payment.plan_id);
        if (!plan) {
          const err = new Error('Bound subscription plan not found.') as Error & { statusCode?: number };
          err.statusCode = 404;
          throw err;
        }

        await repo.expireStaleSubscriptions(client, payment.user_id);
        await repo.fulfillSubscription(
          client,
          payment.id,
          payment.user_id,
          payment.plan_id,
          plan.billing_interval,
        );
        return { received: true, status: 'subscription_fulfilled' };
      }
    }

    if (event.eventType === 'subscription.renewed' && payment.subscription_id) {
      const plan = await repo.findPlanForPurchase(payment.plan_id!);
      if (!plan) {
        const err = new Error('Bound subscription plan not found.') as Error & { statusCode?: number };
        err.statusCode = 404;
        throw err;
      }

      await repo.fulfillSubscriptionRenewal(
        client,
        payment.subscription_id,
        payment.id,
        plan.billing_interval,
      );
      return { received: true, status: 'subscription_renewed' };
    }

    if (event.eventType === 'payment.failed') {
      await client.query(`UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        payment.id,
      ]);
      return { received: true, status: 'payment_failed' };
    }

    return { received: true, status: 'unhandled_event' };
  });
}

// ─── Query Endpoints ──────────────────────────────────────────────────────────
export async function getMySubscription(userId: string): Promise<SubscriptionMeResponse> {
  const sub = await repo.getUserSubscription(userId);
  if (!sub) {
    return { hasSubscription: false, subscription: null };
  }

  // Calculate effective status using PostgreSQL server time
  let effectiveStatus: 'active' | 'past_due' | 'canceled' | 'expired';
  if (sub.is_period_ended) {
    effectiveStatus = 'expired';
  } else {
    effectiveStatus = sub.status;
  }

  return {
    hasSubscription: true,
    subscription: {
      id: sub.id,
      planId: sub.plan_id,
      planName: sub.plan_name,
      billingInterval: sub.billing_interval,
      priceCents: sub.price_cents,
      currency: sub.currency,
      rawStatus: sub.status,
      effectiveStatus,
      currentPeriodStart: sub.current_period_start.toISOString(),
      currentPeriodEnd: sub.current_period_end.toISOString(),
      isPeriodEnded: sub.is_period_ended,
    },
  };
}

export async function cancelMySubscription(userId: string): Promise<{ success: boolean; message: string }> {
  const canceled = await repo.cancelUserSubscription(userId);
  if (canceled) {
    return {
      success: true,
      message: `Subscription canceled. Access remains active until ${canceled.current_period_end.toISOString()}.`,
    };
  }

  const unexpired = await repo.findUnexpiredSubscription(userId);
  if (unexpired && unexpired.status === 'canceled') {
    return {
      success: true,
      message: `Subscription is already canceled. Access remains active until ${unexpired.current_period_end.toISOString()}.`,
    };
  }

  const err = new Error('No active subscription found to cancel.') as Error & { statusCode?: number };
  err.statusCode = 404;
  throw err;
}

export async function getMyEntitlements(
  userId: string,
  includeExpired = false,
): Promise<EntitlementDto[]> {
  const rows = await repo.getUserEntitlements(userId, includeExpired);
  return rows.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    title: r.title,
    titleUrdu: r.title_urdu,
    grantType: r.grant_type,
    status: r.status,
    expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
    isLifetime: r.grant_type === 'direct_purchase' || r.expires_at === null,
    createdAt: r.created_at.toISOString(),
  }));
}
