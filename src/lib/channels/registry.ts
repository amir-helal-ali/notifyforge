/**
 * Channel Engine Registry.
 *
 * Each channel registers a `ChannelEngine` that knows how to:
 *   1. Validate the channel-specific payload (validatePayload)
 *   2. Resolve targets into concrete delivery targets (resolveTargets)
 *   3. Dispatch the notification via the channel's provider (dispatch)
 *
 * Engines are completely isolated — no engine knows about another.
 */

import type {
  Channel,
  TargetSpec,
  Notification,
} from '@/lib/types';

export interface DispatchResult {
  providerMessageId?: string;
  deliveredAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  invalidateDevice?: boolean;
}

export interface ChannelEngine<P = unknown> {
  channel: Channel;
  provider: string;
  validatePayload(payload: P): { valid: boolean; error?: string };
  validateTarget(target: TargetSpec): { valid: boolean; error?: string };
  resolveTargets(notification: Notification): Promise<string[]>;
  dispatch(notification: Notification, providerTargets: string[]): Promise<DispatchResult>;
}

const registry: Partial<Record<Channel, ChannelEngine>> = {};

export function registerChannelEngine(engine: ChannelEngine): void {
  registry[engine.channel] = engine;
}

export function getChannelEngine(channel: Channel): ChannelEngine | undefined {
  return registry[channel];
}

export function listChannelEngines(): ChannelEngine[] {
  return Object.values(registry) as ChannelEngine[];
}
