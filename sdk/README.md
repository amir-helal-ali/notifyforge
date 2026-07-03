# NotifyForge SDKs

Strongly-typed client SDKs for the NotifyForge notification infrastructure platform.
All SDKs share an identical API surface — pick the language that fits your stack.

## Available SDKs

| Language        | Package / Module                                  | Status | Install                                              |
| --------------- | ------------------------------------------------- | ------ | ---------------------------------------------------- |
| TypeScript      | `@notifyforge/sdk`                                | ✅     | `npm i @notifyforge/sdk` / `bun add @notifyforge/sdk`|
| JavaScript      | `@notifyforge/sdk`                                | ✅     | `npm i @notifyforge/sdk`                             |
| Node.js         | `@notifyforge/sdk`                                | ✅     | `npm i @notifyforge/sdk`                             |
| Python          | `notifyforge`                                     | ✅     | `pip install notifyforge`                            |
| Go              | `github.com/notifyforge/notifyforge-go`           | ✅     | `go get github.com/notifyforge/notifyforge-go`       |
| Rust            | `notifyforge`                                     | ✅     | `cargo add notifyforge`                              |
| Java            | `dev.notifyforge:notifyforge-java`                | ✅     | Maven / Gradle                                       |
| Kotlin          | `dev.notifyforge:notifyforge-kotlin`              | ✅     | Maven / Gradle (coroutines)                          |
| Swift           | `NotifyForge`                                     | ✅     | Swift Package Manager                                |
| C#              | `NotifyForge`                                     | ✅     | `dotnet add package NotifyForge`                     |
| PHP             | `notifyforge/notifyforge-php`                     | ✅     | `composer require notifyforge/notifyforge-php`       |
| Flutter / Dart  | `notifyforge`                                     | ✅     | `flutter pub add notifyforge`                        |
| React Native    | `@notifyforge/sdk-react-native`                   | ✅     | `npm i @notifyforge/sdk-react-native`                |
| Unity           | `NotifyForge`                                     | ✅     | Unity Package Manager (UPM)                          |

## Common API surface

Every SDK exposes the same channel clients:

```text
nf.push.send(...)      // POST /api/v1/push/send     — channel: push_android | push_ios | push_huawei
nf.email.send(...)     // POST /api/v1/email/send
nf.sms.send(...)       // POST /api/v1/sms/send
nf.webpush.send(...)   // POST /api/v1/webpush/send
nf.inapp.send(...)     // POST /api/v1/inapp/send
nf.webhook.send(...)   // POST /api/v1/webhook/send
nf.desktop.send(...)   // POST /api/v1/desktop/send
```

Plus resource clients:

```text
nf.devices.register(...)        // POST /api/v1/devices/register
nf.devices.list(...)            // GET  /api/v1/devices
nf.devices.invalidate(id)       // DELETE /api/v1/devices/{id}

nf.notifications.list(...)      // GET  /api/v1/notifications
nf.notifications.get(id)        // GET  /api/v1/notifications/{id}
nf.notifications.cancel(id)     // POST /api/v1/notifications/{id}/cancel

nf.projects.list/create(...)
nf.applications.list/create(...)
nf.apiKeys.list/create(...)
nf.templates.list/create(...)
nf.analytics.summary(...)
```

## Channel Isolation Guarantee

The SDK **never** re-routes between channels. If you call `nf.push.send()`, the request
goes to `/api/v1/push/send` and nowhere else. There is no automatic fallback, no AI
routing, no hidden channel switching.

## Authentication

All SDKs accept a single `apiKey` constructor argument. The key is sent as
`Authorization: Bearer <api_key>` on every request.

## Error handling

Every SDK throws/raises a typed `NotifyForgeError` (or language equivalent) with:

- `code` — machine-readable error code (`validation_error`, `rate_limited`, `unauthorized`, `forbidden`, `not_found`, `no_targets`, `provider_error`, etc.)
- `message` — human-readable message
- `status` — HTTP status code
- `details` — optional details object (e.g. the field that failed validation)

## Retries

All SDKs retry on network errors and 5xx responses with exponential backoff
(500ms, 1s, 2s, …). 4xx errors are not retried. Configure via the `retries` option.

## Examples

### TypeScript

```ts
import { NotifyForge } from '@notifyforge/sdk';

const nf = new NotifyForge({ apiKey: process.env.NOTIFYFORGE_API_KEY! });

await nf.push.send({
  channel: 'push_android',
  target: { externalUserId: 'user-001' },
  payload: { title: 'Hello', body: 'World' },
});
```

### Python

```python
import os
from notifyforge import NotifyForge

nf = NotifyForge(api_key=os.environ['NOTIFYFORGE_API_KEY'])
nf.push.send(
    channel='push_android',
    target={'externalUserId': 'user-001'},
    payload={'title': 'Hello', 'body': 'World'},
)
```

### Go

```go
import "github.com/notifyforge/notifyforge-go"

nf := notifyforge.NewClient(os.Getenv("NOTIFYFORGE_API_KEY"))
_, err := nf.Push.Send(ctx, notifyforge.SendRequest{
    Channel: notifyforge.ChannelPushAndroid,
    Target:  notifyforge.TargetSpec{ExternalUserID: "user-001"},
    Payload: map[string]any{"title": "Hello", "body": "World"},
})
```

### Rust

```rust
use notifyforge::NotifyForge;

let nf = NotifyForge::new("nf_live_...")?;
nf.push().send(serde_json::json!({
    "channel": "push_android",
    "target": { "externalUserId": "user-001" },
    "payload": { "title": "Hello", "body": "World" }
})).await?;
```

### Swift

```swift
let nf = try NotifyForge(apiKey: "nf_live_...")
let _ = try await nf.push.send([
    "channel": "push_ios",
    "target": ["externalUserId": "user-001"],
    "payload": [
        "alert": ["title": "Hello", "body": "World"],
        "interruption-level": "time-sensitive",
    ],
])
```

## License

MIT
