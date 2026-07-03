// NotifyForge Kotlin SDK — channel-isolated notification infrastructure.
package dev.notifyforge

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

class NotifyForge(
    val apiKey: String,
    val baseUrl: String = "https://api.notifyforge.dev",
) {
    init {
        require(apiKey.isNotEmpty()) { "apiKey is required" }
    }

    private val http: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build()
    private val json = Json { ignoreUnknownKeys = true }

    val push = ChannelClient(this, "push")
    val email = ChannelClient(this, "email")
    val sms = ChannelClient(this, "sms")
    val webpush = ChannelClient(this, "webpush")
    val inapp = ChannelClient(this, "inapp")
    val webhook = ChannelClient(this, "webhook")
    val desktop = ChannelClient(this, "desktop")

    suspend fun request(method: String, path: String, body: JsonObject? = null): JsonObject = withContext(Dispatchers.IO) {
        val req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl.trimEnd('/') + path))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .header("User-Agent", "notifyforge-kotlin/1.0.0")
            .apply {
                if (body != null) {
                    method(method, HttpRequest.BodyPublishers.ofString(body.toString()))
                } else {
                    method(method, HttpRequest.BodyPublishers.noBody())
                }
            }
            .build()
        val resp = http.send(req, HttpResponse.BodyHandlers.ofString())
        val text = resp.body() ?: ""
        val parsed = if (text.isNotEmpty()) json.parseToJsonElement(text).jsonObject else JsonObject(emptyMap())
        if (resp.statusCode() >= 400) {
            val err = parsed["error"]?.jsonObject ?: JsonObject(emptyMap())
            throw NotifyForgeException(
                err["code"]?.toString()?.trim('"') ?: "http_error",
                err["message"]?.toString()?.trim('"') ?: "unknown",
                resp.statusCode(),
            )
        }
        parsed
    }

    class ChannelClient(private val client: NotifyForge, private val channel: String) {
        suspend fun send(body: JsonObject): JsonObject = client.request("POST", "/api/v1/$channel/send", body)
    }

    class NotifyForgeException(val code: String, message: String, val status: Int) : RuntimeException("$code: $message")
}
