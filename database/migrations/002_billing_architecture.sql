-- ==============================================================================
-- Bolti Kitab (بولتی کتاب) — Phase 1 Backend Architecture
-- Migration: 002_billing_architecture.sql
--
-- Description:
--   Extends payments, subscriptions, and catalog schema to support:
--   1. Application-level idempotency key with global unique index
--   2. Nullable gateway_tx_id during payment-intent reservation
--   3. Concrete subscription plan targeting (plan_id on payments)
--   4. Refined payment target check constraint (chk_payment_target)
--   5. Mandatory gateway_tx_id constraint for completed payments (chk_payment_gateway_tx_id)
--   6. Mock gateway support for non-production environments
--   7. Single active/past_due subscription per user constraint (uq_subscriptions_one_active_per_user)
--   8. Subscription eligibility flag on books table with performance index
--
-- Note: Contains DDL only. Development/test seeds live in database/seeds/
-- ==============================================================================

-- 1. Application-level idempotency key on payments
ALTER TABLE payments
    ADD COLUMN idempotency_key VARCHAR(128);

CREATE UNIQUE INDEX uq_payments_idempotency_key
    ON payments(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 2. Allow NULL gateway_tx_id during payment-intent reservation
-- Baseline UNIQUE constraint on gateway_tx_id natively permits multiple NULLs
-- while strictly enforcing uniqueness across all non-NULL values.
ALTER TABLE payments
    ALTER COLUMN gateway_tx_id DROP NOT NULL;

-- 3. Add plan_id to payments to resolve subscription intent target constraint
ALTER TABLE payments
    ADD COLUMN plan_id UUID REFERENCES subscription_plans(id) ON DELETE RESTRICT;

-- Replace chk_payment_target with lifecycle-aware target validation
ALTER TABLE payments
    DROP CONSTRAINT chk_payment_target;

ALTER TABLE payments
    ADD CONSTRAINT chk_payment_target CHECK (
        (
            -- Direct Book Purchase: book_id required, subscription_id and plan_id must be null
            payment_type = 'direct_purchase'
            AND book_id IS NOT NULL
            AND subscription_id IS NULL
            AND plan_id IS NULL
        ) OR (
            -- Subscription Payment: plan_id required, book_id must be null
            payment_type = 'subscription'
            AND plan_id IS NOT NULL
            AND book_id IS NULL
            AND (
                -- Pending intent: subscription_id does not exist yet
                (status = 'pending' AND subscription_id IS NULL) OR
                -- Succeeded / Refunded: must be bound to a fulfilled subscription
                (status IN ('succeeded', 'refunded') AND subscription_id IS NOT NULL) OR
                -- Failed: subscription_id may be null (checkout failed) or present (renewal failed)
                (status = 'failed')
            )
        )
    );

-- 4. Database Invariant: gateway_tx_id strictly required for completed financial records
ALTER TABLE payments
    ADD CONSTRAINT chk_payment_gateway_tx_id CHECK (
        (status = 'pending') OR
        (status IN ('succeeded', 'refunded') AND gateway_tx_id IS NOT NULL) OR
        (status = 'failed')
    );

-- 5. Expand gateway check constraint to support mock provider in dev/test
ALTER TABLE payments
    DROP CONSTRAINT payments_gateway_check;

ALTER TABLE payments
    ADD CONSTRAINT payments_gateway_check
    CHECK (gateway IN ('stripe', 'jazzcash', 'easypaisa', 'manual', 'mock'));

-- 6. Enforce single active or past_due subscription per user at database level
CREATE UNIQUE INDEX uq_subscriptions_one_active_per_user
    ON subscriptions(user_id)
    WHERE status IN ('active', 'past_due');

-- 7. Explicit subscription eligibility flag on books table
ALTER TABLE books
    ADD COLUMN is_subscription_eligible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX idx_books_subscription_eligible
    ON books(status, is_subscription_eligible)
    WHERE status = 'active' AND is_subscription_eligible = TRUE;
