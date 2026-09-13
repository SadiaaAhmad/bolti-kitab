-- ==============================================================================
-- BOLTI KITAB (بولتی کتاب)
-- Initial Phase 1 PostgreSQL schema/migration rollback (DOWN)
-- Migration: 001_initial_phase1_schema.down.sql
-- CAUTION: Drops all Phase 1 tables, indexes, and constraints.
-- ==============================================================================

DROP INDEX IF EXISTS idx_payments_user_history;
DROP INDEX IF EXISTS uq_subscriptions_gateway_id;
DROP INDEX IF EXISTS idx_recording_sessions_narrator;
DROP INDEX IF EXISTS idx_entitlements_user_book_active;
DROP INDEX IF EXISTS idx_recordings_review_queue;
DROP INDEX IF EXISTS idx_chapters_book_num;
DROP INDEX IF EXISTS idx_books_status_lang_pub;

DROP TABLE IF EXISTS listening_progress CASCADE;
DROP TABLE IF EXISTS entitlements CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS recordings CASCADE;
DROP TABLE IF EXISTS recording_sessions CASCADE;
DROP TABLE IF EXISTS chapters CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS users CASCADE;
