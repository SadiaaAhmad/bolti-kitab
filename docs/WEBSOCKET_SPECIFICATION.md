# Bolti Kitab (بولتی کتاب) — Phase 1 WebSocket Specification

> **Endpoint**: `/ws/v1/channels`  
> **Status**: Specification & Architectural Boundary (Implementation scheduled for Phase 1 Sprint 7)  
> **Protocol**: WebSocket over TLS (`wss://`) upgraded via Ingress reverse proxy (Caddy / Nginx)

---

## 1. Module Boundary & Architecture

In Phase 1, the WebSocket hub is implemented as a dedicated module (`backend/src/modules/websocket/`) within the Fastify modular monolith backend. It provides low-latency, bidirectional communication between client applications and backend event dispatchers without introducing external message brokers (such as Redis or Kafka) in the MVP stage.

```text
+-------------------+      +----------------------+      +----------------------+
| Recording Studio  |      | Moderation Console   |      | Flutter Mobile App   |
| (/studio)         |      | (/admin)             |      | (Audio Engine)       |
+-------------------+      +----------------------+      +----------------------+
          \                          |                          /
           \                         |                         /
            v                        v                        v
         [ Ingress Reverse Proxy: TLS Termination & WS Upgrade ]
                                     |
                                     v
                 [ Fastify Backend: WebSocket Gateway Hub ]
                 +----------------------------------------+
                 |  Connection Registry & Session Auth    |
                 |  Heartbeat Monitor (30s Ping / 60s TO) |
                 |  Channel Subscription Manager          |
                 +----------------------------------------+
                                     |
                 +-------------------+--------------------+
                 |                   |                    |
                 v                   v                    v
         [ Studio Telemetry ]  [ Ingestion Alerts ]  [ Progress Sync ]
```

---

## 2. Planned Responsibilities

The Phase 1 WebSocket Gateway handles four distinct use cases:

### 1. Studio Live Recording Telemetry
- **Channel**: `studio:session:{sessionId}`
- **Subscribers**: Narrator recording client, active remote sound engineers/producers.
- **Payload**:
  - Mic peak and RMS volume levels.
  - Recording timer synchronization.
  - Chunk upload progress and status transitions (`uploading` -> `received`).

### 2. Audio Ingestion & Automated Validation Alerts
- **Channel**: `studio:validation:{takeId}`
- **Subscribers**: Narrator, content moderators.
- **Payload**:
  - Background `ffprobe` inspection results:
    - Duration verification (`duration_ms`).
    - Audio sample rate compliance (`sample_rate_hz == 44100`).
    - Channel configuration (`channels == 2`).
    - Integrity error alerts or validation pass flags.

### 3. Admin Catalog Publication Broadcasting
- **Channel**: `catalog:updates`
- **Subscribers**: Web Storefront, Mobile App catalog clients, Admin dashboard.
- **Payload**:
  - Immediate notification when a book or chapter status transitions to `active` or `archived`.
  - Triggers client-side catalog invalidation/refetching without polling.

### 4. Cross-Device Listening Progress Synchronization
- **Channel**: `user:progress:{userId}`
- **Subscribers**: Active Flutter mobile client sessions for the authenticated user.
- **Payload**:
  - Real-time updates of `book_id`, `chapter_id`, `position_ms`, and `update_seq`.
  - Enables seamless resumption across multiple personal mobile devices.

---

## 3. Connection Lifecycle & Authentication

1. **Handshake & Authentication**:
   - Connection established to `wss://api.boltitab.com/ws/v1/channels?token={JWT_ACCESS_TOKEN}`.
   - Gateway verifies RS256 JWT signature and user permissions before accepting the socket upgrade.
2. **Heartbeat Protocol**:
   - Server sends `{"type": "PING", "timestamp": 1726140000}` every 30 seconds.
   - Client must respond with `{"type": "PONG", "timestamp": 1726140000}`.
   - Inactive sockets with no response within 60 seconds are terminated to prevent connection leaks.
3. **Channel Subscription Protocol**:
   - Client sends:
     ```json
     {
       "action": "SUBSCRIBE",
       "channel": "studio:session:d4c4f039-3823-42e7-8b01-50e4178658aa"
     }
     ```
   - Gateway checks authorization for the requested channel and returns an acknowledgment:
     ```json
     {
       "type": "SUBSCRIPTION_ACK",
       "channel": "studio:session:d4c4f039-3823-42e7-8b01-50e4178658aa",
       "status": "SUBSCRIBED"
     }
     ```

---

## 4. Message Envelope Schema

All WebSocket frames follow a standardized JSON envelope:

```json
{
  "id": "uuid-v4",
  "channel": "studio:session:d4c4f039-3823-42e7-8b01-50e4178658aa",
  "type": "TELEMETRY_PEAK_UPDATE",
  "timestamp": 1726140000500,
  "payload": {
    "peakDb": -3.2,
    "rmsDb": -18.4,
    "durationMs": 14250
  }
}
```

---

## 5. Milestone Placement

Implementation of this specification is scheduled for **Phase 1 Sprint 7 (Days 36–40)**, after the Core REST API, Studio Portal, and Mobile App foundation have been established.
