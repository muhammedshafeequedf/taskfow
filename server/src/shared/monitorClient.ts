import { env } from '../config/env';

function ingestUrl(kind: string) {
  return `${env.monitorBaseUrl}/monitor/ingest/${kind}`;
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
  if (input.url.includes('/monitor/ingest/')) return;
  monitorIngest('http', input);
}

export function monitorTransaction(name: string, durationMs: number, status?: string) {
  monitorIngest('transactions', { name, durationMs, status });
}
