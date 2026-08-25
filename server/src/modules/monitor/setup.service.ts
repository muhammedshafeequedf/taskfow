import crypto from 'crypto';
import { MonitorApp, MonitorEnvironment, MonitorProject } from './monitor.models';
import { Project } from '../projects/project.model';
import { ApiError } from '../../utils/ApiError';
import { requireWorkspaceId, toOrgOid } from '../crm/crmWorkspace';
import { notifyMonitorEvent } from '../../websocket';

export function hashMonitorKey(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

export function generateMonitorKey(): { plain: string; prefix: string; hash: string } {
  const plain = `mntr_${crypto.randomBytes(24).toString('hex')}`;
  return { plain, prefix: plain.slice(0, 12), hash: hashMonitorKey(plain) };
}

export async function assertProjectInWorkspace(projectId: string, workspaceId: string) {
  const orgId = requireWorkspaceId(workspaceId);
  const project = await MonitorProject.findOne({ _id: projectId, taskflowOrganizationId: orgId })
    .select('_id name key')
    .lean();
  if (!project) throw new ApiError(404, 'Monitor project not found');
  return project;
}

export async function listProjects(workspaceId: string | null | undefined) {
  const orgId = requireWorkspaceId(workspaceId);
  return MonitorProject.find({ taskflowOrganizationId: toOrgOid(orgId) }).sort({ name: 1 }).lean();
}

export async function getProject(workspaceId: string | null | undefined, projectId: string) {
  return assertProjectInWorkspace(projectId, requireWorkspaceId(workspaceId));
}

export async function listPmSuggestions(workspaceId: string | null | undefined) {
  const orgId = requireWorkspaceId(workspaceId);
  const orgOid = toOrgOid(orgId);
  const linked = await MonitorProject.find({ taskflowOrganizationId: orgOid, sourceProjectId: { $exists: true } })
    .select('sourceProjectId')
    .lean();
  const taken = new Set(linked.map((p) => String(p.sourceProjectId)));
  const rows = await Project.find({ taskflowOrganizationId: orgOid }).select('_id name key').sort({ name: 1 }).lean();
  return rows
    .filter((p) => !taken.has(String(p._id)))
    .map((p) => ({ _id: String(p._id), name: p.name, key: p.key }));
}

export async function createProject(
  workspaceId: string | null | undefined,
  input: { name: string; key?: string; sourceProjectId?: string }
) {
  const orgId = requireWorkspaceId(workspaceId);
  let name = String(input.name ?? '').trim();
  let key = (input.key || name).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);
  let sourceProjectId: string | undefined;

  if (input.sourceProjectId) {
    const pm = await Project.findOne({
      _id: input.sourceProjectId,
      taskflowOrganizationId: toOrgOid(orgId),
    })
      .select('_id name key')
      .lean();
    if (!pm) throw new ApiError(404, 'PM project not found');
    name = pm.name;
    key = String(pm.key || key).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);
    sourceProjectId = String(pm._id);
  }

  if (!name) throw new ApiError(400, 'Name is required');
  if (!key) throw new ApiError(400, 'Key is required');
  try {
    const doc = await MonitorProject.create({
      taskflowOrganizationId: toOrgOid(orgId),
      name,
      key,
      ...(sourceProjectId ? { sourceProjectId } : {}),
    });
    return doc.toObject();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ApiError(409, 'Project already linked or key exists');
    throw err;
  }
}

export async function deleteProject(workspaceId: string | null | undefined, projectId: string) {
  const orgId = requireWorkspaceId(workspaceId);
  const deleted = await MonitorProject.findOneAndDelete({
    _id: projectId,
    taskflowOrganizationId: toOrgOid(orgId),
  });
  if (!deleted) throw new ApiError(404, 'Monitor project not found');
  await MonitorEnvironment.deleteMany({ projectId });
  await MonitorApp.deleteMany({ projectId });
  return { ok: true };
}

export async function resolveAppByKey(plain: string) {
  if (!plain) return null;
  const hash = hashMonitorKey(plain.trim());
  const app = await MonitorApp.findOne({ keyHash: hash, revokedAt: { $exists: false } }).lean();
  return app;
}

const rate = new Map<string, { n: number; t: number }>();
export function rateLimitKey(hash: string, max = 120, windowMs = 10_000): boolean {
  const now = Date.now();
  const cur = rate.get(hash);
  if (!cur || now - cur.t > windowMs) {
    rate.set(hash, { n: 1, t: now });
    return true;
  }
  cur.n += 1;
  return cur.n <= max;
}

export async function listEnvironments(workspaceId: string | null | undefined, projectId: string) {
  const orgId = requireWorkspaceId(workspaceId);
  await assertProjectInWorkspace(projectId, orgId);
  return MonitorEnvironment.find({ taskflowOrganizationId: toOrgOid(orgId), projectId }).sort({ name: 1 }).lean();
}

export async function createEnvironment(
  workspaceId: string | null | undefined,
  projectId: string,
  input: { name: string; slug?: string }
) {
  const orgId = requireWorkspaceId(workspaceId);
  await assertProjectInWorkspace(projectId, orgId);
  const name = String(input.name ?? '').trim();
  if (!name) throw new ApiError(400, 'Name is required');
  const slug = (input.slug || name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'env';
  try {
    const doc = await MonitorEnvironment.create({
      taskflowOrganizationId: toOrgOid(orgId),
      projectId,
      name,
      slug,
    });
    return doc.toObject();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ApiError(409, 'Environment slug already exists');
    throw err;
  }
}

export async function deleteEnvironment(workspaceId: string | null | undefined, projectId: string, id: string) {
  const orgId = requireWorkspaceId(workspaceId);
  await assertProjectInWorkspace(projectId, orgId);
  const deleted = await MonitorEnvironment.findOneAndDelete({
    _id: id,
    projectId,
    taskflowOrganizationId: toOrgOid(orgId),
  });
  if (!deleted) throw new ApiError(404, 'Environment not found');
  await MonitorApp.deleteMany({ environmentId: id });
  return { ok: true };
}

export async function listApps(
  workspaceId: string | null | undefined,
  projectId: string,
  environmentId?: string
) {
  const orgId = requireWorkspaceId(workspaceId);
  await assertProjectInWorkspace(projectId, orgId);
  const filter: Record<string, unknown> = { taskflowOrganizationId: toOrgOid(orgId), projectId };
  if (environmentId) filter.environmentId = environmentId;
  return MonitorApp.find(filter)
    .select('-keyHash')
    .populate('environmentId', 'name slug')
    .sort({ name: 1 })
    .lean();
}

export async function createApp(
  workspaceId: string | null | undefined,
  projectId: string,
  input: { name: string; kind?: string; environmentId: string }
): Promise<Record<string, unknown> & { apiKey: string }> {
  const orgId = requireWorkspaceId(workspaceId);
  await assertProjectInWorkspace(projectId, orgId);
  const env = await MonitorEnvironment.findOne({
    _id: input.environmentId,
    projectId,
    taskflowOrganizationId: toOrgOid(orgId),
  });
  if (!env) throw new ApiError(404, 'Environment not found');
  const name = String(input.name ?? '').trim();
  if (!name) throw new ApiError(400, 'Name is required');
  const { plain, prefix, hash } = generateMonitorKey();
  const doc = await MonitorApp.create({
    taskflowOrganizationId: toOrgOid(orgId),
    projectId,
    environmentId: env._id,
    name,
    kind: input.kind || 'web',
    keyPrefix: prefix,
    keyHash: hash,
  });
  const obj = doc.toObject();
  delete (obj as { keyHash?: string }).keyHash;
  return { ...obj, apiKey: plain };
}

export async function rotateAppKey(
  workspaceId: string | null | undefined,
  projectId: string,
  appId: string
): Promise<Record<string, unknown> & { apiKey: string }> {
  const orgId = requireWorkspaceId(workspaceId);
  await assertProjectInWorkspace(projectId, orgId);
  const { plain, prefix, hash } = generateMonitorKey();
  const updated = await MonitorApp.findOneAndUpdate(
    { _id: appId, projectId, taskflowOrganizationId: toOrgOid(orgId) },
    { $set: { keyPrefix: prefix, keyHash: hash }, $unset: { revokedAt: 1 } },
    { new: true }
  )
    .select('-keyHash')
    .lean();
  if (!updated) throw new ApiError(404, 'App not found');
  return { ...updated, apiKey: plain };
}

export async function deleteApp(workspaceId: string | null | undefined, projectId: string, appId: string) {
  const orgId = requireWorkspaceId(workspaceId);
  const deleted = await MonitorApp.findOneAndDelete({
    _id: appId,
    projectId,
    taskflowOrganizationId: toOrgOid(orgId),
  });
  if (!deleted) throw new ApiError(404, 'App not found');
  return { ok: true };
}

export function emitLive(projectId: string, environmentId: string, channel: string, payload: unknown) {
  notifyMonitorEvent(projectId, environmentId, channel, payload);
}
