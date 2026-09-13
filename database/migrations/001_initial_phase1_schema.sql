-- ==============================================================================
-- BOLTI KITAB (بولتی کتاب)
-- Initial Phase 1 PostgreSQL schema/migration baseline
-- Primary Source of Truth: bolti-kitab-architecture.docx (Section 11)
-- Target Database: PostgreSQL 16 (Compatible with PostgreSQL 16+)
-- Migration: 001_initial_phase1_schema.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. USERS & IDENTITY
-- Roles: listener (default), narrator, editor, admin
-- Status: active, suspended, pending_verification
-- Passwords hashed via Argon2id
-- ------------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'listener' 
        CHECK (role IN ('listener', 'narrator', 'editor', 'admin')),
    status VARCHAR(32) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'suspended', 'pending_verification')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. BOOKS CATALOG
-- Languages: ur (Urdu), en (English), pa (Punjabi), sd (Sindhi)
-- Status: draft, in_recording, in_review, active, archived
-- ------------------------------------------------------------------------------
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    title_urdu VARCHAR(255) NOT NULL,
    author VARCHAR(128) NOT NULL,
    narrator_name VARCHAR(128) NOT NULL,
    synopsis TEXT,
    language VARCHAR(32) NOT NULL DEFAULT 'ur' 
        CHECK (language IN ('ur', 'en', 'pa', 'sd')),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'PKR',
    cover_object_key VARCHAR(512),
    status VARCHAR(32) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'in_recording', 'in_review', 'active', 'archived')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. CHAPTERS
-- Enforces ordered sequence per book (unique book_id + chapter_num)
-- Status: pending, recorded, approved, rejected
-- Timing Semantics:
--   - start_ms and end_ms represent absolute offsets (in milliseconds) within
--     the complete audiobook timeline.
--   - duration_ms represents chapter segment duration: duration_ms = (end_ms - start_ms).
-- ------------------------------------------------------------------------------
CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_num INTEGER NOT NULL CHECK (chapter_num >= 1),
    title VARCHAR(255) NOT NULL,
    title_urdu VARCHAR(255),
    start_ms INTEGER NOT NULL DEFAULT 0 CHECK (start_ms >= 0),
    end_ms INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    audio_object_key VARCHAR(512),
    is_preview_free BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'recorded', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_book_chapter_num UNIQUE (book_id, chapter_num),
    CONSTRAINT uq_chapters_book_id_pair UNIQUE (book_id, id),
    CONSTRAINT chk_chapters_timing CHECK (end_ms >= start_ms AND duration_ms = (end_ms - start_ms))
);

-- ------------------------------------------------------------------------------
-- 4. RECORDING SESSIONS
-- Studio recording sessions linking narrator, book, and target chapter
-- Status: in_progress, completed, abandoned
-- Composite FK guarantees chapter belongs to the specified book
-- ------------------------------------------------------------------------------
CREATE TABLE recording_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    narrator_id UUID NOT NULL REFERENCES users(id),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'in_progress' 
        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sessions_book_chapter FOREIGN KEY (book_id, chapter_id) 
        REFERENCES chapters(book_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_sessions_id_chapter UNIQUE (id, chapter_id)
);

-- ------------------------------------------------------------------------------
-- 5. RECORDINGS (TAKES)
-- Multi-take management per session.
-- ffprobe verified metadata: duration_ms, file_size_bytes, sample_rate_hz, channels
-- Status: uploading, submitted_for_review, approved, rejected
-- Composite FK guarantees take belongs to the session and its bound chapter
-- ------------------------------------------------------------------------------
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    chapter_id UUID NOT NULL,
    take_number INTEGER NOT NULL DEFAULT 1 CHECK (take_number >= 1),
    raw_audio_key VARCHAR(512) NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    file_size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
    sample_rate_hz INTEGER NOT NULL DEFAULT 44100 CHECK (sample_rate_hz IN (22050, 44100, 48000)),
    channels INTEGER NOT NULL DEFAULT 2 CHECK (channels IN (1, 2)),
    status VARCHAR(32) NOT NULL DEFAULT 'submitted_for_review' 
        CHECK (status IN ('uploading', 'submitted_for_review', 'approved', 'rejected')),
    review_notes TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_take UNIQUE (session_id, take_number),
    CONSTRAINT fk_recordings_session_chapter FOREIGN KEY (session_id, chapter_id) 
        REFERENCES recording_sessions(id, chapter_id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 6. SUBSCRIPTION PLANS
-- Billing interval: monthly, annual
-- ------------------------------------------------------------------------------
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(64) NOT NULL,
    billing_interval VARCHAR(16) NOT NULL 
        CHECK (billing_interval IN ('monthly', 'annual')),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'PKR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 7. SUBSCRIPTIONS
-- User subscription lifecycle linked to subscription_plans
-- Status: active, past_due, canceled, expired
-- Period check: strictly positive duration (current_period_end > current_period_start)
-- ------------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(32) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'past_due', 'canceled', 'expired')),
    gateway_subscription_id VARCHAR(128),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_subscription_periods CHECK (current_period_end > current_period_start)
);

-- ------------------------------------------------------------------------------
-- 8. PAYMENTS
-- Gateway: stripe, jazzcash, easypaisa, manual
-- Status: pending, succeeded, failed, refunded
-- Payment Type: direct_purchase (requires book_id, subscription_id NULL), subscription (requires subscription_id, book_id NULL)
-- gateway_tx_id UNIQUE ensures idempotent webhook ingestion
-- user_id and book_id ON DELETE RESTRICT preserve financial audit trails
-- ------------------------------------------------------------------------------
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payment_type VARCHAR(32) NOT NULL DEFAULT 'direct_purchase' 
        CHECK (payment_type IN ('direct_purchase', 'subscription')),
    book_id UUID REFERENCES books(id) ON DELETE RESTRICT,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    gateway VARCHAR(32) NOT NULL 
        CHECK (gateway IN ('stripe', 'jazzcash', 'easypaisa', 'manual')),
    gateway_tx_id VARCHAR(128) NOT NULL UNIQUE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'PKR',
    status VARCHAR(32) NOT NULL 
        CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_payment_target CHECK (
        (payment_type = 'direct_purchase' AND book_id IS NOT NULL AND subscription_id IS NULL) OR
        (payment_type = 'subscription' AND subscription_id IS NOT NULL AND book_id IS NULL)
    )
);

-- ------------------------------------------------------------------------------
-- 9. ENTITLEMENTS
-- Access grants per book, user, and grant mechanism (subscription, direct_purchase, promotional)
-- Status: active, revoked, expired
-- UNIQUE (user_id, book_id, grant_type) permits distinct concurrent grant lifecycles
-- ------------------------------------------------------------------------------
CREATE TABLE entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    grant_type VARCHAR(32) NOT NULL 
        CHECK (grant_type IN ('subscription', 'direct_purchase', 'promotional')),
    status VARCHAR(32) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_book_grant UNIQUE (user_id, book_id, grant_type)
);

-- ------------------------------------------------------------------------------
-- 10. LISTENING PROGRESS
-- Cross-device playback synchronization point.
-- Playback Semantics:
--   position_ms represents the current playback offset (in milliseconds)
--   WITHIN THE CURRENT CHAPTER (chapter_id), NOT the entire audiobook.
--   Composite FK guarantees chapter_id belongs to book_id.
--   update_seq enforces optimistic concurrency / monotonic sequence.
-- ------------------------------------------------------------------------------
CREATE TABLE listening_progress (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL,
    position_ms INTEGER NOT NULL DEFAULT 0 CHECK (position_ms >= 0),
    update_seq BIGINT NOT NULL DEFAULT 1 CHECK (update_seq >= 1),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, book_id),
    CONSTRAINT fk_progress_book_chapter FOREIGN KEY (book_id, chapter_id) 
        REFERENCES chapters(book_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- PERFORMANCE & FILTERED INDEXES
-- ------------------------------------------------------------------------------
-- Fast catalog querying by publication status, language, and recency
CREATE INDEX idx_books_status_lang_pub ON books(status, language, published_at DESC);

-- Fast chapter ordering and lookup by book
CREATE INDEX idx_chapters_book_num ON chapters(book_id, chapter_num);

-- Filtered index for pending moderation/review queue queries ordered by arrival
CREATE INDEX idx_recordings_review_queue ON recordings(status, created_at ASC) WHERE status = 'submitted_for_review';

-- High-performance authorization lookup during playback token generation (<15ms)
CREATE INDEX idx_entitlements_user_book_active ON entitlements(user_id, book_id, status) WHERE status = 'active';

-- Fast studio session loading for narrators
CREATE INDEX idx_recording_sessions_narrator ON recording_sessions(narrator_id, status);

-- Partial unique index preventing duplicate external subscription IDs across subscriptions
CREATE UNIQUE INDEX uq_subscriptions_gateway_id 
ON subscriptions(gateway_subscription_id) 
WHERE gateway_subscription_id IS NOT NULL;

-- Fast purchase history and user financial audit lookup
CREATE INDEX idx_payments_user_history 
ON payments(user_id, created_at DESC);
