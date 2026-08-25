import mongoose from 'mongoose';
import {
  MonitorAlertDelivery,
  MonitorAlertRule,
  MonitorErrorEvent,
  MonitorProject,
  MonitorUptimeSample,
  MONITOR_ALERT_TRIGGERS,
  type MonitorAlertTrigger,
} from './monitor.models';
import { MonitorApp, MonitorEnvironment } from './monitor.models';
import { assertProjectInWorkspace } from './setup.service';
import { ApiError } from '../../utils/ApiError';
import { env } from '../../config/env';
import {
  escapeHtml,
  sendCustomerEmail,
  tfCta,
  tfDetailTable,
  tfEmailWrap,
} from '../../services/email.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type AlertEventKind =
  | 'logs'
  | 'errors'
  | 'http'
  | 'transactions'
  | 'vitals'
  | 'events'
  | 'releases'
  | 'uptime';

export type AlertContext = {
  kind: AlertEventKind;
  orgId: string;
  projectId: string;
  environmentId?: string;
  appId?: string;
  isNewErrorGroup?: boolean;
  fields: Record<string, string>;
};

function parseEmails(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw.map((v) => String(v))
    : String(raw ?? '')
        .split(/[,;\n]+/)
        .map((s) => s.trim());
  const out = [...new Set(list.map((s) => s.trim().toLowerCase()).filter((s) => EMAIL_RE.test(s)))];
  if (out.length > 20) throw new ApiError(400, 'At most 20 recipient emails');
  return out;
}

function applyTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

function inCooldown(lastFiredAt: Date | undefined, minutes: number) {
  if (!lastFiredAt) return false;
  const ms = Math.max(1, minutes) * 60 * 1000;
  return Date.now() - new Date(lastFiredAt).getTime() < ms;
}

function matchesScope(rule: { environmentId?: unknown; appId?: unknown }, ctx: AlertContext) {
  if (rule.environmentId && String(rule.environmentId) !== String(ctx.environmentId || '')) return false;
  if (rule.appId && String(rule.appId) !== String(ctx.appId || '')) return false;
  return true;
}

async function ruleMatches(rule: {
  trigger: string;
  conditions?: Record<string, unknown>;
}, ctx: AlertContext): Promise<boolean> {
  const c = (rule.conditions ?? {}) as Record<string, unknown>;
  const contains = String(c.messageContains || '').trim().toLowerCase();
  const msg = (ctx.fields.message || ctx.fields.url || ctx.fields.name || '').toLowerCase();
  if (contains && !msg.includes(contains)) return false;

  if (rule.trigger === 'error_new') return ctx.kind === 'errors' && Boolean(ctx.isNewErrorGroup);
  if (rule.trigger === 'error_spike') {
    if (ctx.kind !== 'errors') return false;
    const windowMinutes = Math.max(1, Number(c.windowMinutes ?? 5));
    const minCount = Math.max(1, Number(c.minCount ?? 10));
    const count = await MonitorErrorEvent.countDocuments({
      projectId: ctx.projectId,
      ...(ctx.appId ? { appId: ctx.appId } : {}),
      timestamp: { $gte: new Date(Date.now() - windowMinutes * 60 * 1000) },
    });
    return count >= minCount;
  }
  if (rule.trigger === 'log_level') {
    if (ctx.kind !== 'logs') return false;
    const levels = Array.isArray(c.logLevels)
      ? (c.logLevels as unknown[]).map((v) => String(v).toLowerCase())
      : ['error', 'fatal', 'warn'];
    return levels.includes((ctx.fields.level || '').toLowerCase());
  }
  if (rule.trigger === 'http_status') {
    if (ctx.kind !== 'http') return false;
    const status = Number(ctx.fields.status);
    if (!Number.isFinite(status)) return false;
    const min = Number(c.httpStatusMin ?? 500);
    const max = Number(c.httpStatusMax ?? 599);
    return status >= min && status <= max;
  }
  if (rule.trigger === 'transaction_slow') {
    if (ctx.kind !== 'transactions') return false;
    return Number(ctx.fields.durationMs) >= Number(c.durationMs ?? 2000);
  }
  if (rule.trigger === 'vital_threshold') {
    if (ctx.kind !== 'vitals') return false;
    const want = String(c.vitalName || 'lcp').toLowerCase();
    if ((ctx.fields.vitalName || '').toLowerCase() !== want) return false;
    return Number(ctx.fields.vitalValue) >= Number(c.vitalGte ?? 2500);
  }
  if (rule.trigger === 'event_name') {
    if (ctx.kind !== 'events') return false;
    const want = String(c.eventName || '').trim().toLowerCase();
    if (!want) return ctx.kind === 'events';
    return (ctx.fields.eventName || '').toLowerCase() === want;
  }
  if (rule.trigger === 'new_release') return ctx.kind === 'releases';
  if (rule.trigger === 'uptime_down') {
    if (ctx.kind !== 'uptime') return false;
    const streak = Math.max(1, Number(c.uptimeFailStreak ?? 1));
    if (streak <= 1) return ctx.fields.ok === 'false';
    const checkId = ctx.fields.checkId;
    if (!checkId) return ctx.fields.ok === 'false';
    const samples = await MonitorUptimeSample.find({ checkId })
      .sort({ timestamp: -1 })
      .limit(streak)
      .select('ok')
      .lean();
    return samples.length >= streak && samples.every((s) => s.ok === false);
  }
  return false;
}

async function resolveLabels(ctx: AlertContext) {
  const [project, environment, app] = await Promise.all([
    MonitorProject.findById(ctx.projectId).select('name key').lean(),
    ctx.environmentId ? MonitorEnvironment.findById(ctx.environmentId).select('name slug').lean() : null,
    ctx.appId ? MonitorApp.findById(ctx.appId).select('name kind').lean() : null,
  ]);
  return {
    project: project?.name || 'Monitor',
    projectKey: project?.key || '',
    environment: environment?.name || '',
    app: app?.name || '',
  };
}

function defaultHtml(vars: Record<string, string>, openUrl: string) {
  const rows = [
    { label: 'Project', value: vars.project },
    { label: 'Trigger', value: vars.trigger },
    { label: 'App', value: vars.app },
    { label: 'Environment', value: vars.environment },
    { label: 'Message', value: vars.message },
    { label: 'Level', value: vars.level },
    { label: 'URL', value: vars.url },
    { label: 'Status', value: vars.status },
    { label: 'Duration (ms)', value: vars.durationMs },
    { label: 'Release', value: vars.release },
  ].filter((r) => r.value);
  const inner = `<p style="font-size:16px;font-weight:600;margin:0 0 12px;color:#0f172a;">Monitor alert: ${escapeHtml(vars.trigger)}</p>
${tfDetailTable(rows)}
${tfCta(openUrl, 'Open in Monitor')}`;
  return tfEmailWrap(inner, 'red');
}

async function fireRule(
  rule: {
    _id: unknown;
    taskflowOrganizationId: unknown;
    projectId: unknown;
    name: string;
    recipients: string[];
    subjectTemplate?: string;
    bodyTemplate?: string;
    trigger: string;
    cooldownMinutes?: number;
    lastFiredAt?: Date;
  },
  ctx: AlertContext,
  labels: Record<string, string>
) {
  if (inCooldown(rule.lastFiredAt, rule.cooldownMinutes ?? 15)) return;
  const recipients = parseEmails(rule.recipients);
  if (recipients.length === 0) return;

  const appUrl = (env.appUrl || env.frontendUrl || '').replace(/\/+$/, '');
  const openUrl = `${appUrl}/monitor/${ctx.projectId}`;
  const vars: Record<string, string> = {
    ...ctx.fields,
    ...labels,
    trigger: rule.trigger,
    rule: rule.name,
    projectId: ctx.projectId,
    openUrl,
  };
  const subject = applyTemplate(rule.subjectTemplate || '[Monitor] {{project}} · {{trigger}}', vars).slice(0, 200);
  const customBody = (rule.bodyTemplate || '').trim();
  const html = customBody
    ? tfEmailWrap(`<div style="white-space:pre-wrap;font-size:14px;color:#334155;">${escapeHtml(applyTemplate(customBody, vars))}</div>${tfCta(openUrl, 'Open in Monitor')}`, 'red')
    : defaultHtml(vars, openUrl);

  try {
    for (const to of recipients) {
      await sendCustomerEmail(to, subject, html);
    }
    await MonitorAlertRule.updateOne(
      { _id: rule._id },
      { $set: { lastFiredAt: new Date(), lastError: '' }, $inc: { fireCount: 1 } }
    );
    await MonitorAlertDelivery.create({
      taskflowOrganizationId: rule.taskflowOrganizationId,
      projectId: rule.projectId,
      ruleId: rule._id,
      trigger: rule.trigger,
      subject,
      recipients,
      summary: (vars.message || vars.url || vars.eventName || vars.trigger).slice(0, 500),
      ok: true,
      timestamp: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send failed';
    await MonitorAlertRule.updateOne({ _id: rule._id }, { $set: { lastError: message.slice(0, 500) } });
    await MonitorAlertDelivery.create({
      taskflowOrganizationId: rule.taskflowOrganizationId,
      projectId: rule.projectId,
      ruleId: rule._id,
      trigger: rule.trigger,
      subject,
      recipients,
      summary: message.slice(0, 500),
      ok: false,
      error: message.slice(0, 500),
      timestamp: new Date(),
    });
  }
}

export function evaluateMonitorAlerts(ctx: AlertContext): void {
  void (async () => {
    const rules = await MonitorAlertRule.find({
      projectId: ctx.projectId,
      enabled: true,
    }).lean();
    if (rules.length === 0) return;
    const labels = await resolveLabels(ctx);
    for (const rule of rules) {
      if (!matchesScope(rule, ctx)) continue;
      if (!(await ruleMatches(rule, ctx))) continue;
      await fireRule(rule, ctx, labels);
    }
  })().catch((err) => console.error('monitor alerts:', err));
}

export async function listAlertRules(workspaceId: string, projectId: string) {
  await assertProjectInWorkspace(projectId, workspaceId);
  return MonitorAlertRule.find({ projectId }).sort({ createdAt: -1 }).lean();
}

export async function listAlertDeliveries(workspaceId: string, projectId: string, ruleId?: string) {
  await assertProjectInWorkspace(projectId, workspaceId);
  return MonitorAlertDelivery.find({
    projectId,
    ...(ruleId ? { ruleId } : {}),
  })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();
}

function normalizeRuleBody(input: Record<string, unknown>) {
  const trigger = String(input.trigger || '') as MonitorAlertTrigger;
  if (!MONITOR_ALERT_TRIGGERS.includes(trigger)) throw new ApiError(400, 'Invalid trigger');
  const name = String(input.name ?? '').trim();
  if (!name) throw new ApiError(400, 'Name is required');
  const recipients = parseEmails(input.recipients);
  if (recipients.length === 0) throw new ApiError(400, 'At least one valid recipient email is required');
  const conditions = (input.conditions && typeof input.conditions === 'object' ? input.conditions : {}) as Record<
    string,
    unknown
  >;
  return {
    name,
    enabled: input.enabled !== false,
    trigger,
    environmentId: input.environmentId ? new mongoose.Types.ObjectId(String(input.environmentId)) : undefined,
    appId: input.appId ? new mongoose.Types.ObjectId(String(input.appId)) : undefined,
    recipients,
    cooldownMinutes: Math.max(1, Number(input.cooldownMinutes ?? 15)),
    subjectTemplate: String(input.subjectTemplate ?? '[Monitor] {{project}} · {{trigger}}').slice(0, 200),
    bodyTemplate: String(input.bodyTemplate ?? '').slice(0, 8000),
    conditions,
  };
}

export async function createAlertRule(workspaceId: string, projectId: string, input: Record<string, unknown>) {
  const project = await assertProjectInWorkspace(projectId, workspaceId);
  const body = normalizeRuleBody(input);
  const doc = await MonitorAlertRule.create({
    taskflowOrganizationId: (project as { taskflowOrganizationId: unknown }).taskflowOrganizationId,
    projectId,
    ...body,
  });
  return doc.toObject();
}

export async function updateAlertRule(
  workspaceId: string,
  projectId: string,
  alertId: string,
  input: Record<string, unknown>
) {
  await assertProjectInWorkspace(projectId, workspaceId);
  const body = normalizeRuleBody(input);
  const doc = await MonitorAlertRule.findOneAndUpdate(
    { _id: alertId, projectId },
    { $set: { ...body, environmentId: body.environmentId ?? null, appId: body.appId ?? null } },
    { new: true }
  ).lean();
  if (!doc) throw new ApiError(404, 'Alert rule not found');
  return doc;
}

export async function deleteAlertRule(workspaceId: string, projectId: string, alertId: string) {
  await assertProjectInWorkspace(projectId, workspaceId);
  const res = await MonitorAlertRule.deleteOne({ _id: alertId, projectId });
  if (!res.deletedCount) throw new ApiError(404, 'Alert rule not found');
  return { ok: true };
}

export async function testAlertRule(workspaceId: string, projectId: string, alertId: string) {
  await assertProjectInWorkspace(projectId, workspaceId);
  const rule = await MonitorAlertRule.findOne({ _id: alertId, projectId }).lean();
  if (!rule) throw new ApiError(404, 'Alert rule not found');
  const ctx: AlertContext = {
    kind: 'logs',
    orgId: String(rule.taskflowOrganizationId),
    projectId,
    environmentId: rule.environmentId ? String(rule.environmentId) : undefined,
    appId: rule.appId ? String(rule.appId) : undefined,
    fields: {
      message: 'Test notification from Monitor alert rules',
      level: 'info',
      trigger: rule.trigger,
    },
  };
  const labels = await resolveLabels(ctx);
  await fireRule({ ...rule, lastFiredAt: undefined, cooldownMinutes: 0 }, ctx, labels);
  return { ok: true };
}
