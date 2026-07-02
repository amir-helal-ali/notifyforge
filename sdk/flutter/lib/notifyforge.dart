// NotifyForge Flutter SDK — channel-isolated notification infrastructure.
//
// Usage:
// ```dart
// final nf = NotifyForge(apiKey: 'nf_live_...');
// await nf.push.send({
//   'channel': 'push_android',
//   'target': {'externalUserId': 'user-001'},
//   'payload': {'title': 'Hi', 'body': 'World'},
// });
// ```

import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;

class NotifyForgeException implements Exception {
  final String code;
  final String message;
  final int status;
  NotifyForgeException(this.code, this.message, this.status);
  @override
  String toString() => 'NotifyForgeException: $code: $message (status $status)';
}

class NotifyForge {
  static const version = '1.0.0';
  final String apiKey;
  final String baseUrl;
  final http.Client _http;
  final Duration timeout;

  NotifyForge({
    required this.apiKey,
    this.baseUrl = 'https://api.notifyforge.dev',
    Duration? timeout,
    http.Client? httpClient,
  })  : timeout = timeout ?? const Duration(seconds: 30),
        _http = httpClient ?? http.Client() {
    if (apiKey.isEmpty) throw ArgumentError('apiKey is required');
  }

  ChannelClient get push => ChannelClient(this, 'push');
  ChannelClient get email => ChannelClient(this, 'email');
  ChannelClient get sms => ChannelClient(this, 'sms');
  ChannelClient get webpush => ChannelClient(this, 'webpush');
  ChannelClient get inapp => ChannelClient(this, 'inapp');
  ChannelClient get webhook => ChannelClient(this, 'webhook');
  ChannelClient get desktop => ChannelClient(this, 'desktop');

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final url = Uri.parse('${baseUrl.replaceAll(RegExp(r'/+$'), '')}$path');
    final req = http.Request(method, url)
      ..headers['Authorization'] = 'Bearer $apiKey'
      ..headers['Content-Type'] = 'application/json'
      ..headers['User-Agent'] = 'notifyforge-flutter/$version';
    if (body != null) {
      req.body = jsonEncode(body);
    }
    final streamed = await _http.send(req).timeout(timeout);
    final resp = await http.Response.fromStream(streamed);
    if (resp.body.isEmpty) return {};
    final parsed = jsonDecode(resp.body) as Map<String, dynamic>;
    if (resp.statusCode >= 400) {
      final err = (parsed['error'] as Map<String, dynamic>?) ?? {};
      throw NotifyForgeException(
        (err['code'] as String?) ?? 'http_error',
        (err['message'] as String?) ?? 'unknown',
        resp.statusCode,
      );
    }
    return parsed;
  }
}

class ChannelClient {
  final NotifyForge _client;
  final String _channel;
  ChannelClient(this._client, this._channel);

  Future<Map<String, dynamic>> send(Map<String, dynamic> body) =>
      _client.request('POST', '/api/v1/$_channel/send', body: body);
}
