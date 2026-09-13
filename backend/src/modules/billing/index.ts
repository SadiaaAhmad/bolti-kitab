/**
 * Billing Module — Phase 1 Sprint 3
 *
 * Planned implementation:
 *   - POST /api/v1/billing/checkout/book      — Initiate direct purchase
 *   - POST /api/v1/billing/checkout/subscribe — Initiate subscription checkout
 *   - POST /api/v1/billing/webhook/stripe     — Stripe webhook ingestion
 *   - POST /api/v1/billing/webhook/jazzcash   — JazzCash webhook ingestion
 *   - POST /api/v1/billing/webhook/easypaisa  — EasyPaisa webhook ingestion
 *   - GET  /api/v1/billing/entitlements       — User's active entitlements
 *
 * Webhook idempotency guaranteed by UNIQUE(gateway_tx_id) on payments table.
 * Entitlement upsert: ON CONFLICT (user_id, book_id, grant_type) DO UPDATE.
 *
 * Do NOT implement until Sprint 3 is formally started.
 */

export {};
