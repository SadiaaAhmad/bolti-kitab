/**
 * Bolti Kitab — Payment Provider Abstraction & Registry
 */

import { config } from '../../../config/env.js';

export interface CreateCheckoutSessionParams {
  idempotencyKey: string;
  userId: string;
  userEmail: string;
  amountCents: number;
  currency: string;
  targetType: 'book' | 'subscription';
  targetId: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  gatewayTxId: string;
  checkoutUrl: string;
}

export interface WebhookEvent {
  gatewayTxId: string;
  eventType: 'payment.succeeded' | 'payment.failed' | 'subscription.renewed' | 'subscription.canceled';
  amountCents?: number | undefined;
  currency?: string | undefined;
  rawEvent?: unknown;
}

export interface PaymentProvider {
  readonly gatewayName: string;
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult>;
  verifyWebhookEvent(rawPayload: unknown, signature?: string): Promise<WebhookEvent>;
}

const providerRegistry = new Map<string, PaymentProvider>();

export function registerPaymentProvider(provider: PaymentProvider): void {
  providerRegistry.set(provider.gatewayName.toLowerCase(), provider);
}

export function getPaymentProvider(gateway: string): PaymentProvider {
  const normalized = gateway.toLowerCase();

  // Strict production check: mock provider must never be reachable in production
  if (config.server.isProduction && normalized === 'mock') {
    const err = new Error('Mock payment gateway is unavailable in production.') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const provider = providerRegistry.get(normalized);
  if (!provider) {
    const err = new Error(`Unsupported or unconfigured payment gateway: ${gateway}`) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  return provider;
}

export function clearProviderRegistryForTesting(): void {
  providerRegistry.clear();
}
