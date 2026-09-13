/**
 * Playback Module — Phase 1 Sprint 3
 *
 * ARCHITECTURE CONSTRAINT (ADR-001, ADR-002):
 *   - Playback tokens are issued EXCLUSIVELY to verified mobile client sessions.
 *   - The backend NEVER proxies audio byte streams.
 *   - Backend validates active entitlement in PostgreSQL (<15ms target).
 *   - Backend issues time-limited, read-scoped SAS URLs (60 minute expiry).
 *   - Mobile player (just_audio) streams directly from Azure Blob Storage.
 *
 * Planned implementation:
 *   - POST /api/v1/playback/token           — Validate entitlement → issue SAS URL
 *   - POST /api/v1/playback/progress        — Sync listening progress
 *   - GET  /api/v1/playback/progress/:bookId — Fetch resume position
 *
 * Do NOT implement until Sprint 3 is formally started.
 */

export {};
