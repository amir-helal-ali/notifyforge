/**
 * In-process worker queue.
 *
 * Production: this interface maps 1:1 to BullMQ + Redis. The in-process
 * implementation here keeps a microtask-deferred FIFO with retry/backoff
 * so the platform is runnable without external dependencies.
 *
 * Each channel registers a handler. The queue dispatches by channel and
 * updates Notification.status atomically.
 */

import type { Channel } from '@/lib/types';

export interface Job {
  notificationId: string;
  channel: Channel;
  attempt: number;
  scheduledFor: number;
}

type Handler = (job: Job) => Promise<void>;

const handlers: Partial<Record<Channel, Handler>> = {};
const queue: Job[] = [];
let workerRunning = false;

export function registerChannelWorker(channel: Channel, handler: Handler): void {
  handlers[channel] = handler;
}

export function enqueue(job: Job): void {
  queue.push(job);
  ensureWorker();
}

function ensureWorker() {
  if (workerRunning) return;
  workerRunning = true;
  setTimeout(runWorker, 0);
}

async function runWorker() {
  workerRunning = false;
  const now = Date.now();
  const ready = queue.filter((j) => j.scheduledFor <= now);
  if (ready.length === 0) {
    if (queue.length > 0) setTimeout(runWorker, 100);
    return;
  }
  // Remove ready jobs from queue
  for (const job of ready) {
    const idx = queue.indexOf(job);
    if (idx >= 0) queue.splice(idx, 1);
  }
  // Run in parallel with bounded concurrency
  const concurrency = Math.min(ready.length, 8);
  const batches: Job[][] = [];
  for (let i = 0; i < ready.length; i += concurrency) {
    batches.push(ready.slice(i, i + concurrency));
  }
  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(async (job) => {
        const handler = handlers[job.channel];
        if (!handler) {
          console.warn(`[worker] no handler for channel ${job.channel}`);
          return;
        }
        try {
          await handler(job);
        } catch (e) {
          console.error(`[worker] job ${job.notificationId} failed`, e);
        }
      }),
    );
  }
  if (queue.length > 0) setTimeout(runWorker, 50);
}

export function queueStats() {
  return {
    pending: queue.length,
    registeredChannels: Object.keys(handlers) as Channel[],
  };
}
