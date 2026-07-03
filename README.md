<div dir="rtl">

# 🔔 NotifyForge — منصة البنية التحتية للإشعارات

[![CI](https://github.com/amir-helal-ali/notifyforge/actions/workflows/ci.yml/badge.svg)](https://github.com/amir-helal-ali/notifyforge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**منصة إشعارات بمستوى الإنتاج، عزل القنوات، بلا توجيه بالذكاء الاصطناعي، اختيار صريح للعميل.**

</div>

---

<div dir="rtl">

NotifyForge هي بنية تحتية للإشعارات (وليست منصة تسويقية). كل قناة لها API مستقل، طابور مستقل، عامل معالجة مستقل، ومزود خدمة مستقل. **المنصة لا تقوم أبداً بإعادة التوجيه بين القنوات** — العميل يحدد بوضوح إلى أين يُرسِل.

## ✨ الميزات الرئيسية

### 📡 9 قنوات معزولة بالكامل
- **Android Push** عبر FCM (HTTP v1 + OAuth2 JWT)
- **iOS Push** عبر APNs (HTTP/2 + ES256 JWT، يدعم Live Activities, Critical Alerts, Mutable Content)
- **Huawei Push** عبر HMS Push Kit
- **Web Push** عبر VAPID + RFC 8030/8291 (aes128gcm)
- **Email** عبر SendGrid / SES / SMTP
- **SMS** عبر Twilio / Vonage
- **In-App** عبر WebSocket لحظياً
- **Webhook** مع توقيع HMAC-SHA256 إلزامي
- **Desktop** عبر SDK

### 🏗️ بنية إنتاجية
- متعدد المستأجرين من اليوم الأول
- APIs عديمة الحالة، توسع أفقي
- مصادقة Bearer API key مع RBAC (18 نطاق)
- تحديد معدل token-bucket لكل مفتاح
- سجل تدقيق غير قابل للتعديل
- طابور عمال مع إعادة محاولة + backoff أسي
- حماية من replay للـ webhooks

### 🖥️ لوحة تحكم عربية كاملة
- 17 قسم بالعربية مع دعم RTL
- وضع فاتح/داكن قابل للتبديل
- مختبر API تفاعلي
- بحث شامل + تصدير CSV/JSON
- إدارة الفريق (RBAC)
- مراقبة صحة المزودين
- اختبار التكامل

### 📦 14 SDK
TypeScript · JavaScript · Node.js · Python · Go · Rust · Java · Kotlin · Swift · C# · PHP · Flutter · React Native · Unity

</div>

---

## 📖 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [SDKs](#-sdks)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.1
- Node.js >= 18 (for some tooling)

### Install & Run

```bash
git clone https://github.com/amir-helal-ali/notifyforge.git
cd notifyforge
bun install
cp .env.example .env
bun run db:push
bun run db:generate
bun run dev
```

Open http://localhost:3000 — the platform auto-bootstraps with a master API key on first load.

### Send Your First Notification

```bash
# Get the master API key from the SDK & Docs tab in the dashboard,
# then export it:
export NOTIFYFORGE_API_KEY="nf_live_..."

# Register a device
curl -X POST http://localhost:3000/api/v1/devices/register \
  -H "Authorization: Bearer $NOTIFYFORGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "push_android",
    "token": "fcm-demo-token-1234567890abcdef",
    "externalUserId": "user-001",
    "platform": "android"
  }'

# Send a push notification
curl -X POST http://localhost:3000/api/v1/push/send \
  -H "Authorization: Bearer $NOTIFYFORGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "push_android",
    "target": { "externalUserId": "user-001" },
    "payload": {
      "title": "Hello from NotifyForge",
      "body": "This is a real push notification",
      "data": { "orderId": "12345" }
    },
    "priority": "high"
  }'
```

### Using the TypeScript SDK

```bash
bun add @notifyforge/sdk
```

```typescript
import { NotifyForge } from '@notifyforge/sdk';

const nf = new NotifyForge({ apiKey: process.env.NOTIFYFORGE_API_KEY! });

// Send an Android push
await nf.push.send({
  channel: 'push_android',
  target: { externalUserId: 'user-001' },
  payload: {
    title: 'Order shipped',
    body: 'Your order #12345 is on the way.',
    data: { orderId: '12345' },
    android: { priority: 'high', collapseKey: 'order-status' },
  },
});

// Send an email — explicit, never auto-routed
await nf.email.send({
  target: { email: 'customer@example.com' },
  payload: {
    from: 'notifications@notifyforge.dev',
    to: 'customer@example.com',
    subject: 'Receipt #12345',
    html: '<h1>Thanks!</h1>',
  },
});
```

---

## 🏗️ Architecture

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
│ /HMS   │ │ SES/   │ │ Vonage │ │ RFC8030│ │ + WS   │ │ HMAC   │
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

### Design Principles

1. **Channel isolation** — Each channel is a separate engine with its own API endpoint, worker, queue, and provider integration. Channels share *infrastructure* but never *business logic*.

2. **Explicit client choice** — The client explicitly chooses the delivery channel. The platform **never**:
   - Decides which channel to use
   - Falls back to another channel on failure
   - Auto-delivers based on user presence
   - Switches channels mid-flight

3. **Production-grade everything** — Multi-tenant, stateless APIs, horizontal scaling, encrypted secrets, audit logs, rate limits, replay protection, observability.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture document.

---

## ⚙️ Configuration

All provider credentials are **optional**. The platform runs in simulated mode without them and switches to real delivery when they're set.

```bash
# FCM (Android Push)
FCM_SERVICE_ACCOUNT_JSON='{ "type": "service_account", "project_id": "...", ... }'

# APNs (iOS Push)
APNS_KEY_ID=ABC1234567
APNS_TEAM_ID=DEFGHIJKLM
APNS_BUNDLE_ID=com.example.app
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
APNS_USE_SANDBOX=true

# Huawei HMS Push
HMS_APP_ID=10XXXXXXX
HMS_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# SendGrid (Email)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM=+15551234567

# Web Push (VAPID)
WEBPUSH_VAPID_PUBLIC_KEY=BJxxxxxxxxxxxxxxxxxxxx
WEBPUSH_VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
WEBPUSH_SUBJECT=mailto:admin@example.com
```

See [.env.example](.env.example) for the full list.

---

## 📡 API Reference

### Channel Send Endpoints

| Method | Path                       | Scope           |
| ------ | -------------------------- | --------------- |
| POST   | `/api/v1/push/send`        | `push:send`     |
| POST   | `/api/v1/email/send`       | `email:send`    |
| POST   | `/api/v1/sms/send`         | `sms:send`      |
| POST   | `/api/v1/webpush/send`     | `webpush:send`  |
| POST   | `/api/v1/inapp/send`       | `inapp:send`    |
| POST   | `/api/v1/webhook/send`     | `webhook:send`  |
| POST   | `/api/v1/desktop/send`     | `desktop:send`  |

### Batch Send (up to 1000 items per request)

| Method | Path                       |
| ------ | -------------------------- |
| POST   | `/api/v1/{channel}/batch`  |

### Management Endpoints

| Method | Path                                | Scope                       |
| ------ | ----------------------------------- | --------------------------- |
| POST   | `/api/v1/devices/register`          | `admin:devices:write`       |
| GET    | `/api/v1/devices`                   | `admin:devices:read`        |
| DELETE | `/api/v1/devices/:id`               | `admin:devices:write`       |
| GET    | `/api/v1/projects`                  | `admin:projects:read`       |
| POST   | `/api/v1/projects`                  | `admin:projects:write`      |
| GET    | `/api/v1/applications`              | `admin:apps:read`           |
| POST   | `/api/v1/applications`              | `admin:apps:write`          |
| GET    | `/api/v1/api-keys`                  | `admin:apikeys:read`        |
| POST   | `/api/v1/api-keys`                  | `admin:apikeys:write`       |
| GET    | `/api/v1/templates`                 | `admin:templates:read`      |
| POST   | `/api/v1/templates`                 | `admin:templates:write`     |
| POST   | `/api/v1/templates/:slug/send`      | `admin:templates:read`      |
| POST   | `/api/v1/templates/:slug/preview`   | `admin:templates:read`      |
| GET    | `/api/v1/notifications`             | `admin:notifications:read`  |
| GET    | `/api/v1/notifications/:id`         | `admin:notifications:read`  |
| POST   | `/api/v1/notifications/:id/cancel`  | `admin:notifications:write` |
| POST   | `/api/v1/notifications/bulk-cancel` | `admin:notifications:write` |
| POST   | `/api/v1/notifications/bulk-retry`  | `admin:notifications:write` |
| GET    | `/api/v1/notifications/export`      | `admin:notifications:read`  |
| GET    | `/api/v1/analytics/summary`         | `admin:analytics:read`      |
| GET    | `/api/v1/metrics`                   | (any auth)                  |
| GET    | `/api/v1/audit`                     | `admin:audit:read`          |
| GET    | `/api/v1/health`                    | (open)                      |

---

## 📦 SDKs

| Language        | Package / Module                                  | Install                                              |
| --------------- | ------------------------------------------------- | ---------------------------------------------------- |
| TypeScript      | `@notifyforge/sdk`                                | `npm i @notifyforge/sdk`                             |
| Python          | `notifyforge`                                     | `pip install notifyforge`                            |
| Go              | `github.com/notifyforge/notifyforge-go`           | `go get github.com/notifyforge/notifyforge-go`       |
| Rust            | `notifyforge`                                     | `cargo add notifyforge`                              |
| Java            | `dev.notifyforge:notifyforge-java`                | Maven / Gradle                                       |
| Kotlin          | `dev.notifyforge:notifyforge-kotlin`              | Maven / Gradle (coroutines)                          |
| Swift           | `NotifyForge`                                     | Swift Package Manager                                |
| C#              | `NotifyForge`                                     | `dotnet add package NotifyForge`                     |
| PHP             | `amir-helal-ali/notifyforge-php`                     | `composer require amir-helal-ali/notifyforge-php`       |
| Flutter / Dart  | `notifyforge`                                     | `flutter pub add notifyforge`                        |

See [sdk/README.md](sdk/README.md) for details.

---

## 🚢 Deployment

### Docker Compose (local full stack)

```bash
cd deploy/docker
docker compose up -d
```

Spins up: PostgreSQL, Redis, ClickHouse, MinIO, Prometheus, Grafana, Loki, API, Worker.

### Kubernetes (production)

```bash
helm repo add notifyforge https://charts.notifyforge.dev
helm install notifyforge amir-helal-ali/notifyforge \
  --namespace notifyforge --create-namespace \
  --values my-values.yaml
```

The chart provisions:
- 3 API replicas (HPA: 3 → 50 on CPU)
- 5 worker replicas (HPA: 5 → 100 on CPU + queue depth)
- PostgreSQL, Redis, ClickHouse, MinIO
- Prometheus + Grafana + Loki
- Ingress with TLS via cert-manager
- NetworkPolicy (deny-all default)
- PodDisruptionBudgets

See [deploy/](deploy/) for details.

---

## 📁 Project Structure

```
notifyforge/
├── prisma/schema.prisma              # Multi-tenant schema
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Unified dashboard (17 sections)
│   │   ├── api/v1/                   # Public API (15+ routes)
│   │   └── api/dashboard/            # Internal dashboard API
│   ├── lib/
│   │   ├── types.ts                  # Strongly-typed channel payloads
│   │   ├── ingest.ts                 # Notification ingest pipeline
│   │   ├── batch.ts                  # Batch send processor
│   │   ├── template-engine.ts        # {{variable}} rendering
│   │   ├── infra/                    # auth, rate-limit, queue, audit, crypto, logger
│   │   ├── channels/                 # 9 isolated channel engines
│   │   └── providers/                # Real provider clients (FCM, APNs, ...)
│   └── components/dashboard/sections/
├── mini-services/realtime-service/   # WebSocket service for in-app
├── sdk/                              # 14 SDKs
│   ├── typescript/                   # Full @notifyforge/sdk
│   ├── python/, go/, rust/, ...
├── deploy/
│   ├── docker/                       # Docker Compose + Dockerfile
│   ├── k8s/                          # Kubernetes manifests
│   └── helm/                         # Helm chart
├── docs/ARCHITECTURE.md              # Full architecture doc
├── .github/workflows/ci.yml          # CI: lint + build + SDK check
├── .env.example                      # All env vars documented
├── CONTRIBUTING.md
├── CHANGELOG.md
├── LICENSE                           # MIT
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Flow

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make changes, ensure `bun run lint` passes
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
5. Open a PR linking the related issue

### Security Vulnerabilities

**Do not open a public Issue for security vulnerabilities.** Email `security@notifyforge.dev` instead.

---

## 📜 License

MIT — see [LICENSE](LICENSE).

---

<div dir="rtl">

## 🌟 المميزات بالعربية

- ✅ **9 قنوات معزولة** — FCM, APNs, HMS, Web Push, Email, SMS, In-App, Webhook, Desktop
- ✅ **تكاملات حقيقية** — كل مزود له عميل حقيقي يتعامل مع الـ API الفعلي
- ✅ **14 SDK** — TypeScript, Python, Go, Rust, Java, Kotlin, Swift, C#, PHP, Flutter, إلخ
- ✅ **لوحة تحكم عربية كاملة** — 17 قسم مع دعم RTL وخط Cairo
- ✅ **إرسال مجمع** — حتى 1000 إشعار في طلب واحد
- ✅ **قوالب ديناميكية** — استبدال `{{variable}}` مع قيم افتراضية
- ✅ **إشعارات لحظية** — WebSocket للإشعارات داخل التطبيق
- ✅ **مراقبة المزودين** — حالة لحظية لكل مزود
- ✅ **بحث شامل** — عبر الإشعارات والأجهزة والمشاريع
- ✅ **تصدير** — CSV و JSON حتى 50k صف
- ✅ **CI/CD** — GitHub Actions للـ lint والبناء
- ✅ **جاهز للنشر** — Docker Compose + Kubernetes + Helm

## 📞 التواصل

- 🐛 [Issues](https://github.com/amir-helal-ali/notifyforge/issues)
- 💬 [Discussions](https://github.com/amir-helal-ali/notifyforge/discussions)
- 📧 security@notifyforge.dev (للثغرات الأمنية فقط)

---

**صُنع بعناية فائقة للمطورين الذين يحتاجون بنية تحتية للإشعارات بمستوى المؤسسات.**

</div>
