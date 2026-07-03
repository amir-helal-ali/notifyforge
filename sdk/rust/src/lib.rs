//! NotifyForge Rust SDK — channel-isolated notification infrastructure.
//!
//! Usage:
//! ```no_run
//! use notifyforge::{NotifyForge, Channel, TargetSpec};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), notifyforge::Error> {
//!     let nf = NotifyForge::new("nf_live_...")?;
//!     nf.push().send(serde_json::json!({
//!         "channel": "push_android",
//!         "target": { "externalUserId": "user-001" },
//!         "payload": { "title": "Hi", "body": "World" }
//!     })).await?;
//!     Ok(())
//! }
//! ```

use reqwest::{header, Client as HttpClient, Method, Response, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use thiserror::Error;

pub const VERSION: &str = "1.0.0";

#[derive(Debug, Error)]
pub enum Error {
    #[error("notifyforge: {code}: {message} (status {status})")]
    Api {
        code: String,
        message: String,
        status: u16,
        details: Option<Value>,
    },
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("config error: {0}")]
    Config(String),
}

#[derive(Debug, Clone)]
pub struct NotifyForge {
    api_key: String,
    base_url: String,
    http: HttpClient,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendResponse {
    pub id: String,
    pub channel: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_id: Option<String>,
    pub queued_at: String,
}

impl NotifyForge {
    pub fn new(api_key: &str) -> Result<Self, Error> {
        if api_key.is_empty() {
            return Err(Error::Config("api_key is required".into()));
        }
        let http = HttpClient::builder()
            .timeout(Duration::from_secs(30))
            .build()?;
        Ok(Self {
            api_key: api_key.to_string(),
            base_url: "https://api.notifyforge.dev".to_string(),
            http,
        })
    }

    pub fn with_base_url(mut self, url: &str) -> Self {
        self.base_url = url.trim_end_matches('/').to_string();
        self
    }

    pub fn push(&self) -> ChannelClient { ChannelClient::new(self.clone(), "push") }
    pub fn email(&self) -> ChannelClient { ChannelClient::new(self.clone(), "email") }
    pub fn sms(&self) -> ChannelClient { ChannelClient::new(self.clone(), "sms") }
    pub fn webpush(&self) -> ChannelClient { ChannelClient::new(self.clone(), "webpush") }
    pub fn inapp(&self) -> ChannelClient { ChannelClient::new(self.clone(), "inapp") }
    pub fn webhook(&self) -> ChannelClient { ChannelClient::new(self.clone(), "webhook") }
    pub fn desktop(&self) -> ChannelClient { ChannelClient::new(self.clone(), "desktop") }

    pub async fn request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Value, Error> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self
            .http
            .request(method, &url)
            .header(header::AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::USER_AGENT, format!("notifyforge-rust/{}", VERSION));
        if let Some(b) = body {
            req = req.json(&b);
        }
        let resp = req.send().await?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            let parsed: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
            let err = &parsed["error"];
            return Err(Error::Api {
                code: err["code"].as_str().unwrap_or("http_error").to_string(),
                message: err["message"].as_str().unwrap_or("unknown").to_string(),
                status: status.as_u16(),
                details: err["details"].as_object().cloned().map(|m| Value::Object(m)),
            });
        }
        if text.is_empty() {
            return Ok(Value::Null);
        }
        Ok(serde_json::from_str(&text)?)
    }
}

#[derive(Debug, Clone)]
pub struct ChannelClient {
    client: NotifyForge,
    channel: String,
}

impl ChannelClient {
    fn new(client: NotifyForge, channel: &str) -> Self {
        Self { client, channel: channel.to_string() }
    }
    pub async fn send(&self, body: Value) -> Result<SendResponse, Error> {
        let path = format!("/api/v1/{}/send", self.channel);
        let v = self.client.request(Method::POST, &path, Some(body)).await?;
        Ok(serde_json::from_value(v)?)
    }
}
