/**
 * Bolti Kitab — Mock Payment Provider
 *
 * Used exclusively for local development and automated testing.
 * Honors idempotencyKey by caching created sessions so retries return identical sessions.
 */

import { randomUUID } from 'crypto';
import type {
  PaymentProvider,
  CreateCheckoutSessionParams,
  CheckoutSessionResult,
  WebhookEvent,
} from './payment-provider.js';

interface CachedSession {
  gatewayTxId: string;
  checkoutUrl: string;
  params: CreateCheckoutSessionParams;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly gatewayName = 'mock';

  private sessionCache = new Map<string, CachedSession>();

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
    const existing = this.sessionCache.get(params.idempotencyKey);
    if (existing) {
      return {
        gatewayTxId: existing.gatewayTxId,
        checkoutUrl: existing.checkoutUrl,
      };
    }

    const gatewayTxId = `mock_tx_${randomUUID().replace(/-/g, '')}`;
    const checkoutUrl = `https://mock-gateway.bolti-kitab.local/pay/${gatewayTxId}`;

    const session: CachedSession = {
      gatewayTxId,
      checkoutUrl,
      params,
    };

    this.sessionCache.set(params.idempotencyKey, session);

    return {
      gatewayTxId,
      checkoutUrl,
    };
  }

  async verifyWebhookEvent(rawPayload: unknown, signature?: string): Promise<WebhookEvent> {
    if (signature === 'invalid_signature') {
      const err = new Error('Invalid mock webhook signature.') as Error & { statusCode?: number };
      err.statusCode = 401;
      throw err;
    }

    let payload: Record<string, unknown>;
    if (typeof rawPayload === 'string') {
      try {
        payload = JSON.parse(rawPayload);
      } catch {
        const err = new Error('Malformed webhook payload.') as Error & { statusCode?: number };
        err.statusCode = 400;
        throw err;
      }
    } else if (typeof rawPayload === 'object' && rawPayload !== null) {
      payload = rawPayload as Record<string, unknown>;
    } else {
      const err = new Error('Invalid webhook payload format.') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    const gatewayTxId = payload.gatewayTxId as string | undefined;
    const eventType = (payload.event || payload.eventType) as WebhookEvent['eventType'] | undefined;

    if (!gatewayTxId || !eventType) {
      const err = new Error('Webhook payload missing gatewayTxId or event.') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    return {
      gatewayTxId,
      eventType,
      amountCents: typeof payload.amountCents === 'number' ? payload.amountCents : undefined,
      currency: typeof payload.currency === 'string' ? payload.currency : undefined,
      rawEvent: payload,
    };
  }

  clearCache(): void {
    this.sessionCache.clear();
  }
}
