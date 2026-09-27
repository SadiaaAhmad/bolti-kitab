-- ==============================================================================
-- Bolti Kitab (بولتی کتاب) — Phase 1 Backend Architecture
-- Migration: 002_billing_architecture.down.sql
-- Description: Reverts migration 002_billing_architecture.sql
-- ==============================================================================

DROP INDEX IF EXISTS idx_books_subscription_eligible;
ALTER TABLE books DROP COLUMN IF EXISTS is_subscription_eligible;

DROP INDEX IF EXISTS uq_subscriptions_one_active_per_user;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_gateway_check;
ALTER TABLE payments ADD CONSTRAINT payments_gateway_check
    CHECK (gateway IN ('stripe', 'jazzcash', 'easypaisa', 'manual'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payment_gateway_tx_id;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payment_target;
ALTER TABLE payments ADD CONSTRAINT chk_payment_target CHECK (
    (payment_type = 'direct_purchase' AND book_id IS NOT NULL AND subscription_id IS NULL) OR
    (payment_type = 'subscription' AND subscription_id IS NOT NULL AND book_id IS NULL)
);

ALTER TABLE payments DROP COLUMN IF EXISTS plan_id;

-- Restore NOT NULL on gateway_tx_id (requires no NULL values present)
ALTER TABLE payments ALTER COLUMN gateway_tx_id SET NOT NULL;

DROP INDEX IF EXISTS uq_payments_idempotency_key;
ALTER TABLE payments DROP COLUMN IF EXISTS idempotency_key;
