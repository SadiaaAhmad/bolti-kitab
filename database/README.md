# Bolti Kitab (بولتی کتاب)
## Initial Phase 1 PostgreSQL schema/migration baseline & Migrations

This directory manages the Initial Phase 1 PostgreSQL schema/migration baseline for Bolti Kitab. The schema strictly enforces foreign key integrity, check constraints, unique constraints, and partial indexes defined in the project architecture.

---

## Database Configuration

- **Database Name**: `bolti_kitab_dev`
- **Host**: `localhost` (Port: `5432`)
- **Default User**: `postgres`
- **Target Engine**: PostgreSQL 16 (Compatible with PostgreSQL 16+)
- **Credentials**: Configured via environment variables (`DATABASE_URL` or `DB_PASSWORD`). No passwords are hardcoded in repository files.

---

## Directory Structure

```text
database/
├── migrations/
│   ├── 001_initial_phase1_schema.sql       # UP migration (Initial Phase 1 baseline)
│   └── 001_initial_phase1_schema.down.sql  # DOWN migration (Rollback script)
├── scripts/
│   ├── migrate.py                          # Python 3 + psycopg2 migration runner (uses environment variables)
│   └── migrate.js                          # Node.js + pg migration runner (uses environment variables)
└── README.md                               # This documentation
```

---

## How to Execute the Migration

You have two methods to run this migration:

### Method 1: Automated Command Line Runner (Recommended)

A lightweight migration runner is provided in `database/scripts/migrate.py` that utilizes your local Python environment and `psycopg2`.

Ensure your database password is set in `.env` or in your terminal session (e.g. `$env:DB_PASSWORD="your_password"` in PowerShell):

1. **Check Status**:
   ```bash
   python database/scripts/migrate.py --status
   ```
2. **Perform a Safe Dry-Run** (verifies SQL in a transaction without committing):
   ```bash
   python database/scripts/migrate.py --dry-run
   ```
3. **Apply Migration**:
   ```bash
   python database/scripts/migrate.py --up
   ```
4. **Rollback Migration** (if needed):
   ```bash
   python database/scripts/migrate.py --down
   ```

### Method 2: Manual Execution via pgAdmin 4

1. Open **pgAdmin 4**.
2. Connect to your local PostgreSQL server (`localhost:5432`).
3. Expand **Databases** and right-click **`bolti_kitab_dev`**.
4. Select **Query Tool**.
5. Open file [`database/migrations/001_initial_phase1_schema.sql`](file:///c:/Users/Sadia%20Ahmad/BoltiKitab/database/migrations/001_initial_phase1_schema.sql).
6. Click **Execute / Run** (`F5`).

---

## Phase 1 Relational Entities & Key Constraints

| Entity | Primary Key | Key Foreign Keys & Constraints | Description |
| :--- | :--- | :--- | :--- |
| `users` | `id UUID` | `email UNIQUE`, `role IN ('listener', 'narrator', 'editor', 'admin')`, `status IN ('active', 'suspended', 'pending_verification')` | User credentials (Argon2id) and platform roles. |
| `books` | `id UUID` | `language IN ('ur', 'en', 'pa', 'sd')`, `status IN ('draft', 'in_recording', 'in_review', 'active', 'archived')`, `duration_seconds >= 0`, `price_cents >= 0` | Spoken book catalog metadata, Urdu & English titles, cover key. |
| `chapters` | `id UUID` | `book_id -> books(id) ON DELETE CASCADE`, `uq_book_chapter_num UNIQUE (book_id, chapter_num)`, `uq_chapters_book_id_pair UNIQUE (book_id, id)`, `CHECK (end_ms >= start_ms AND duration_ms = (end_ms - start_ms))` | Chapters. `start_ms` and `end_ms` represent absolute timeline offsets. `duration_ms` is chapter length. |
| `recording_sessions` | `id UUID` | `narrator_id -> users(id)`, `fk_sessions_book_chapter FOREIGN KEY (book_id, chapter_id) REFERENCES chapters(book_id, id) ON DELETE CASCADE` | Studio sessions. Composite FK guarantees chapter belongs to book. |
| `recordings` | `id UUID` | `fk_recordings_session_chapter FOREIGN KEY (session_id, chapter_id) REFERENCES recording_sessions(id, chapter_id) ON DELETE CASCADE`, `take_number >= 1`, `sample_rate_hz IN (22050, 44100, 48000)`, `channels IN (1, 2)` | Audio takes per session (`uq_session_take`), ffprobe metadata. |
| `subscription_plans`| `id UUID` | `billing_interval IN ('monthly', 'annual')`, `price_cents >= 0` | Recurring subscription tiers and pricing (PKR). |
| `subscriptions` | `id UUID` | `user_id -> users(id) ON DELETE CASCADE`, `plan_id -> subscription_plans(id)`, `CHECK (current_period_end > current_period_start)`, `uq_subscriptions_gateway_id UNIQUE WHERE gateway_subscription_id IS NOT NULL` | Active user subscriptions with strictly positive periods and partial unique gateway ID. |
| `payments` | `id UUID` | `user_id -> users(id) ON DELETE RESTRICT`, `book_id -> books(id) ON DELETE RESTRICT`, `gateway_tx_id UNIQUE`, `gateway IN ('stripe', 'jazzcash', 'easypaisa', 'manual')`, `amount_cents >= 0`, `payment_type IN ('direct_purchase', 'subscription')` | Transaction records for checkout idempotency, direct book sales audit, and subscription billing. |
| `entitlements` | `id UUID` | `user_id -> users(id)`, `book_id -> books(id)`, `uq_user_book_grant UNIQUE (user_id, book_id, grant_type)` | Playback authorization grants with decoupled grant lifecycles. |
| `listening_progress`| `(user_id, book_id)` | `fk_progress_book_chapter FOREIGN KEY (book_id, chapter_id) REFERENCES chapters(book_id, id) ON DELETE CASCADE`, `position_ms >= 0`, `update_seq >= 1` | Playback position within the CURRENT CHAPTER with composite FK chapter integrity. |

---

## Phase 1 Indexes

1. `idx_books_status_lang_pub`: Compound index on `books(status, language, published_at DESC)` for fast catalog filtering by recency.
2. `idx_chapters_book_num`: Compound index on `chapters(book_id, chapter_num)` for chapter sequence loading.
3. `idx_recordings_review_queue`: Filtered index on `recordings(status, created_at ASC) WHERE status = 'submitted_for_review'` for moderation queue retrieval.
4. `idx_entitlements_user_book_active`: Filtered index on `entitlements(user_id, book_id, status) WHERE status = 'active'` for sub-15ms playback authorization lookups.
5. `idx_recording_sessions_narrator`: Compound index on `recording_sessions(narrator_id, status)` for fast narrator studio session loading.
6. `uq_subscriptions_gateway_id`: Partial unique index on `subscriptions(gateway_subscription_id) WHERE gateway_subscription_id IS NOT NULL` preventing duplicate external subscription IDs.
7. `idx_payments_user_history`: Compound index on `payments(user_id, created_at DESC)` for customer purchase history and financial audit lookup.
