// NotifyForge Swift SDK — channel-isolated notification infrastructure.
import Foundation

public enum NotifyForgeError: Error, CustomStringConvertible {
    case apiError(code: String, message: String, status: Int)
    case networkError(Error)
    case configError(String)

    public var description: String {
        switch self {
        case .apiError(let code, let message, let status):
            return "NotifyForgeError: \(code): \(message) (status \(status))"
        case .networkError(let err):
            return "NotifyForge network error: \(err)"
        case .configError(let msg):
            return "NotifyForge config error: \(msg)"
        }
    }
}

public final class NotifyForge {
    public static let version = "1.0.0"

    public let apiKey: String
    public let baseURL: URL
    private let session: URLSession

    public init(apiKey: String, baseURL: URL = URL(string: "https://api.notifyforge.dev")!) throws {
        guard !apiKey.isEmpty else { throw NotifyForgeError.configError("apiKey is required") }
        self.apiKey = apiKey
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }

    public lazy var push: ChannelClient = ChannelClient(client: self, channel: "push")
    public lazy var email: ChannelClient = ChannelClient(client: self, channel: "email")
    public lazy var sms: ChannelClient = ChannelClient(client: self, channel: "sms")
    public lazy var webpush: ChannelClient = ChannelClient(client: self, channel: "webpush")
    public lazy var inapp: ChannelClient = ChannelClient(client: self, channel: "inapp")
    public lazy var webhook: ChannelClient = ChannelClient(client: self, channel: "webhook")
    public lazy var desktop: ChannelClient = ChannelClient(client: self, channel: "desktop")

    public func request(method: String, path: String, body: Any? = nil) async throws -> [String: Any] {
        let url = baseURL.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("notifyforge-swift/\(NotifyForge.version)", forHTTPHeaderField: "User-Agent")
        if let body = body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                return [:]
            }
            if data.isEmpty { return [:] }
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
            if http.statusCode >= 400 {
                let err = (json["error"] as? [String: Any]) ?? [:]
                throw NotifyForgeError.apiError(
                    code: (err["code"] as? String) ?? "http_error",
                    message: (err["message"] as? String) ?? "unknown",
                    status: http.statusCode
                )
            }
            return json
        } catch let err as NotifyForgeError {
            throw err
        } catch {
            throw NotifyForgeError.networkError(error)
        }
    }

    public final class ChannelClient {
        private let client: NotifyForge
        private let channel: String
        public init(client: NotifyForge, channel: String) {
            self.client = client
            self.channel = channel
        }
        public func send(_ body: [String: Any]) async throws -> [String: Any] {
            try await client.request(method: "POST", path: "/api/v1/\(channel)/send", body: body)
        }
    }
}
