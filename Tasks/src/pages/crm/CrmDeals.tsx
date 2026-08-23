import { useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../contexts/AuthContext';
import { canAny } from '../../utils/moduleAccess';
import { crmApi, type CrmDeal, type CrmPipeline } from '../../lib/api';

function orgLabel(deal: CrmDeal): string {
  const ref = deal.customerOrgId ?? deal.accountId;
  if (!ref) return '—';
  if (typeof ref === 'string') return ref;
  return ref.name ?? '—';
}

function DealColumn({
  stageId,
  children,
}: {
  stageId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stageId}` });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[120px] rounded-xl p-0.5 transition-colors ${
        isOver ? 'bg-[color:var(--accent)]/10 ring-2 ring-[color:var(--accent)]/40' : ''
      }`}
    >
      {children}
    </div>
  );
}

function DealCard({
  deal,
  canDrag,
  onCreateProject,
  showCreateProject,
}: {
  deal: CrmDeal;
  canDrag: boolean;
  showCreateProject: boolean;
  onCreateProject: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal._id,
    disabled: !canDrag,
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-[color:var(--border-subtle)] p-3 text-sm bg-[color:var(--bg-page)] ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex gap-2 min-w-0">
        {canDrag && (
          <button
            type="button"
            className="shrink-0 touch-none cursor-grab active:cursor-grabbing text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] p-0.5 -m-0.5"
            aria-label="Drag deal to another stage"
            {...listeners}
            {...attributes}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
              <path d="M5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM5 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{deal.title}</p>
          <p className="text-[color:var(--text-muted)] text-xs">{orgLabel(deal)}</p>
          <p className="text-[color:var(--text-muted)]">
            ${(deal.value ?? 0).toLocaleString()} · {deal.status}
          </p>
          {showCreateProject && (
            <button
              type="button"
              onClick={onCreateProject}
              className="mt-2 text-[10px] px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-300"
            >
              Create project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CrmDeals() {
  const { token, user } = useAuth();
  const canCreate = canAny(user, 'taskflow.crm.deal.create');
  const canUpdate = canAny(user, 'taskflow.crm.deal.update');
  const [pipeline, setPipeline] = useState<CrmPipeline | null>(null);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [orgs, setOrgs] = useState<Array<{ _id: string; name: string }>>([]);
  const [wizardDeal, setWizardDeal] = useState<CrmDeal | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    customerOrgId: '',
    value: 0,
    expectedCloseDate: '',
    stageId: '',
  });
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const load = async () => {
    if (!token) return;
    const [pRes, dRes, aRes] = await Promise.all([
      crmApi.listPipelines(token),
      crmApi.listDeals(token),
      crmApi.listCustomerOrgs(token),
    ]);
    if (pRes.success && pRes.data) {
      const pipes = pRes.data as CrmPipeline[];
      const pipe = pipes.find((p) => p.isDefault) ?? pipes[0] ?? null;
      setPipeline(pipe);
      if (pipe?.stages?.length && !form.stageId) {
        const first = [...pipe.stages].sort((a, b) => a.order - b.order)[0];
        setForm((f) => ({ ...f, stageId: first._id }));
      }
    }
    if (dRes.success && dRes.data) setDeals(dRes.data as CrmDeal[]);
    if (aRes.success && aRes.data) setOrgs(Array.isArray(aRes.data) ? aRes.data : []);
  };

  useEffect(() => {
    void load();
  }, [token]);

  const dealsByStage = (stageId: string) => deals.filter((d) => String(d.stageId) === String(stageId));

  const moveDeal = async (dealId: string, stageId: string) => {
    if (!token) return;
    const prev = deals;
    setDeals((list) => list.map((d) => (d._id === dealId ? { ...d, stageId } : d)));
    const res = await crmApi.moveDealStage(dealId, stageId, token);
    if (!res.success) {
      setDeals(prev);
      return;
    }
    void load();
  };

  async function onDragEnd(ev: DragEndEvent) {
    setActiveDealId(null);
    if (!canUpdate) return;
    const overId = ev.over?.id ? String(ev.over.id) : '';
    if (!overId.startsWith('stage:')) return;
    const stageId = overId.slice('stage:'.length);
    const dealId = String(ev.active.id);
    const deal = deals.find((d) => d._id === dealId);
    if (!deal || String(deal.stageId) === stageId) return;
    await moveDeal(dealId, stageId);
  }

  const createProject = async () => {
    if (!token || !wizardDeal || !projectName.trim() || !projectKey.trim()) return;
    await crmApi.createProjectFromDeal(
      wizardDeal._id,
      { name: projectName.trim(), key: projectKey.trim().toUpperCase() },
      token
    );
    setWizardDeal(null);
    setProjectName('');
    setProjectKey('');
    load();
  };

  async function createDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !pipeline || !form.title.trim() || !form.customerOrgId || !form.stageId) return;
    await crmApi.createDeal(
      {
        title: form.title.trim(),
        customerOrgId: form.customerOrgId,
        pipelineId: pipeline._id,
        stageId: form.stageId,
        value: Number(form.value) || 0,
        expectedCloseDate: form.expectedCloseDate || undefined,
        probability: pipeline.stages.find((s) => s._id === form.stageId)?.probability ?? 0,
      },
      token
    );
    setCreateOpen(false);
    setForm({ title: '', customerOrgId: orgs[0]?._id ?? '', value: 0, expectedCloseDate: '', stageId: form.stageId });
    load();
  }

  if (!pipeline) return <div className="p-8 text-[color:var(--text-muted)]">Loading pipeline…</div>;

  return (
    <div className="p-8 w-full px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold">Deals pipeline</h1>
          <p className="text-[13px] text-[color:var(--text-muted)]">{pipeline.name}</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="btn-primary px-4 py-2 rounded-lg text-sm"
            onClick={() => {
              setForm((f) => ({ ...f, customerOrgId: orgs[0]?._id ?? '', title: '', value: 0 }));
              setCreateOpen(true);
            }}
            disabled={orgs.length === 0}
          >
            Add deal
          </button>
        )}
      </div>
      {orgs.length === 0 && (
        <p className="text-sm text-amber-400 mb-4">Create a customer organisation in portal admin before adding deals.</p>
      )}
      <p className="text-[12px] text-[color:var(--text-muted)] mb-3">
        {canUpdate ? 'Drag the handle on a deal to move it between stages.' : 'You can view the pipeline but not move deals.'}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => setActiveDealId(String(active.id))}
        onDragEnd={(ev) => void onDragEnd(ev)}
        onDragCancel={() => setActiveDealId(null)}
      >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...pipeline.stages]
          .sort((a, b) => a.order - b.order)
          .map((stage) => {
            const columnDeals = dealsByStage(stage._id);
            return (
            <div key={stage._id} className="min-w-[240px] rounded-2xl bg-[color:var(--bg-surface)] border border-[color:var(--border-subtle)] p-3">
              <h3 className="font-medium text-sm mb-2 flex justify-between gap-2">
                <span>{stage.name}</span>
                <span className="text-[color:var(--text-muted)]">
                  {columnDeals.length} · {stage.probability}%
                </span>
              </h3>
              <DealColumn stageId={stage._id}>
                {columnDeals.map((deal) => (
                  <DealCard
                    key={deal._id}
                    deal={deal}
                    canDrag={canUpdate}
                    showCreateProject={Boolean(stage.isWon || deal.status === 'won')}
                    onCreateProject={() => setWizardDeal(deal)}
                  />
                ))}
              </DealColumn>
            </div>
            );
          })}
      </div>
      <DragOverlay>
        {activeDealId ? (
          <div className="rounded-lg border border-[color:var(--accent)]/40 bg-[color:var(--bg-elevated)] p-3 text-sm shadow-xl w-[220px]">
            <p className="font-medium">{deals.find((d) => d._id === activeDealId)?.title}</p>
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {createOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCreateOpen(false)}>
          <form onSubmit={createDeal} className="rounded-2xl bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">New deal</h2>
            <label className="block text-xs space-y-1">
              <span className="text-[color:var(--text-muted)]">Title</span>
              <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs space-y-1">
              <span className="text-[color:var(--text-muted)]">Customer</span>
              <select required value={form.customerOrgId} onChange={(e) => setForm((f) => ({ ...f, customerOrgId: e.target.value }))} className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm">
                {orgs.map((a) => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs space-y-1">
                <span className="text-[color:var(--text-muted)]">Value</span>
                <input type="number" min={0} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))} className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs space-y-1">
                <span className="text-[color:var(--text-muted)]">Close date</span>
                <input type="date" value={form.expectedCloseDate} onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="block text-xs space-y-1">
              <span className="text-[color:var(--text-muted)]">Stage</span>
              <select value={form.stageId} onChange={(e) => setForm((f) => ({ ...f, stageId: e.target.value }))} className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm">
                {[...pipeline.stages].sort((a, b) => a.order - b.order).map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm">Cancel</button>
              <button type="submit" className="btn-primary px-4 py-2 rounded-lg text-sm">Create</button>
            </div>
          </form>
        </div>
      )}

      {wizardDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-[color:var(--bg-surface)] border border-[color:var(--border-subtle)] p-6 max-w-md w-full">
            <h2 className="font-semibold mb-4">Create project from deal</h2>
            <p className="text-sm text-[color:var(--text-muted)] mb-4">{wizardDeal.title}</p>
            <input className="w-full mb-2 rounded-lg border border-[color:var(--border-subtle)] px-3 py-2 text-sm" placeholder="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <input className="w-full mb-4 rounded-lg border border-[color:var(--border-subtle)] px-3 py-2 text-sm" placeholder="Project key (e.g. ACME)" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setWizardDeal(null)} className="px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={createProject} className="btn-primary px-4 py-2 rounded-lg text-sm">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
