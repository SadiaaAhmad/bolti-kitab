# Bolti Kitab (بولتی کتاب)

> **Dedicated Streaming Audiobook Platform for Urdu & Regional South Asian Literature**  
> **Phase 1 Working MVP Baseline** | Authoritative Architecture Reference: `bolti-kitab-architecture.docx`

---

## 1. Project Overview

Bolti Kitab (بولتی کتاب) is an audiobook and spoken literature streaming platform engineered specifically for Urdu and regional South Asian literature, poetry, and storytelling. It provides localized currency checkouts, a specialized recording and moderation workflow for native voice artists, and a high-performance streaming architecture.

The project evolves through three strict phases:
- **Phase 1 (Working MVP)**: Relational schema baseline, direct cloud object storage streaming via SAS tokens, exclusive Flutter mobile playback channel, storefront-only Next.js web channel (no audio playback), unified React/Tailwind Recording & Moderation Portal, modular Fastify backend, and real-time WebSocket hub.
- **Phase 2 (AI Intelligence)**: Offline Urdu Whisper ASR transcription, pgvector HNSW indexing, and an in-player contextual AI companion with mathematical spoiler boundaries (`end_ms <= user_position_ms`).
- **Phase 3 (Production Scale)**: Global Edge CDN with signed asymmetric cookies, multi-bitrate HLS ladders (32k, 64k, 128k AAC), and hardware DRM (Widevine & FairPlay).

---

## 2. Core Architectural Guardrails (Phase 1)

1. **Mobile Playback Exclusivity**: Audio listening is **strictly exclusive** to the Flutter mobile application (`apps/mobile`).
2. **Web Storefront Boundary**: The Next.js web application (`apps/web`) is a **storefront only** for catalog discovery, registration, and book/subscription purchasing. It contains **no audio player**, no media streaming endpoints, and no stream tokens.
3. **Unified Recording & Admin Portal**: The React application (`apps/portal`) provides role-based workspaces: `/studio` for narrators (Web Audio API recording, mic metering, direct chunked upload) and `/admin` for editors/admins (review queue, ffprobe metrics, chapter binding, catalog activation).
4. **Direct Cloud Storage Streaming**: Backend application servers authorize requests and issue short-lived 60-minute SAS tokens, but **never proxy audio byte streams**. Mobile clients stream directly from cloud object storage via HTTP Range requests.
5. **Single Backend Technology**: The backend (`backend`) is a high-performance Modular Monolith built with **Node.js, TypeScript, and Fastify**.
6. **Authoritative Relational Database**: **PostgreSQL 16** with strict foreign key integrity, check constraints, unique indexes, and partial indexes.
7. **No Early Infrastructure**: No AI (Phase 2), no edge CDN (Phase 3), and no hardware DRM in Phase 1.

---

## 3. Repository Structure

```text
bolti-kitab/
├── apps/
│   ├── mobile/                      # Flutter mobile app (Exclusive playback channel)
│   ├── web/                         # Next.js web storefront (Discovery & checkout only)
│   └── portal/                      # React + Tailwind Recording Studio & Admin Console
├── backend/                         # Node.js + TypeScript + Fastify modular monolith
├── database/
│   ├── migrations/
│   │   ├── 001_initial_phase1_schema.sql       # Initial PostgreSQL 16 DDL migration
│   │   └── 001_initial_phase1_schema.down.sql  # Migration rollback script
│   ├── scripts/
│   │   ├── migrate.py               # Python 3 migration runner (ready for use)
│   │   └── migrate.js               # Node.js migration runner
│   └── README.md                    # Database documentation & instructions
├── docs/
│   ├── ARCHITECTURE_SUMMARY.md      # Full summary of the 22 architecture doc sections
│   ├── DATABASE_SCHEMA.md           # Table-by-table reference dictionary
│   └── WEBSOCKET_SPECIFICATION.md   # Specification for /ws/v1/channels real-time hub
├── .env.example                     # Environment configuration template
├── .gitignore                       # Standard version control ignore rules
├── bolti-kitab-architecture.docx    # Primary source of truth architecture document
└── README.md                        # This project documentation
```

---

## 4. Database Setup & Migrations

The Phase 1 relational schema baseline is implemented in [`database/migrations/001_initial_phase1_schema.sql`](file:///c:/Users/Sadia%20Ahmad/BoltiKitab/database/migrations/001_initial_phase1_schema.sql).

### Database Credentials (Local Development)
- **Database**: `bolti_kitab_dev`
- **Host**: `localhost:5432`
- **User**: `postgres`
- **Password**: Configured in `.env` (`DB_PASSWORD` or `DATABASE_URL`)

### Running the Migration via Python CLI
```bash
# Check status of pending migrations
python database/scripts/migrate.py --status

# Perform a safe dry-run (transaction rollback validation)
python database/scripts/migrate.py --dry-run

# Apply the migration to bolti_kitab_dev
python database/scripts/migrate.py --up

# Roll back the migration (if needed)
python database/scripts/migrate.py --down
```

### Running the Migration via pgAdmin 4
1. Connect to `localhost:5432` in pgAdmin 4.
2. Select database `bolti_kitab_dev` -> **Query Tool**.
3. Open [`database/migrations/001_initial_phase1_schema.sql`](file:///c:/Users/Sadia%20Ahmad/BoltiKitab/database/migrations/001_initial_phase1_schema.sql).
4. Press **F5** to execute.

---

## 5. Phase 1 Relational Entities

1. **`users`**: Identity, Argon2id credentials, platform roles (`listener`, `narrator`, `editor`, `admin`), and status.
2. **`books`**: Book catalog metadata, English & Urdu titles, author, narrator, synopsis, language, price, and cover key.
3. **`chapters`**: Chapter sequence (`book_id`, `chapter_num` unique), bilingual titles, audio boundaries, preview flag, and audio key.
4. **`recording_sessions`**: Studio recording sessions linking narrator, book, and chapter.
5. **`recordings`**: Audio takes per session (`session_id`, `take_number` unique), ffprobe metrics (sample rate 44.1 kHz, 2 channels), review notes, and status.
6. **`subscription_plans`**: Recurring subscription plans (monthly, annual).
7. **`subscriptions`**: Active user subscription status and billing periods.
8. **`payments`**: Payment transaction audit records with unique `gateway_tx_id` for idempotency across Stripe, JazzCash, and EasyPaisa.
9. **`entitlements`**: Playback access grants linking users and books.
10. **`listening_progress`**: Playback synchronization point tracking chapter, timestamp, and optimistic update sequence.
