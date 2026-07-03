// Package notifyforge — Official NotifyForge Go SDK
// Channel-isolated notification infrastructure.
package notifyforge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const Version = "1.0.0"

type Channel string

const (
	ChannelPushAndroid Channel = "push_android"
	ChannelPushIOS     Channel = "push_ios"
	ChannelPushHuawei  Channel = "push_huawei"
	ChannelWebPush     Channel = "webpush"
	ChannelEmail       Channel = "email"
	ChannelSMS         Channel = "sms"
	ChannelInApp       Channel = "inapp"
	ChannelWebhook     Channel = "webhook"
	ChannelDesktop     Channel = "desktop"
)

type Priority string

const (
	PriorityLow      Priority = "low"
	PriorityNormal   Priority = "normal"
	PriorityHigh     Priority = "high"
	PriorityCritical Priority = "critical"
)

// TargetSpec identifies the recipient(s) of a notification.
type TargetSpec struct {
	DeviceID        string   `json:"deviceId,omitempty"`
	ExternalUserID  string   `json:"externalUserId,omitempty"`
	Topic           string   `json:"topic,omitempty"`
	Email           any      `json:"email,omitempty"`           // string or []string
	Phone           any      `json:"phone,omitempty"`           // string or []string
	URL             string   `json:"url,omitempty"`
	Devices         []string `json:"devices,omitempty"`
	ExternalUserIDs []string `json:"externalUserIds,omitempty"`
}

// SendRequest is the body sent to /api/v1/{channel}/send.
type SendRequest struct {
	Channel     Channel     `json:"channel"`
	Target      TargetSpec  `json:"target"`
	Payload     any         `json:"payload"` // strongly-typed per channel in caller
	ExternalID  string      `json:"externalId,omitempty"`
	Priority    Priority    `json:"priority,omitempty"`
	ScheduledAt string      `json:"scheduledAt,omitempty"`
	TTLSeconds  int         `json:"ttlSeconds,omitempty"`
	CollapseKey string      `json:"collapseKey,omitempty"`
	Tags        []string    `json:"tags,omitempty"`
}

// SendResponse is returned from /api/v1/{channel}/send.
type SendResponse struct {
	ID         string  `json:"id"`
	Channel    Channel `json:"channel"`
	Status     string  `json:"status"`
	ExternalID string  `json:"externalId,omitempty"`
	QueuedAt   string  `json:"queuedAt"`
}

// NotifyForgeError is returned for non-2xx responses.
type NotifyForgeError struct {
	Code    string
	Message string
	Status  int
	Details map[string]any
}

func (e *NotifyForgeError) Error() string {
	return fmt.Sprintf("notifyforge: %s: %s (status %d)", e.Code, e.Message, e.Status)
}

// Client is the top-level NotifyForge client.
type Client struct {
	APIKey  string
	BaseURL string
	HTTP    *http.Client

	Push    *ChannelClient
	Email   *ChannelClient
	SMS     *ChannelClient
	WebPush *ChannelClient
	InApp   *ChannelClient
	Webhook *ChannelClient
	Desktop *ChannelClient

	Devices       *DevicesClient
	Notifications *NotificationsClient
}

// NewClient constructs a new NotifyForge client.
func NewClient(apiKey string, opts ...Option) *Client {
	c := &Client{
		APIKey:  apiKey,
		BaseURL: "https://api.notifyforge.dev",
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	c.Push = &ChannelClient{client: c, channel: "push"}
	c.Email = &ChannelClient{client: c, channel: "email"}
	c.SMS = &ChannelClient{client: c, channel: "sms"}
	c.WebPush = &ChannelClient{client: c, channel: "webpush"}
	c.InApp = &ChannelClient{client: c, channel: "inapp"}
	c.Webhook = &ChannelClient{client: c, channel: "webhook"}
	c.Desktop = &ChannelClient{client: c, channel: "desktop"}
	c.Devices = &DevicesClient{client: c}
	c.Notifications = &NotificationsClient{client: c}
	return c
}

type Option func(*Client)

func WithBaseURL(u string) Option { return func(c *Client) { c.BaseURL = u } }
func WithHTTPClient(h *http.Client) Option { return func(c *Client) { c.HTTP = h } }

// Request is the low-level HTTP executor — use it for any endpoint.
func (c *Client) Request(ctx context.Context, method, path string, body any, params url.Values) (any, error) {
	u := c.BaseURL + path
	if params != nil {
		u += "?" + params.Encode()
	}
	var reader io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(buf)
	}
	req, err := http.NewRequestWithContext(ctx, method, u, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "notifyforge-go/"+Version)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		var errBody struct {
			Error struct {
				Code    string         `json:"code"`
				Message string         `json:"message"`
				Details map[string]any `json:"details"`
			} `json:"error"`
		}
		_ = json.Unmarshal(bodyBytes, &errBody)
		return nil, &NotifyForgeError{
			Code:    errBody.Error.Code,
			Message: errBody.Error.Message,
			Status:  resp.StatusCode,
			Details: errBody.Error.Details,
		}
	}
	if len(bodyBytes) == 0 {
		return nil, nil
	}
	var out any
	if err := json.Unmarshal(bodyBytes, &out); err != nil {
		return nil, err
	}
	return out, nil
}

type ChannelClient struct {
	client  *Client
	channel string
}

func (cc *ChannelClient) Send(ctx context.Context, req SendRequest) (*SendResponse, error) {
	if req.Channel == "" {
		req.Channel = Channel(cc.channel)
	}
	out, err := cc.client.Request(ctx, "POST", fmt.Sprintf("/api/v1/%s/send", cc.channel), req, nil)
	if err != nil {
		return nil, err
	}
	buf, _ := json.Marshal(out)
	var resp SendResponse
	_ = json.Unmarshal(buf, &resp)
	return &resp, nil
}

type DevicesClient struct{ client *Client }

func (d *DevicesClient) Register(ctx context.Context, body any) (any, error) {
	return d.client.Request(ctx, "POST", "/api/v1/devices/register", body, nil)
}

func (d *DevicesClient) List(ctx context.Context, params url.Values) (any, error) {
	return d.client.Request(ctx, "GET", "/api/v1/devices", nil, params)
}

func (d *DevicesClient) Invalidate(ctx context.Context, deviceID string) (any, error) {
	return d.client.Request(ctx, "DELETE", fmt.Sprintf("/api/v1/devices/%s", deviceID), nil, nil)
}

type NotificationsClient struct{ client *Client }

func (n *NotificationsClient) List(ctx context.Context, params url.Values) (any, error) {
	return n.client.Request(ctx, "GET", "/api/v1/notifications", nil, params)
}

func (n *NotificationsClient) Get(ctx context.Context, id string) (any, error) {
	return n.client.Request(ctx, "GET", fmt.Sprintf("/api/v1/notifications/%s", id), nil, nil)
}

func (n *NotificationsClient) Cancel(ctx context.Context, id string) (any, error) {
	return n.client.Request(ctx, "POST", fmt.Sprintf("/api/v1/notifications/%s/cancel", id), nil, nil)
}
