"""NotifyForge Python SDK — channel-isolated notification infrastructure."""

from __future__ import annotations
import json
import time
from typing import Any, Optional, TypedDict, Union, Literal
import urllib.request, urllib.error


Channel = Literal['push_android', 'push_ios', 'push_huawei', 'webpush', 'email', 'sms', 'inapp', 'webhook', 'desktop']
Priority = Literal['low', 'normal', 'high', 'critical']


class TargetSpec(TypedDict, total=False):
    deviceId: str
    externalUserId: str
    topic: str
    email: Union[str, list[str]]
    phone: Union[str, list[str]]
    url: str
    devices: list[str]
    externalUserIds: list[str]


class SendRequest(TypedDict, total=False):
    channel: Channel
    target: TargetSpec
    payload: dict[str, Any]
    externalId: str
    priority: Priority
    scheduledAt: str
    ttlSeconds: int
    collapseKey: str
    tags: list[str]


class SendResponse(TypedDict):
    id: str
    channel: Channel
    status: str
    externalId: Optional[str]
    queuedAt: str


class NotifyForgeError(Exception):
    def __init__(self, code: str, message: str, status: int, details: Optional[dict] = None):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.status = status
        self.details = details


class NotifyForge:
    """Official NotifyForge Python SDK.

    Usage:
        nf = NotifyForge(api_key=os.environ["NOTIFYFORGE_API_KEY"])
        nf.push.send(channel="push_android", target={"externalUserId": "user-001"}, payload={...})
        nf.email.send(target={"email": "a@b.com"}, payload={...})
    """

    def __init__(self, api_key: str, base_url: str = "https://api.notifyforge.dev", timeout: float = 30.0, retries: int = 2):
        if not api_key:
            raise ValueError("api_key is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.retries = retries
        # Channel clients
        self.push = ChannelClient(self, "push")
        self.email = ChannelClient(self, "email")
        self.sms = ChannelClient(self, "sms")
        self.webpush = ChannelClient(self, "webpush")
        self.inapp = ChannelClient(self, "inapp")
        self.webhook = ChannelClient(self, "webhook")
        self.desktop = ChannelClient(self, "desktop")
        # Resource clients
        self.devices = DevicesClient(self)
        self.notifications = NotificationsClient(self)

    def _request(self, method: str, path: str, body: Optional[dict] = None, params: Optional[dict] = None) -> Any:
        url = self.base_url + path
        if params:
            from urllib.parse import urlencode
            url += "?" + urlencode(params)
        data = json.dumps(body).encode("utf-8") if body is not None else None
        last_exc: Optional[Exception] = None
        for attempt in range(self.retries + 1):
            req = urllib.request.Request(
                url,
                data=data,
                method=method,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "notifyforge-python/1.0.0",
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    body_bytes = resp.read()
                    if not body_bytes:
                        return None
                    return json.loads(body_bytes)
            except urllib.error.HTTPError as e:
                body_bytes = e.read()
                try:
                    err_body = json.loads(body_bytes)
                    err = err_body.get("error", {})
                except Exception:
                    err = {"code": "http_error", "message": str(e)}
                exc = NotifyForgeError(err.get("code", "http_error"), err.get("message", str(e)), e.code, err.get("details"))
                if 400 <= e.code < 500:
                    raise exc
                last_exc = exc
                if attempt < self.retries:
                    time.sleep(2 ** attempt * 0.5)
                    continue
                raise exc
            except urllib.error.URLError as e:
                last_exc = NotifyForgeError("network_error", str(e), 0)
                if attempt < self.retries:
                    time.sleep(2 ** attempt * 0.5)
                    continue
                raise last_exc
        raise last_exc  # type: ignore


class ChannelClient:
    def __init__(self, client: NotifyForge, channel: str):
        self.client = client
        self.channel = channel

    def send(self, **req: Any) -> SendResponse:
        return self.client._request("POST", f"/api/v1/{self.channel}/send", req)


class DevicesClient:
    def __init__(self, client: NotifyForge):
        self.client = client

    def register(self, **body: Any) -> dict:
        return self.client._request("POST", "/api/v1/devices/register", body)

    def list(self, **params: Any) -> dict:
        return self.client._request("GET", "/api/v1/devices", params=params)

    def invalidate(self, device_id: str) -> dict:
        return self.client._request("DELETE", f"/api/v1/devices/{device_id}")


class NotificationsClient:
    def __init__(self, client: NotifyForge):
        self.client = client

    def list(self, **params: Any) -> dict:
        return self.client._request("GET", "/api/v1/notifications", params=params)

    def get(self, notification_id: str) -> dict:
        return self.client._request("GET", f"/api/v1/notifications/{notification_id}")

    def cancel(self, notification_id: str) -> dict:
        return self.client._request("POST", f"/api/v1/notifications/{notification_id}/cancel")
