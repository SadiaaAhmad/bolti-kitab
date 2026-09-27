/**
 * Bolti Kitab — Billing Domain Types
 */

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type PaymentType = 'direct_purchase' | 'subscription';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired';
export type EffectiveSubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired';
export type PaymentGateway = 'stripe' | 'jazzcash' | 'easypaisa' | 'manual' | 'mock';
export type GrantType = 'subscription' | 'direct_purchase' | 'promotional';
export type EntitlementStatus = 'active' | 'revoked' | 'expired';

export interface PaymentRecord {
  id: string;
  user_id: string;
  payment_type: PaymentType;
  book_id: string | null;
  plan_id: string | null;
  subscription_id: string | null;
  gateway: PaymentGateway;
  gateway_tx_id: string | null;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionPlanRecord {
  id: string;
  name: string;
  billing_interval: 'monthly' | 'annual';
  price_cents: number;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  gateway_subscription_id: string | null;
  current_period_start: Date;
  current_period_end: Date;
  created_at: Date;
  updated_at: Date;
}

export interface EntitlementRecord {
  id: string;
  user_id: string;
  book_id: string;
  grant_type: GrantType;
  status: EntitlementStatus;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CheckoutBookInput {
  bookId: string;
  gateway: PaymentGateway;
  idempotencyKey: string;
}

export interface CheckoutSubscriptionInput {
  planId: string;
  gateway: PaymentGateway;
  idempotencyKey: string;
}

export interface CheckoutSessionResponse {
  paymentId: string;
  gatewayTxId: string;
  checkoutUrl: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  isExisting: boolean;
}

export interface SubscriptionMeResponse {
  hasSubscription: boolean;
  subscription: {
    id: string;
    planId: string;
    planName: string;
    billingInterval: 'monthly' | 'annual';
    priceCents: number;
    currency: string;
    rawStatus: SubscriptionStatus;
    effectiveStatus: EffectiveSubscriptionStatus;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    isPeriodEnded: boolean;
  } | null;
}

export interface EntitlementDto {
  id: string;
  bookId: string;
  title: string;
  titleUrdu: string | null;
  grantType: GrantType;
  status: EntitlementStatus;
  expiresAt: string | null;
  isLifetime: boolean;
  createdAt: string;
}
