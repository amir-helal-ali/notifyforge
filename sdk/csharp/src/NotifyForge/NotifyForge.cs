// NotifyForge C# SDK — channel-isolated notification infrastructure.
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace NotifyForge;

public class NotifyForgeException : Exception
{
    public string Code { get; }
    public int Status { get; }
    public NotifyForgeException(string code, string message, int status) : base($"{code}: {message}")
    {
        Code = code;
        Status = status;
    }
}

public class NotifyForge
{
    private const string Version = "1.0.0";
    private readonly string _apiKey;
    private readonly string _baseUrl;
    private readonly HttpClient _http;

    public NotifyForge(string apiKey, string baseUrl = "https://api.notifyforge.dev")
    {
        if (string.IsNullOrEmpty(apiKey)) throw new ArgumentException("apiKey is required");
        _apiKey = apiKey;
        _baseUrl = baseUrl.TrimEnd('/');
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        _http.DefaultRequestHeaders.Add("User-Agent", $"notifyforge-csharp/{Version}");
    }

    public ChannelClient Push => new(this, "push");
    public ChannelClient Email => new(this, "email");
    public ChannelClient Sms => new(this, "sms");
    public ChannelClient WebPush => new(this, "webpush");
    public ChannelClient InApp => new(this, "inapp");
    public ChannelClient Webhook => new(this, "webhook");
    public ChannelClient Desktop => new(this, "desktop");

    public async Task<JsonElement> RequestAsync(string method, string path, object? body = null)
    {
        var req = new HttpRequestMessage(new HttpMethod(method), $"{_baseUrl}{path}");
        if (body != null)
        {
            req.Content = JsonContent.Create(body);
        }
        var resp = await _http.SendAsync(req);
        var text = await resp.Content.ReadAsStringAsync();
        if (string.IsNullOrEmpty(text)) return default;
        var json = JsonSerializer.Deserialize<JsonElement>(text);
        if (!resp.IsSuccessStatusCode)
        {
            var err = json.GetProperty("error");
            throw new NotifyForgeException(
                err.GetProperty("code").GetString() ?? "http_error",
                err.GetProperty("message").GetString() ?? "unknown",
                (int)resp.StatusCode
            );
        }
        return json;
    }

    public class ChannelClient
    {
        private readonly NotifyForge _client;
        private readonly string _channel;
        public ChannelClient(NotifyForge client, string channel)
        {
            _client = client;
            _channel = channel;
        }
        public Task<JsonElement> SendAsync(object body) =>
            _client.RequestAsync("POST", $"/api/v1/{_channel}/send", body);
    }
}
