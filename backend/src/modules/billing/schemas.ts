/**
 * Bolti Kitab — Billing Route Schemas
 */

export const checkoutBookBodySchema = {
  type: 'object',
  required: ['bookId', 'gateway'],
  properties: {
    bookId: { type: 'string', format: 'uuid' },
    gateway: { type: 'string', enum: ['stripe', 'jazzcash', 'easypaisa', 'manual', 'mock'] },
  },
  additionalProperties: false,
} as const;

export const checkoutSubscriptionBodySchema = {
  type: 'object',
  required: ['planId', 'gateway'],
  properties: {
    planId: { type: 'string', format: 'uuid' },
    gateway: { type: 'string', enum: ['stripe', 'jazzcash', 'easypaisa', 'manual', 'mock'] },
  },
  additionalProperties: false,
} as const;

export const checkoutSessionResponseSchema = {
  type: 'object',
  properties: {
    paymentId: { type: 'string' },
    gatewayTxId: { type: 'string' },
    checkoutUrl: { type: 'string' },
    amountCents: { type: 'integer' },
    currency: { type: 'string' },
    status: { type: 'string' },
    isExisting: { type: 'boolean' },
  },
} as const;

export const subscriptionMeResponseSchema = {
  type: 'object',
  properties: {
    hasSubscription: { type: 'boolean' },
    subscription: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
            planId: { type: 'string' },
            planName: { type: 'string' },
            billingInterval: { type: 'string' },
            priceCents: { type: 'integer' },
            currency: { type: 'string' },
            rawStatus: { type: 'string' },
            effectiveStatus: { type: 'string' },
            currentPeriodStart: { type: 'string' },
            currentPeriodEnd: { type: 'string' },
            isPeriodEnded: { type: 'boolean' },
          },
        },
      ],
    },
  },
} as const;

export const entitlementsQuerySchema = {
  type: 'object',
  properties: {
    include_expired: { type: 'string' },
  },
} as const;

export const mockWebhookBodySchema = {
  type: 'object',
  required: ['gatewayTxId', 'event'],
  properties: {
    gatewayTxId: { type: 'string' },
    event: { type: 'string' },
    amountCents: { type: 'integer' },
    currency: { type: 'string' },
  },
  additionalProperties: true,
} as const;
