import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiPlus } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { canAny } from '../../utils/moduleAccess';
import { monitorApi, type MonitorProjectRecord } from '../../lib/api';
import { ModuleHeader, LoadingCard } from '../../components/moduleKit';
import SectionCard from '../../components/SectionCard';
import ConfirmModal from '../../components/ConfirmModal';
import { TrashIcon } from '../../components/icons/NavigationIcons';

type PmHint = { _id: string; name: string; key: string };

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 text-[13px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]/70 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30 focus:border-[color:var(--accent)]';

function PmProjectAutocomplete({
  hints,
  name,
  onNameChange,
  onPick,
}: {
  hints: PmHint[];
  name: string;
  onNameChange: (value: string) => void;
  onPick: (hint: PmHint) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return hints.slice(0, 8);
    return hints
      .map((h) => {
        const n = h.name.toLowerCase();
        const k = h.key.toLowerCase();
        let score = -1;
        if (n === q || k === q) score = 100;
        else if (n.startsWith(q) || k.startsWith(q)) score = 80;
        else if (n.includes(q) || k.includes(q)) score = 50;
        return { h, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.h.name.localeCompare(b.h.name))
      .slice(0, 8)
      .map((x) => x.h);
  }, [hints, name]);

  useEffect(() => {
    setHighlight(0);
  }, [suggestions]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(h: PmHint) {
    onPick(h);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestions[highlight]) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="mb-1.5 block text-[11px] font-medium text-[color:var(--text-muted)]">Project</label>
      <input
        className={inputClass}
        placeholder="Search Project Manager…"
        value={name}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onNameChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        required
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-modal)] py-1 shadow-xl">
          {suggestions.map((h, i) => (
            <li key={h._id}>
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                  i === highlight ? 'bg-[color:var(--accent)]/12' : 'hover:bg-[color:var(--bg-button-secondary)]'
                }`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
              >
                <span className="truncate text-[13px] font-medium text-[color:var(--text-primary)]">{h.name}</span>
                <span className="shrink-0 rounded-md bg-[color:var(--bg-page)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--text-muted)]">
                  {h.key}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MonitorProjects() {
  const { token, user } = useAuth();
  const canManage = canAny(user, 'taskflow.monitor.project.manage');
  const [projects, setProjects] = useState<MonitorProjectRecord[]>([]);
  const [hints, setHints] = useState<PmHint[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [sourceProjectId, setSourceProjectId] = useState('');
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    setLoading(true);
    Promise.all([monitorApi.listProjects(token), monitorApi.pmSuggestions(token)]).then(([list, sug]) => {
      setLoading(false);
      if (list.success && list.data) setProjects(list.data);
      else setError(list.message || 'Failed to load projects');
      if (sug.success && sug.data) setHints(sug.data);
    });
  };

  useEffect(() => {
    if (!token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    monitorApi
      .createProject({ name, key: key || undefined, sourceProjectId: sourceProjectId || undefined }, token)
      .then((res) => {
        if (res.success) {
          setName('');
          setKey('');
          setSourceProjectId('');
          load();
        } else setError(res.message || 'Could not create project');
      });
  }

  const deleting = projects.find((p) => p._id === deleteId);

  if (loading) return <LoadingCard label="Loading monitor projects…" />;

  return (
    <div className="w-full animate-fade-in space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <ModuleHeader
        eyebrow="Monitor"
        title="Projects"
        subtitle="Link a Project Manager record or name a custom app. Environments, API keys, and live telemetry stay in this module."
        accent="#22d3ee"
      />

      {canManage && (
        <SectionCard
          title="Add a project"
          description={
            hints.length
              ? `${hints.length} Project Manager ${hints.length === 1 ? 'project' : 'projects'} available to link.`
              : 'No unused PM projects — type a custom name and key.'
          }
        >
          <form className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end" onSubmit={onCreate}>
            <PmProjectAutocomplete
              hints={hints}
              name={name}
              onNameChange={(v) => {
                setName(v);
                setSourceProjectId('');
              }}
              onPick={(h) => {
                setName(h.name);
                setKey(h.key);
                setSourceProjectId(h._id);
              }}
            />
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-[color:var(--text-muted)]">Key</label>
              <input
                className={inputClass + ' font-mono uppercase'}
                placeholder="APP"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary btn-primary-sm inline-flex h-10 items-center justify-center gap-1.5 px-4">
              <FiPlus className="h-3.5 w-3.5" aria-hidden />
              Create
            </button>
          </form>
          {sourceProjectId && (
            <p className="mt-3 text-[12px] text-cyan-300/80">Linked to a Project Manager project. Key and name will match that record.</p>
          )}
          {error && <p className="mt-3 text-[13px] text-rose-400">{error}</p>}
        </SectionCard>
      )}

      {!canManage && error && <p className="text-[13px] text-rose-400">{error}</p>}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-6 py-16 text-center">
          <p className="text-sm font-medium text-[color:var(--text-primary)]">No monitor projects yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[color:var(--text-muted)]">
            {canManage
              ? 'Search a PM project above or enter a custom name to start ingesting logs and errors.'
              : 'Ask an admin to create a monitor project for this workspace.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li
              key={p._id}
              className="group flex items-center justify-between rounded-lg border border-[color:var(--border-subtle)] border-l-[3px] border-l-cyan-400/80 bg-[color:var(--bg-surface)] p-4 card-shadow transition-all hover:border-[color:var(--accent)]/30 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
            >
              <Link to={`/monitor/${p._id}`} className="min-w-0 flex-1 hover:opacity-90">
                <span className="text-sm font-bold text-[color:var(--text-primary)]">{p.name}</span>
                <span className="ml-2 rounded-md bg-[color:var(--bg-page)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--text-muted)]">
                  {p.key}
                </span>
                <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">Logs, errors, live users, uptime</p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to={`/monitor/${p._id}`}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-[color:var(--border-subtle)] px-3 py-1.5 text-xs text-[color:var(--text-primary)] hover:bg-[color:var(--bg-button-secondary)]"
                >
                  Open
                  <FiArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
                {canManage && (
                  <button
                    type="button"
                    title="Delete"
                    className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => setDeleteId(p._id)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(deleteId)}
        title="Delete monitor project"
        message={
          deleting
            ? `Delete “${deleting.name}”? Environments, apps, and stored telemetry for this monitor project are removed.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (token && deleteId) {
            monitorApi.deleteProject(deleteId, token).then(() => {
              setDeleteId(null);
              load();
            });
          }
        }}
      />
    </div>
  );
}
