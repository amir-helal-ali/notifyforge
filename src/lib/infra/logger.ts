/**
 * Structured logger — emits JSON lines with request-id, channel, level.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  orgId?: string;
  projectId?: string;
  channel?: string;
  notificationId?: string;
  [k: string]: unknown;
}

export function log(level: LogLevel, msg: string, ctx: LogContext = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  });
  console[level === 'debug' ? 'log' : level](line);
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => log('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => log('error', msg, ctx),
};
