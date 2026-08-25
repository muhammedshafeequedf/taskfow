import { MonitorUptimeCheck, MonitorUptimeSample } from './monitor.models';

async function runCheck(check: {
  _id: unknown;
  taskflowOrganizationId: unknown;
  projectId: unknown;
  url: string;
  method?: string;
  expectedStatus?: number;
  intervalMinutes?: number;
}) {
  const started = Date.now();
  let ok = false;
  let status: number | undefined;
  let error: string | undefined;
  try {
    const res = await fetch(check.url, {
      method: check.method === 'HEAD' ? 'HEAD' : 'GET',
      signal: AbortSignal.timeout(15000),
    });
    status = res.status;
    ok = status === (check.expectedStatus ?? 200);
  } catch (err) {
    error = err instanceof Error ? err.message : 'request failed';
  }
  const latencyMs = Date.now() - started;
  await MonitorUptimeSample.create({
    taskflowOrganizationId: check.taskflowOrganizationId,
    projectId: check.projectId,
    checkId: check._id,
    ok,
    status,
    latencyMs,
    error,
    timestamp: new Date(),
  });
  const interval = Math.max(1, check.intervalMinutes ?? 5);
  await MonitorUptimeCheck.updateOne(
    { _id: check._id },
    { $set: { nextRunAt: new Date(Date.now() + interval * 60 * 1000) } }
  );
}

export function startMonitorUptimeScheduler(): void {
  setInterval(() => {
    void (async () => {
      const due = await MonitorUptimeCheck.find({
        enabled: true,
        nextRunAt: { $lte: new Date() },
      })
        .limit(20)
        .lean();
      for (const check of due) {
        await runCheck(check);
      }
    })().catch((err) => console.error('monitor uptime:', err));
  }, 30_000);
}
