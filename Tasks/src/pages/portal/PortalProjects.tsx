import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { portalApi, type ProjectMapping } from '../../lib/api';
import { FiFolder } from 'react-icons/fi';

function statusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-500/15 text-green-400';
    case 'inactive': return 'bg-gray-500/15 text-gray-400';
    default: return 'bg-gray-500/15 text-gray-400';
  }
}

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  feature: 'Feature',
  suggestion: 'Suggestion',
  concern: 'Concern',
  other: 'Other',
};

export default function PortalProjects() {
  const { token } = useAuth();
  const [mappings, setMappings] = useState<ProjectMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    portalApi.listProjects(token).then((res) => {
      setLoading(false);
      if (res.success && res.data) setMappings(res.data.mappings || []);
      else setError((res as { message?: string }).message ?? 'Failed to load projects');
    });
  }, [token]);

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">Projects</h1>
        <p className="text-sm text-[color:var(--text-muted)] mt-1">Projects mapped to your organisation</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-12 text-center text-[color:var(--text-muted)] animate-pulse">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">{error}</div>
      ) : mappings.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-12 text-center">
          <FiFolder className="mx-auto text-4xl text-[color:var(--text-muted)] mb-3" />
          <p className="text-sm text-[color:var(--text-muted)]">No projects mapped yet. Contact your administrator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mappings.map((m) => (
            <div
              key={m._id}
              className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-5 flex flex-col gap-3 hover:border-[color:var(--accent)]/40 hover:bg-[color:var(--bg-elevated)] transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[color:var(--accent)]/10 flex items-center justify-center text-[color:var(--accent)] shrink-0">
                    <FiFolder />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[color:var(--text-primary)] truncate">{m.projectId.name}</p>
                    <p className="text-xs text-[color:var(--text-muted)] font-mono">{m.projectId.key}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColor(m.status)}`}>
                  {m.status}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-[color:var(--text-muted)] mb-1.5">Allowed issue types</p>
                {m.allowedRequestTypes.length === 0 ? (
                  <span className="text-xs text-[color:var(--text-muted)]">All types allowed</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {m.allowedRequestTypes.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] border border-[color:var(--border-subtle)]"
                      >
                        {TYPE_LABELS[t] ?? t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {m.status === 'active' && (
                <Link
                  to={`/portal/requests/new?projectId=${m.projectId._id}`}
                  className="btn-primary text-center min-h-11 flex items-center justify-center text-sm"
                >
                  New issue
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
