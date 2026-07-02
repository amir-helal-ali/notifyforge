<?php
/**
 * NotifyForge PHP SDK — channel-isolated notification infrastructure.
 */

declare(strict_types=1);

namespace NotifyForge;

class NotifyForgeException extends \RuntimeException
{
    public function __construct(
        public readonly string $code,
        string $message,
        public readonly int $statusCode
    ) {
        parent::__construct("$code: $message", $statusCode);
    }
}

class NotifyForge
{
    private const VERSION = '1.0.0';

    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl = 'https://api.notifyforge.dev'
    ) {
        if ($this->apiKey === '') {
            throw new \InvalidArgumentException('apiKey is required');
        }
    }

    public function push(): ChannelClient { return new ChannelClient($this, 'push'); }
    public function email(): ChannelClient { return new ChannelClient($this, 'email'); }
    public function sms(): ChannelClient { return new ChannelClient($this, 'sms'); }
    public function webpush(): ChannelClient { return new ChannelClient($this, 'webpush'); }
    public function inapp(): ChannelClient { return new ChannelClient($this, 'inapp'); }
    public function webhook(): ChannelClient { return new ChannelClient($this, 'webhook'); }
    public function desktop(): ChannelClient { return new ChannelClient($this, 'desktop'); }

    /**
     * @return array<string, mixed>
     */
    public function request(string $method, string $path, ?array $body = null): array
    {
        $url = rtrim($this->baseUrl, '/') . $path;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json',
                'User-Agent: notifyforge-php/' . self::VERSION,
            ],
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
        }
        $resp = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($resp === false) {
            throw new NotifyForgeException('network_error', $err, 0);
        }
        /** @var array<string, mixed>|null $parsed */
        $parsed = json_decode((string)$resp, true);
        if ($status >= 400) {
            $errBody = $parsed['error'] ?? [];
            throw new NotifyForgeException(
                $errBody['code'] ?? 'http_error',
                $errBody['message'] ?? 'unknown',
                $status
            );
        }
        return $parsed ?? [];
    }
}

class ChannelClient
{
    public function __construct(
        private readonly NotifyForge $client,
        private readonly string $channel
    ) {}

    public function send(array $body): array
    {
        return $this->client->request('POST', "/api/v1/{$this->channel}/send", $body);
    }
}
