import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { canAny } from '../../utils/moduleAccess';
import { monitorApi, type MonitorApp } from '../../lib/api';
import { MONITOR_API_BASE, monitorInputClass, useMonitorWorkspace } from './MonitorWorkspace';
import { ModuleHeader, StatusPill } from '../../components/moduleKit';
import SectionCard from '../../components/SectionCard';
import { FiPlus } from 'react-icons/fi';

const KINDS = ['web', 'server', 'mobile', 'admin', 'portal', 'other'] as const;

const INGEST = [
  ['logs', '{"message":"hello","level":"info","release":"1.0.0"}'],
  ['errors', '{"message":"boom","type":"Error","kind":"unhandled"}'],
  ['presence', '{"sessionId":"sess_1","page":"/home"}'],
  ['transactions', '{"name":"GET /api/orders","durationMs":120}'],
  ['http', '{"method":"GET","url":"https://api.example.com/x","status":200}'],
  ['vitals', '{"name":"lcp","value":1800}'],
  ['events', '{"name":"signup","props":{"plan":"pro"}}'],
  ['releases', '{"version":"1.0.0"}'],
] as const;

function envName(env: MonitorApp['environmentId']) {
  return typeof env === 'string' ? env : env?.name ?? '';
}

export default function MonitorSetup() {
  const { token, user } = useAuth();
  const { projectId, project, envs, apps, loadSetup } = useMonitorWorkspace();
  const canManageEnv = canAny(user, 'taskflow.monitor.environment.manage');
  const canManageApp = canAny(user, 'taskflow.monitor.app.manage');
  const [envNameInput, setEnvNameInput] = useState('');
  const [appForm, setAppForm] = useState({ name: '', kind: 'web', environmentId: '' });
  const [revealedKey, setRevealedKey] = useState<{ appId: string; key: string } | null>(null);
  const [error, setError] = useState('');

  return (
    <div className="w-full animate-fade-in space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <ModuleHeader
        eyebrow="Setup"
        title="Environments & apps"
        subtitle={`${project?.name ?? ''} · API keys are shown once. Rotate to replace.`.trim()}
        accent="#22d3ee"
      />
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Environments" description="development, staging, production, or custom.">
          {canManageEnv && token && (
            <form
              className="mb-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                monitorApi.createEnvironment(projectId, { name: envNameInput }, token).then((r) => {
                  if (r.success) {
                    setEnvNameInput('');
                    loadSetup();
                  } else setError(r.message || 'Could not create environment');
                });
              }}
            >
              <input className={monitorInputClass} placeholder="production" value={envNameInput} onChange={(e) => setEnvNameInput(e.target.value)} />
              <button type="submit" className="btn-primary btn-primary-sm inline-flex h-9 items-center gap-1 px-3">
                <FiPlus className="h-3.5 w-3.5" /> Add
              </button>
            </form>
          )}
          {envs.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[color:var(--text-muted)]">No environments yet.</p>
          ) : (
            <ul className="space-y-2">
              {envs.map((env) => (
                <li
                  key={env._id}
                  className="flex items-center justify-between rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2.5"
                >
                  <span className="text-[13px] font-medium">
                    {env.name} <span className="ml-2 font-mono text-[11px] text-[color:var(--text-muted)]">{env.slug}</span>
                  </span>
                  {canManageEnv && token && (
                    <button type="button" className="text-[12px] text-rose-400 hover:underline" onClick={() => monitorApi.deleteEnvironment(projectId, env._id, token).then(loadSetup)}>
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Apps" description="One key per app (web, server, mobile, admin, portal).">
          {canManageApp && token && (
            <form
              className="mb-4 grid gap-2 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!appForm.environmentId) return;
                monitorApi.createApp(projectId, appForm, token).then((r) => {
                  if (r.success && r.data) {
                    if (r.data.apiKey) setRevealedKey({ appId: r.data._id, key: r.data.apiKey });
                    setAppForm((f) => ({ ...f, name: '' }));
                    loadSetup();
                  } else setError(r.message || 'Could not create app');
                });
              }}
            >
              <input className={monitorInputClass} placeholder="Web app" value={appForm.name} onChange={(e) => setAppForm((f) => ({ ...f, name: e.target.value }))} />
              <select className={monitorInputClass} value={appForm.environmentId} onChange={(e) => setAppForm((f) => ({ ...f, environmentId: e.target.value }))}>
                <option value="">Environment</option>
                {envs.map((env) => (
                  <option key={env._id} value={env._id}>
                    {env.name}
                  </option>
                ))}
              </select>
              <select className={monitorInputClass} value={appForm.kind} onChange={(e) => setAppForm((f) => ({ ...f, kind: e.target.value }))}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary btn-primary-sm h-9">
                Create app
              </button>
            </form>
          )}
          <ul className="space-y-2">
            {apps.map((app) => (
              <li key={app._id} className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold">{app.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--text-muted)]">
                      <StatusPill label={app.kind} tone="blue" />
                      {envName(app.environmentId)} · {app.keyPrefix}…
                    </p>
                  </div>
                  {canManageApp && token && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-[12px] font-medium text-cyan-300 hover:underline"
                        onClick={() =>
                          monitorApi.rotateKey(projectId, app._id, token).then((r) => {
                            if (r.success && r.data?.apiKey) setRevealedKey({ appId: app._id, key: r.data.apiKey });
                          })
                        }
                      >
                        Rotate
                      </button>
                      <button type="button" className="text-[12px] text-rose-400 hover:underline" onClick={() => monitorApi.deleteApp(projectId, app._id, token).then(loadSetup)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {revealedKey && (
        <SectionCard title="New API key" description="Copy now. It cannot be shown again.">
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-mono text-[12px] break-all text-amber-100">
            {revealedKey.key}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {INGEST.map(([kind, body]) => (
              <details key={kind} className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2">
                <summary className="cursor-pointer text-[12px] font-medium text-cyan-300">POST /ingest/{kind}</summary>
                <pre className="mt-2 overflow-x-auto text-[10px] text-[color:var(--text-muted)]">{`curl -X POST ${MONITOR_API_BASE}/monitor/ingest/${kind} \\\n  -H "X-Monitor-Key: ${revealedKey.key}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`}</pre>
              </details>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
