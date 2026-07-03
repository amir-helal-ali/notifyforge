-- NotifyForge ClickHouse schema — analytics rollup tables
-- Source of truth for delivery metrics, latency histograms, and channel breakdowns.

CREATE DATABASE IF NOT EXISTS notifyforge;

USE notifyforge;

-- Raw event stream (one row per notification state transition)
CREATE TABLE IF NOT EXISTS notification_events (
    event_id          String,
    org_id            String,
    project_id        String,
    application_id    Nullable(String),
    notification_id   String,
    channel           LowCardinality(String),
    provider          LowCardinality(String),
    event_type        LowCardinality(String),
    status            LowCardinality(String),
    priority          LowCardinality(String),
    error_code        Nullable(String),
    attempt           UInt8,
    latency_ms        Nullable(UInt32),
    created_at        DateTime64(3),
    event_time        DateTime64(3) DEFAULT now(),
    day               Date DEFAULT toDate(event_time)
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(day)
ORDER BY (org_id, project_id, channel, event_time, notification_id)
SETTINGS index_granularity = 8192;

-- Materialized rollup: per-channel, per-hour delivery counts
CREATE MATERIALIZED VIEW IF NOT EXISTS rollup_channel_hourly
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (org_id, project_id, channel, hour, status)
AS
SELECT
    org_id,
    project_id,
    channel,
    toStartOfHour(event_time) AS hour,
    status,
    count() AS count,
    sum(if(status = 'delivered' OR status = 'sent', 1, 0)) AS delivered,
    sum(if(status = 'failed', 1, 0)) AS failed,
    sum(latency_ms) AS latency_ms_sum,
    countIf(latency_ms > 0) AS latency_count
FROM notification_events
GROUP BY org_id, project_id, channel, hour, status;

-- Latency histogram (per-channel p50/p90/p99)
CREATE MATERIALIZED VIEW IF NOT EXISTS rollup_latency
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (org_id, channel, day)
AS
SELECT
    org_id,
    channel,
    day,
    quantileState(0.5)(latency_ms) AS latency_p50,
    quantileState(0.9)(latency_ms) AS latency_p90,
    quantileState(0.99)(latency_ms) AS latency_p99
FROM notification_events
WHERE latency_ms > 0
GROUP BY org_id, channel, day;
