# Bolti Kitab (بولتی کتاب) — System Architecture Summary

> **Primary Source of Truth**: `bolti-kitab-architecture.docx` (Version 4.0)  
> **Target Deployment**: Microsoft Azure / Vultr  
> **Backend Stack**: Node.js + TypeScript + Fastify (Modular Monolith)  
> **Database Engine**: PostgreSQL 16  
> **Mobile Client**: Flutter (Android/iOS) — Exclusive Playback Channel  
> **Web Client**: Next.js — Storefront Only (Strictly No Playback)  
> **Admin & Studio**: React + Tailwind (Single Unified Web Portal with RBAC)

---

## 1. Executive Summary & Phased Strategy

Bolti Kitab (بولتی کتاب) is a dedicated streaming audiobook and spoken literature platform engineered specifically for Urdu and regional South Asian literature, poetry, and storytelling. It addresses a critical market gap by delivering native Urdu narrator curation, localized payment options (JazzCash, EasyPaisa, regional debit/credit cards), and high-fidelity spoken audio delivery.

The project adheres to a strict Three-Phase Evolutionary Roadmap:
- **Phase 1 (Working MVP)**: Core streaming engine, direct cloud object storage streaming via SAS tokens, exclusive Flutter mobile playback, web storefront (no playback), unified recording & admin portal, PostgreSQL 16 relational baseline, and real-time WebSocket hub.
- **Phase 2 (AI Intelligence)**: Decoupled offline Urdu Whisper ASR transcription, pgvector HNSW vector indexing, and contextual in-player AI companion with mathematical narrative spoiler boundaries.
- **Phase 3 (Enterprise Scale)**: Global Edge CDN with signed asymmetric cookies, automated multi-bitrate HLS ladders (32k, 64k, 128k AAC), PostgreSQL Multi-AZ with read replicas, and commercial hardware DRM (Widevine & FairPlay).

---

## 2. Supervisor Guardrails & Architectural Mapping

1. **Product Name**: Bolti Kitab (بولتی کتاب).
2. **Phase 1 Working MVP**: Strict focus on streaming, database, storage, payments, and recording workflows.
3. **Recording Portal Included**: Built into unified web portal (`/studio`) with Web Audio API recording, real-time mic volume metering, and direct chunked upload.
4. **Mobile App Included**: Flutter mobile app for Android/iOS handles user library, offline session cache, and audio playback.
5. **Client Web Channel (Storefront Only)**: Next.js SSR web storefront for catalog discovery, SEO, user registration, and book/subscription purchasing.
6. **Web Channel Strictly No Playback**: No audio player components, media streaming endpoints, or stream tokens on the web.
7. **Mobile App Exclusive Playback Channel**: Playback Authorization Service issues streaming SAS tokens strictly to verified mobile client sessions.
8. **WebSockets in Phase 1**: WebSocket hub (`/ws/v1/channels`) for studio telemetry, encoding alerts, catalog broadcast, and progress sync.
9. **Deployable on Azure or Vultr**: Primary target Microsoft Azure (Blob Storage, Flexible PostgreSQL) with abstracted storage adapter for Vultr portability.
10. **PostgreSQL 16 Approved Baseline**: Authoritative relational database for identity, catalog, billing, and progress.
11. **Conservative Hardware Sizing**: Realistic specifications separated into Minimum vs. Recommended across 6 operational environments.
12. **AI Decoupled from Phase 1 Core**: Whisper ASR, pgvector embeddings, and RAG companion strictly scheduled for Phase 2.
13. **CDN Deferred from Phase 1 Core**: No edge CDN PoPs in Phase 1. Clients stream directly from Cloud Object Storage via secure, time-limited SAS tokens.
14. **Phased Evolution**: Strict system boundaries, network topologies, and data flows defined across three distinct phases.

---

## 3. System Context & Four Tiers

```text
[Mobile App (Flutter)]         [Storefront (Next.js)]       [Recording/Admin Portal (React)]
(Exclusive Playback)           (Storefront & Checkout)      (Studio /studio & Admin /admin)
        |                                |                                 |
        +--------------------------------+---------------------------------+
                                         |
                                         v
                         [Ingress Tier: Reverse Proxy]
                               (Caddy / Nginx)
                                         |
                                         v
                 [Backend Modular Monolith (Fastify + TypeScript)]
                 +-----------------------------------------------+
                 |  Auth  | Catalog | Billing | Recordings | Playback |
                 +-----------------------------------------------+
                 |              WebSocket Hub                    |
                 +-----------------------------------------------+
                                  |              \ (SAS Token Generation)
                                  v               v
                        [PostgreSQL 16]     [Azure Blob Storage / Vultr]
                     (Identity, Catalog,     (Private Audio & Public Covers)
                      Billing, Progress)                  ^
                                                          | Direct Range Requests
                                              [Mobile App (Flutter)]
```

### Direct Storage Streaming Pattern
- Mobile requests a stream token via `/api/v1/playback/token`.
- Backend validates active entitlements in PostgreSQL in under 15ms.
- Backend issues a 60-minute time-limited, read-scoped SAS URL.
- Mobile player (`just_audio`) streams directly from Azure Blob Storage using HTTP Range requests.
- **Backend NEVER proxies audio byte streams**, eliminating bandwidth saturation.

---

## 4. Recording & Moderation Pipeline

1. **Session Initialization**: Narrator opens `/studio`, selects assigned book and chapter, and initializes a `recording_session`.
2. **In-Browser Recording**: Web Audio API captures microphone stream; canvas meters volume levels; audio is cached in IndexedDB during recording.
3. **Direct Upload**: Backend issues write-scoped SAS token; client uploads audio chunks directly to private blob storage. A `recordings` row is created with status `uploading` -> `submitted_for_review`.
4. **Validation & Inspection**: An automated background job invokes `ffprobe` to verify duration, sample rate (44.1 kHz), channel count (stereo/mono), and file integrity.
5. **Review Queue**: Content moderators access `/admin/review`, listen to takes, inspect ffprobe metrics, and approve/reject takes.
6. **Chapter Binding & Publication**: Approved take key is bound to `chapters.audio_object_key`. When all chapters are approved, the book is activated.

---

## 5. Security & Authentication Architecture

- **Password Hashing**: Argon2id with memory-hard parameters.
- **JWT Architecture**: RS256 asymmetric signing. Private key signs tokens on backend; public key validates signatures across services.
- **Role-Based Authorization (RBAC)**: Claims include `role` (`listener`, `narrator`, `editor`, `admin`).
- **Webhook Verification**: Payment webhooks (Stripe, JazzCash, EasyPaisa) verified using cryptographic HMAC signatures before state mutations.
- **Database Idempotency**: Strict unique constraint on `payments.gateway_tx_id` prevents duplicate entitlement unlocks.

---

## 6. Architecture Decision Records (ADRs)

- **ADR-001**: Mobile-Only Playback Boundary in Phase 1 (no web audio player).
- **ADR-002**: Direct Cloud Storage Streaming via Time-Limited SAS Tokens (no backend stream proxying).
- **ADR-003**: Unified Web Application for Recording and Administration with RBAC (`/studio` and `/admin`).
- **ADR-004**: Native PostgreSQL 16 as Single Database Engine.
- **ADR-005**: Deferral of CDN and Multi-Bitrate HLS to Phase 3.
- **ADR-006**: Deferral of AI and Vector Indexing to Phase 2.
- **ADR-007**: Strict Spoiler Retrieval Boundary (`end_ms <= user_position_ms`) and Dynamic Boundary Truncation.
- **ADR-008**: Selection of Azure as Primary Cloud Target with Vultr Portability.

---

## 7. Implementation Roadmap

- **Sprint 1 (Days 1–5)**: PostgreSQL 16 Relational Schema Baseline & Migrations.
- **Sprint 2 (Days 6–9)**: Cloud Storage Setup & Direct SAS Service.
- **Sprint 3 (Days 10–14)**: Authentication, RBAC & Core API Layer.
- **Sprint 4 (Days 15–20)**: Recording Portal Studio & Moderation Console.
- **Sprint 5 (Days 21–28)**: Flutter Mobile App Playback Engine & Local State.
- **Sprint 6 (Days 29–35)**: Client Web Storefront & Hosted Payment Checkouts.
- **Sprint 7 (Days 36–40)**: WebSocket Gateway Hub (`/ws/v1/channels`).
- **Sprint 8 (Days 41–45)**: Integration Testing & Production Deployment.
