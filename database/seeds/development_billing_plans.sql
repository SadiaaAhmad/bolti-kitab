-- ==============================================================================
-- Bolti Kitab (بولتی کتاب)
-- Seed: development_billing_plans.sql
-- Description: Test and development subscription plans.
-- Note: Executed ONLY in development and automated testing environments.
-- ==============================================================================

INSERT INTO subscription_plans (id, name, billing_interval, price_cents, currency, is_active)
VALUES
    ('11111111-1111-1111-1111-111111111101', 'Dev Monthly Plan', 'monthly', 10000, 'PKR', TRUE),
    ('11111111-1111-1111-1111-111111111102', 'Dev Annual Plan', 'annual', 100000, 'PKR', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    billing_interval = EXCLUDED.billing_interval,
    price_cents = EXCLUDED.price_cents,
    currency = EXCLUDED.currency,
    is_active = EXCLUDED.is_active;
