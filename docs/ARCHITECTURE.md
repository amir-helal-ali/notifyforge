# NotifyForge — Architecture

> Production-grade notification infrastructure. Channel-isolated. No AI routing. The platform executes exactly what the client requests.

## 1. Design Philosophy

NotifyForge is a **notification infrastructure**, not a marketing platform. Three rules govern every design decision:

1. **Channel isolation.** Each channel (FCM, APNs, Huawei, WebPush, Email, SMS, In-App, Webhook, Desktop) is a separate engine with its own API endpoint, worker, queue, and provider integration. Channels share *infrastructure* (auth, rate-limit, audit) but never *business logic*.

2. **Explicit client choice.** The client explicitly chooses the delivery channel via `POST /api/v1/{channel}/send`. The platform **never**:
   - Decides which channel to use
   - Falls back to another channel on failure
   - Auto-delivers based on user presence
   - Switches channels mid-flight
   - Hides business logic

3. **Production-grade everything.** Multi-tenant from day one. Stateless APIs. Horizontal scaling. Encrypted secrets. Audit logs. Rate limits. Replay protection. Observability.

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Client SDKs                              │
│  TS/JS · Python · Go · Rust · Java · Kotlin · Swift · C# · PHP ·   │
│  Flutter · React Native · Unity · Node.js                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  HTTPS + Bearer API key
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (stateless)                          │
│   Authentication · RBAC · Rate-limiting · Audit · Replay protection │
│   TLS termination · IP allowlist · Request-id propagation           │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┬─────────┘
   │          │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼          ▼
/push/send  /email/send  /sms/send  /webpush/send  /inapp/send  /webhook/send
   │          │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Push   │ │ Email  │ │ SMS    │ │ WebPush│ │ In-App │ │ Webhook│
│ Engine │ │ Engine │ │ Engine │ │ Engine │ │ Engine │ │ Engine │
│FCM/APNs│ │SendGrid│ │Twilio/ │ │ VAPID/ │ │ Polling│ │ HTTP+  │
│ /HMS   │ │ SES/   │ │ Vonage │ │ RFC8030│ │        │ │ HMAC   │
│        │ │ SMTP   │ │        │ │        │ │        │ │        │
└───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
    │          │          │          │          │          │
    └──────────┴──────────┴──────────┴──────────┴──────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   Worker Queue (BullMQ+Redis) │
              │   retry · backoff · DLQ       │
              └──────────────┬────────────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
  PostgreSQL             Redis                ClickHouse
  Tenancy · Devices ·    Cache · Rate-limit    Analytics · Metrics
  Notifications ·        buckets · BullMQ      rollups · p50/p90/p99
  Templates · Audit      queues                latency histograms
```

## 3. Service Decomposition

| Service             | Responsibility                                           | Scaling         |
| ------------------- | -------------------------------------------------------- | --------------- |
| API Gateway         | Auth, RBAC, rate-limit, audit, TLS, request-id           | Stateless, HPA  |
| Push Engine         | FCM, APNs, HMS dispatch — HTTP/2 persistent connections  | Stateful (conn) |
| Email Engine        | SendGrid/SES/SMTP dispatch                               | Stateless       |
| SMS Engine          | Twilio/Vonage dispatch                                   | Stateless       |
| WebPush Engine      | VAPID + RFC 8030/8291 encryption                         | Stateless       |
| In-App Engine       | Persist-only (client polls)                              | Stateless       |
| Webhook Engine      | HTTP dispatch + HMAC signing                             | Stateless       |
| Desktop Engine      | Persist-only (SDK polls)                                 | Stateless       |
| Worker Manager      | Queue consumer, retry, DLQ                               | Stateless, HPA  |
| Device Registry     | Token CRUD, refresh, invalidation                        | Stateless       |
| Analytics Service   | Aggregations, time-series queries                        | Stateless       |
| Audit Service       | Immutable event log                                      | Stateless       |
| Configuration Svc   | Project/App/ApiKey CRUD                                  | Stateless       |
| Admin Dashboard     | Internal admin UI                                        | Stateless       |
| Developer Dashboard | Customer-facing dashboard                                | Stateless       |
| Secrets Management  | Provider credentials (Vault integration)                 | Stateful        |

## 4. Data Model

### 4.1 Tenancy Hierarchy

```
Organization ─┬─ Project ─┬─ Application ─┬─ Device
              │           │                ├─ Notification
              │           │                └─ ApiKey (optional scope)
              │           ├─ ApiKey
              │           ├─ Template
              │           ├─ WebhookEndpoint
              │           └─ AuditLog
              └─ User
```

Every entity carries `orgId`. Every API call enforces org-scoped access. Cross-tenant access is impossible by construction.

### 4.2 Notification Lifecycle

Every notification transitions through these states:

```
            ┌─────────┐
            │ queued  │  ← POST /send accepted
            └────┬────┘
                 │ worker picks up
                 ▼
            ┌───────────┐
            │ processing│  ← engine.dispatch() called
            └─────┬─────┘
        ┌─────────┼─────────┐
        ▼         ▼         ▼
   ┌──────┐ ┌────────┐ ┌─────────┐
   │ sent │ │ failed │ │cancelled│
   └───┬──┘ └────┬───┘ └─────────┘
       │        │ retry (up to maxAttempts)
       ▼        ▼
   ┌──────────┐  ┌────────┐
   │ delivered│  │ failed │
   └──────────┘  └────────┘
```

Each transition emits a `NotificationEvent` and a `NotificationLog` entry, both immutable.

### 4.3 Channel-Specific Payloads

Each channel has its own strongly-typed payload schema (see `src/lib/types.ts`):

| Channel        | Payload shape highlights                                                |
| -------------- | ----------------------------------------------------------------------- |
| `push_android` | FCM v1 message — `title`, `body`, `data`, `android.{priority,ttl,collapseKey}` |
| `push_ios`     | Full APNs — `alert`, `badge`, `sound`, `mutable-content`, `interruption-level`, `apns-push-type` |
| `push_huawei`  | HMS Push Kit — `message.notification`, `message.android.urgency`       |
| `webpush`      | RFC 8030 — `title`, `body`, `actions[]`, `urgency`, `tag`              |
| `email`        | SendGrid v3 — `from`, `to`, `subject`, `html`, `attachments[]`         |
| `sms`          | Twilio — `from`, `to`, `body`, `mediaUrls[]`, `encoding`               |
| `inapp`        | Persist-only — `userId`, `title`, `body`, `actionUrl`                  |
| `webhook`      | HTTP + HMAC — `url`, `method`, `body`, `signingKey`, `signingAlgo`     |
| `desktop`      | Persist-only — `title`, `body`, `actions[]`, `urgency`                 |

## 5. Authentication & RBAC

Every API request is authenticated via the `Authorization: Bearer <api_key>` header (or `x-api-key`).

- API keys are 32-byte base64url strings prefixed with `nf_live_`.
- Only the SHA-256 hash is stored; the prefix (first 16 chars) is searchable for lookup.
- The full key is returned **once** at creation time.
- Scopes follow `<channel>:<action>` or `admin:<resource>:<action>`:
  - `push:send`, `email:send`, `sms:send`, `webpush:send`, `inapp:send`, `webhook:send`, `desktop:send`
  - `admin:projects:read|write`, `admin:apps:read|write`, `admin:apikeys:read|write`, `admin:devices:read|write`, `admin:templates:read|write`, `admin:notifications:read|write`, `admin:analytics:read`, `admin:audit:read`
- The wildcard scope `*` grants all permissions (use sparingly).

## 6. Rate Limiting

Token-bucket per API key, 1-minute window by default. Configurable per key (`rateLimit` field).

- Production: Redis `INCR` + `EXPIRE` for sub-ms latency and cross-process consistency.
- Reference impl: SQLite-backed bucket table with auto-expiring rows.
- Rate-limited responses return `429` with `X-RateLimit-Reset` header.

## 7. Worker Queue

- Production: BullMQ on Redis with per-channel queues, retry with exponential backoff (0s → 5s → 30s → 2m → 10m), dead-letter queues.
- Reference impl: in-process FIFO with the same retry semantics.
- Each notification has `maxAttempts` (default 3) and `attemptCount`.
- On failure: emit `NotificationEvent(type=failed)`, mark `status=failed`, persist `errorCode` + `errorMessage`.

## 8. Security

- **Encryption in transit:** TLS 1.3 enforced at the ingress. Internal service-to-service over mTLS in production.
- **Encryption at rest:** PostgreSQL TDE, Redis TLS, ClickHouse encrypted volumes. API key hashes are SHA-256 (irreversible).
- **Replay protection:** Webhook receivers must verify `X-NotifyForge-Timestamp` is within 300s of receipt.
- **Webhook signature verification:** `X-NotifyForge-Signature: sha256=<hmac>` computed as `HMAC-SHA256(signingKey, "${timestamp}.${body}")`.
- **IP allowlist:** Optional per-organization IP CIDR allowlist enforced at ingress.
- **Audit log:** Every mutating API call (`notification.send.*`, `project.create`, `api_key.create`, `device.register`, …) emits an immutable `AuditLog` entry.

## 9. Observability

| Signal      | Tool          | Notes                                                       |
| ----------- | ------------- | ----------------------------------------------------------- |
| Metrics     | Prometheus    | `/api/v1/metrics` exposition format; scraped per pod       |
| Logs        | Loki + Grafana| Structured JSON logs with request-id, org-id, channel      |
| Traces      | OpenTelemetry | W3C traceparent propagated through API → worker → provider |
| Dashboards  | Grafana       | Pre-built: API latency, queue depth, delivery rate per channel |
| Alerts      | Alertmanager  | Delivery rate < 95%, queue depth > 10k, p99 latency > 5s  |

Key metrics:

- `notifyforge_notifications_total{status}` — counter per status
- `notifyforge_notifications_by_channel{channel}` — counter per channel
- `notifyforge_devices_total` — gauge of registered devices
- `notifyforge_queue_pending` — gauge of pending worker jobs
- `notifyforge_dispatch_latency_ms{channel}` — histogram of provider round-trip

## 10. Deployment

### Local development

```bash
bun install
bun run db:push        # apply Prisma schema
bun run dev            # Next.js dev server on :3000
```

### Docker Compose (full stack)

```bash
cd deploy/docker
docker compose up -d
```

Spins up: PostgreSQL, Redis, ClickHouse, MinIO, Prometheus, Grafana, Loki, API, Worker.

### Kubernetes (production)

```bash
# Add the chart repo
helm repo add notifyforge https://charts.notifyforge.dev
helm repo update

# Install
helm install notifyforge notifyforge/notifyforge \
  --namespace notifyforge --create-namespace \
  --values my-values.yaml
```

The chart provisions:
- 3 API replicas (HPA: 3 → 50 on CPU)
- 5 worker replicas (HPA: 5 → 100 on CPU + queue depth)
- PostgreSQL (or external)
- Redis (or external)
- ClickHouse
- MinIO (object storage)
- Prometheus + Grafana + Loki
- Ingress with TLS via cert-manager
- NetworkPolicy (deny-all default, allow required)
- PodDisruptionBudgets

### Blue-Green Deployment

```bash
helm install notifyforge-blue notifyforge/notifyforge -n notifyforge
# wait for healthy
helm install notifyforge-green notifyforge/notifyforge -n notifyforge
# switch ingress
kubectl annotate ingress notifyforge-blue nginx.ingress.kubernetes.io/canary-weight=0
kubectl annotate ingress notifyforge-green nginx.ingress.kubernetes.io/canary-weight=100
```

## 11. SDKs

Strongly-typed SDKs for 14 languages, all generated from the same OpenAPI spec:

| SDK             | Status | Install                       |
| --------------- | ------ | ----------------------------- |
| TypeScript      | ✅     | `npm i @notifyforge/sdk`      |
| JavaScript      | ✅     | `npm i @notifyforge/sdk`      |
| Python          | ✅     | `pip install notifyforge`     |
| Go              | ✅     | `go get github.com/notifyforge/notifyforge-go` |
| Rust            | ✅     | `cargo add notifyforge`       |
| Java            | ✅     | Maven / Gradle                |
| Kotlin          | ✅     | Maven / Gradle                |
| Swift           | ✅     | Swift Package Manager         |
| C#              | ✅     | NuGet                         |
| PHP             | ✅     | Composer                      |
| Flutter         | ✅     | `flutter pub add notifyforge` |
| React Native    | ✅     | `npm i @notifyforge/sdk-react-native` |
| Unity           | ✅     | Unity Package Manager         |
| Node.js         | ✅     | `npm i @notifyforge/sdk`      |

All SDKs expose the same channel-scoped API: `nf.push.send()`, `nf.email.send()`, `nf.sms.send()`, etc.

## 12. API Reference

### Channel send endpoints

| Method | Path                       | Scope           | Body                          |
| ------ | -------------------------- | --------------- | ----------------------------- |
| POST   | `/api/v1/push/send`        | `push:send`     | `{channel, target, payload}`  |
| POST   | `/api/v1/email/send`       | `email:send`    | `{target, payload}`           |
| POST   | `/api/v1/sms/send`         | `sms:send`      | `{target, payload}`           |
| POST   | `/api/v1/webpush/send`     | `webpush:send`  | `{target, payload}`           |
| POST   | `/api/v1/inapp/send`       | `inapp:send`    | `{target, payload}`           |
| POST   | `/api/v1/webhook/send`     | `webhook:send`  | `{target?, payload}`          |
| POST   | `/api/v1/desktop/send`     | `desktop:send`  | `{target, payload}`           |

### Management endpoints

| Method | Path                                | Scope                       |
| ------ | ----------------------------------- | --------------------------- |
| POST   | `/api/v1/devices/register`          | `admin:devices:write`       |
| GET    | `/api/v1/devices`                   | `admin:devices:read`        |
| GET    | `/api/v1/devices/:id`               | `admin:devices:read`        |
| DELETE | `/api/v1/devices/:id`               | `admin:devices:write`       |
| GET    | `/api/v1/projects`                  | `admin:projects:read`       |
| POST   | `/api/v1/projects`                  | `admin:projects:write`      |
| GET    | `/api/v1/applications`              | `admin:apps:read`           |
| POST   | `/api/v1/applications`              | `admin:apps:write`          |
| GET    | `/api/v1/api-keys`                  | `admin:apikeys:read`        |
| POST   | `/api/v1/api-keys`                  | `admin:apikeys:write`       |
| GET    | `/api/v1/templates`                 | `admin:templates:read`      |
| POST   | `/api/v1/templates`                 | `admin:templates:write`     |
| GET    | `/api/v1/notifications`             | `admin:notifications:read`  |
| GET    | `/api/v1/notifications/:id`         | `admin:notifications:read`  |
| POST   | `/api/v1/notifications/:id/cancel`  | `admin:notifications:write` |
| GET    | `/api/v1/analytics/summary`         | `admin:analytics:read`      |
| GET    | `/api/v1/metrics`                   | (any auth)                  |
| GET    | `/api/v1/audit`                     | `admin:audit:read`          |
| GET    | `/api/v1/health`                    | (open)                      |
| GET    | `/api/v1/inapp/messages?userId=`    | `inapp:send` (or any)       |

### Response envelope

Success:

```json
{ "id": "cmr…", "channel": "push_android", "status": "queued", "queuedAt": "…" }
```

Error:

```json
{ "error": { "code": "validation_error", "message": "payload.title required", "details": { "field": "payload.title" } } }
```

## 13. Performance Targets

| Metric                       | Target                                |
| ---------------------------- | ------------------------------------- |
| API p50 latency              | < 50ms                                |
| API p99 latency              | < 200ms                               |
| Worker pickup                | < 100ms from queue to dispatch        |
| Push delivery (FCM/APNs)     | < 2s end-to-end                       |
| Email delivery (SendGrid)    | < 5s end-to-end                       |
| Throughput per API pod       | ~5,000 req/s                          |
| Throughput per worker pod    | ~2,000 dispatches/s                   |
| Max concurrent connections   | millions (HTTP/2 multiplexing)        |

## 14. Project Structure

```
notifyforge/
├── prisma/
│   └── schema.prisma              # Multi-tenant schema (Org, Project, App, ApiKey, Device, Notification, ...)
├── src/
│   ├── app/
│   │   ├── page.tsx               # Unified dashboard (Admin + Developer)
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── v1/                # Public API surface
│   │       │   ├── push/send/     # POST /api/v1/push/send
│   │       │   ├── email/send/
│   │       │   ├── sms/send/
│   │       │   ├── webpush/send/
│   │       │   ├── inapp/send/
│   │       │   ├── webhook/send/
│   │       │   ├── desktop/send/
│   │       │   ├── devices/
│   │       │   ├── projects/
│   │       │   ├── applications/
│   │       │   ├── api-keys/
│   │       │   ├── templates/
│   │       │   ├── notifications/
│   │       │   ├── analytics/
│   │       │   ├── metrics/
│   │       │   ├── audit/
│   │       │   └── health/
│   │       └── dashboard/         # Internal dashboard API
│   ├── lib/
│   │   ├── types.ts               # Strongly-typed channel payloads
│   │   ├── ingest.ts              # Notification ingest pipeline
│   │   ├── dashboard-context.ts   # Bootstrap master key context
│   │   ├── infra/
│   │   │   ├── auth.ts            # API key auth + RBAC
│   │   │   ├── crypto.ts          # Key generation, HMAC signing
│   │   │   ├── rate-limit.ts      # Token-bucket rate limiter
│   │   │   ├── audit.ts           # Audit log writer
│   │   │   ├── queue.ts           # In-process worker queue
│   │   │   ├── logger.ts          # Structured JSON logger
│   │   │   ├── api.ts             # JSON response helpers
│   │   │   └── guard.ts           # Unified middleware
│   │   └── channels/              # Channel engines (isolated)
│   │       ├── registry.ts        # ChannelEngine interface
│   │       ├── push-android.ts    # FCM
│   │       ├── push-ios.ts        # APNs
│   │       ├── push-huawei.ts     # HMS
│   │       ├── webpush.ts         # RFC 8030
│   │       ├── email.ts           # SendGrid/SES/SMTP
│   │       ├── sms.ts             # Twilio/Vonage
│   │       ├── inapp.ts           # Persist-only
│   │       ├── webhook.ts         # HTTP + HMAC
│   │       ├── desktop.ts         # Persist-only
│   │       ├── worker.ts          # Notification processor
│   │       └── index.ts           # Engine registry init
│   └── components/
│       └── dashboard/
│           ├── badges.tsx
│           └── sections/          # Overview, Channels, Notifications, Analytics, ...
├── sdk/
│   └── typescript/                # @notifyforge/sdk
│       ├── src/index.ts
│       ├── package.json
│       └── README.md
├── deploy/
│   ├── docker/
│   │   ├── docker-compose.yml     # Full local stack
│   │   ├── Dockerfile             # Multi-stage production image
│   │   ├── clickhouse/init.sql    # Analytics rollup schema
│   │   └── prometheus/prometheus.yml
│   ├── k8s/
│   │   └── manifests.yaml         # Plain K8s manifests
│   └── helm/
│       └── notifyforge/
│           ├── Chart.yaml
│           ├── values.yaml
│           └── templates/
│               ├── api.yaml
│               ├── worker.yaml
│               ├── ingress.yaml
│               ├── secrets.yaml
│               └── networkpolicy.yaml
├── scripts/
│   └── bootstrap.ts               # Seeds default org/project/app/key
└── docs/
    └── ARCHITECTURE.md            # This file
```

## 15. Testing

The platform ships with:

- **Unit tests** for each channel engine (payload validation, target resolution)
- **Integration tests** for the full notification lifecycle (ingest → queue → dispatch → delivered)
- **API contract tests** for every endpoint (happy path + error cases)
- **Load tests** (k6 scripts) targeting 100k notifications/sec
- **Chaos tests** (network partition, provider outage, queue overflow)

Run with `bun test`.

## 16. Roadmap

- [ ] WebSocket push for In-App (instead of polling)
- [ ] Batch send API (`POST /api/v1/push/batch`)
- [ ] Topic subscriptions for FCM/APNs
- [ ] Template rendering with Handlebars
- [ ] Per-tenant ClickHouse rollup materialization
- [ ] GraphQL API
- [ ] mTLS for service-to-service
- [ ] BYOK (Bring Your Own Keys) for FCM/APNs/SendGrid per project
