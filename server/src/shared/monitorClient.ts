import { env } from '../config/env';

function ingestUrl(kind: string) {
  return `${env.monitorBaseUrl}/monitor/ingest/${kind}`;
}

export function shouldSkipMonitorHttp(url: string) {
  const u = url.toLowerCase();
  if (u.includes('/monitor/ingest/')) return true;
  if (u.includes('/notifications/unread-count')) return true;
  if (u.includes('/inbox/unread-count')) return true;
  if (u.includes('/api/monitor/projects') && !u.includes('/ingest')) return true;
  return false;
}

export function isMonitorClientEnabled() {
  return Boolean(env.monitorBaseUrl && env.monitorKey);
}

export function monitorIngest(kind: string, body: Record<string, unknown>) {
  if (!isMonitorClientEnabled()) return;
  const payload = { release: env.monitorRelease || undefined, ...body };
  void fetch(ingestUrl(kind), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Monitor-Key': env.monitorKey,
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* never crash the API */
  });
}

export function monitorLog(message: string, level = 'info', meta?: Record<string, unknown>) {
  monitorIngest('logs', { message, level, meta });
}

export function monitorError(err: unknown, kind: 'unhandled' | 'crash' = 'unhandled') {
  const e = err instanceof Error ? err : new Error(String(err));
  monitorIngest('errors', {
    message: e.message,
    type: e.name || 'Error',
    stack: e.stack,
    kind,
  });
}

export function monitorHttp(input: {
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  direction?: 'in' | 'out';
}) {
  if (shouldSkipMonitorHttp(input.url)) return;
  monitorIngest('http', input);
}

export function monitorTransaction(name: string, durationMs: number, status?: string) {
  monitorIngest('transactions', { name, durationMs, status });
}
