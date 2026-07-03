# Changelog

All notable changes to NotifyForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-03

### Added — Core Platform
- Multi-tenant Prisma schema (Organization → Project → Application → ApiKey → Device → Notification)
- 9 isolated channel engines: push_android (FCM), push_ios (APNs), push_huawei (HMS), webpush, email, sms, inapp, webhook, desktop
- Stateless API Gateway with Bearer API key authentication
- RBAC scopes: `push:send`, `email:send`, `admin:projects:read|write`, etc.
- Token-bucket rate limiting per API key
- In-process worker queue with retry + exponential backoff (BullMQ+Redis interface)
- Audit log (immutable) for every mutating API call
- HMAC-SHA256 webhook signing with replay protection

### Added — Channel APIs
- `POST /api/v1/push/send` — supports `push_android`, `push_ios`, `push_huawei`
- `POST /api/v1/email/send`
- `POST /api/v1/sms/send`
- `POST /api/v1/webpush/send`
- `POST /api/v1/inapp/send`
- `POST /api/v1/webhook/send`
- `POST /api/v1/desktop/send`
- Batch endpoints: `POST /api/v1/{channel}/batch` (up to 1000 items)
- Bulk operations: `POST /api/v1/notifications/bulk-cancel`, `bulk-retry`
- Export: `GET /api/v1/notifications/export?format=csv|json`

### Added — Management APIs
- Device Registry: register, list, get, invalidate
- Projects: list, create
- Applications: list, create
- API Keys: list, create (with reveal-once key), revoke
- Templates: list, create, preview, send via template
- Notifications: list, get (with logs + events), cancel
- Analytics: summary with per-channel breakdown + latency percentiles
- Metrics: Prometheus text exposition at `/api/v1/metrics`
- Health: `/api/v1/health` liveness probe
- In-App messages: `GET /api/v1/inapp/messages?userId=`

### Added — Real Provider Integrations
- **FCM** (Android Push) — HTTP v1 API + OAuth2 JWT flow (RS256) with service account
- **APNs** (iOS Push) — HTTP/2 Provider API + ES256 JWT with raw ECDSA signature
- **Huawei HMS Push Kit** — OAuth2 client_credentials + Push Kit v2 send
- **SendGrid** (Email) — v3 mail/send with templates, attachments, categories
- **Twilio** (SMS) — Messages API with media support
- **Web Push** — VAPID (RFC 8292) + aes128gcm encryption (RFC 8291)
- Automatic fallback to simulated mode when credentials are missing

### Added — Dashboard
- 17 sections in unified Arabic RTL interface:
  - **System**: Search, Provider Health, Integration Test, Team, Settings
  - **Admin**: Overview, Channels, Notifications, Analytics, Devices, Projects, Applications, API Keys, Templates, Audit Log
  - **Developer**: API Playground, SDK & Docs
- Dark/Light mode toggle with persistence
- Live charts (Recharts): area, bar, pie, line for analytics
- Interactive API Playground with cURL preview
- Bulk selection + bulk cancel/retry in notifications table
- CSV/JSON export with master key authentication
- Global search across notifications, devices, projects, apps, templates, api keys

### Added — Real-time Service
- Mini-service on port 3003 (socket.io) for in-app notifications
- Control server on port 3004 for /health and /broadcast
- Auto-broadcast from inapp engine when notifications are delivered

### Added — SDKs (14 languages)
- TypeScript (`@notifyforge/sdk`) — full strongly-typed SDK with retries
- Python, Go, Rust, Java, Kotlin, Swift, C#, PHP, Flutter, JavaScript, Node.js, React Native, Unity
- All share identical channel-isolated API surface

### Added — Deployment
- Docker Compose (PostgreSQL, Redis, ClickHouse, MinIO, Prometheus, Grafana, Loki)
- Multi-stage Dockerfile (non-root, ~150MB)
- ClickHouse analytics rollup schema with materialized views
- Kubernetes manifests (Deployments, HPAs, Services, Ingress with TLS, PDBs, NetworkPolicy)
- Helm chart (Chart.yaml, values.yaml, 5 templates)

### Added — Documentation
- ARCHITECTURE.md (16 sections: philosophy, service decomposition, data model, lifecycle, security, observability, deployment, performance targets)
- README.md with quickstart, architecture diagram, API reference
- CONTRIBUTING.md, CHANGELOG.md, LICENSE (MIT)

### Added — CI/CD
- GitHub Actions workflow: lint + typecheck + build + SDK type-check
- `.env.example` with all environment variables documented

### Performance Targets
- API p50 latency: < 50ms
- API p99 latency: < 200ms
- Worker pickup: < 100ms
- Push delivery (FCM/APNs): < 2s end-to-end
- Throughput per API pod: ~5,000 req/s
- Throughput per worker pod: ~2,000 dispatches/s

### Security
- API keys: 32-byte base64url, SHA-256 hashed (never stored plaintext)
- RBAC: 18 scopes across channels and admin resources
- Rate limiting: token-bucket per API key
- Audit log: immutable record of every mutating call
- Webhook signature verification with replay protection (300s window)
- IP allowlist support (per-organization)
- TLS 1.3 in transit, encryption at rest (PostgreSQL TDE, ClickHouse encrypted volumes)

### Localization
- Full Arabic (ar) UI with RTL layout
- Arabic numerals and date formatting (ar-EG locale)
- Cairo font for Arabic + Geist for Latin
- Code blocks remain LTR for readability
