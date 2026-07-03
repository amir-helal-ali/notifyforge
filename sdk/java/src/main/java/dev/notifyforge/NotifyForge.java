// NotifyForge Java SDK — channel-isolated notification infrastructure.
package dev.notifyforge;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

public class NotifyForge {
    private static final String VERSION = "1.0.0";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String apiKey;
    private final String baseUrl;
    private final HttpClient http;

    public NotifyForge(String apiKey) {
        this(apiKey, "https://api.notifyforge.dev");
    }

    public NotifyForge(String apiKey, String baseUrl) {
        if (apiKey == null || apiKey.isEmpty()) {
            throw new IllegalArgumentException("apiKey is required");
        }
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replaceAll("/$", "");
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    public ChannelClient push() { return new ChannelClient(this, "push"); }
    public ChannelClient email() { return new ChannelClient(this, "email"); }
    public ChannelClient sms() { return new ChannelClient(this, "sms"); }
    public ChannelClient webpush() { return new ChannelClient(this, "webpush"); }
    public ChannelClient inapp() { return new ChannelClient(this, "inapp"); }
    public ChannelClient webhook() { return new ChannelClient(this, "webhook"); }
    public ChannelClient desktop() { return new ChannelClient(this, "desktop"); }

    @SuppressWarnings("unchecked")
    public Map<String, Object> request(String method, String path, Object body) throws Exception {
        String url = baseUrl + path;
        HttpRequest.Builder req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .header("User-Agent", "notifyforge-java/" + VERSION);
        if (body != null) {
            String json = MAPPER.writeValueAsString(body);
            req.method(method, HttpRequest.BodyPublishers.ofString(json));
        } else {
            req.method(method, HttpRequest.BodyPublishers.noBody());
        }
        HttpResponse<String> resp = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        String text = resp.body();
        if (text == null || text.isEmpty()) return Map.of();
        Map<String, Object> parsed = MAPPER.readValue(text, Map.class);
        if (resp.statusCode() >= 400) {
            Map<String, Object> err = (Map<String, Object>) parsed.get("error");
            throw new NotifyForgeException(
                (String) err.get("code"),
                (String) err.get("message"),
                resp.statusCode()
            );
        }
        return parsed;
    }

    public static class ChannelClient {
        private final NotifyForge client;
        private final String channel;
        public ChannelClient(NotifyForge client, String channel) {
            this.client = client;
            this.channel = channel;
        }
        public Map<String, Object> send(Map<String, Object> body) throws Exception {
            return client.request("POST", "/api/v1/" + channel + "/send", body);
        }
    }

    public static class NotifyForgeException extends RuntimeException {
        public final String code;
        public final int status;
        public NotifyForgeException(String code, String message, int status) {
            super(code + ": " + message);
            this.code = code;
            this.status = status;
        }
    }
}
