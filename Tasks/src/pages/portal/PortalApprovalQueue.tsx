import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { portalApi, type CustomerRequest } from '../../lib/api';
import { FiCheckSquare, FiArrowRight } from 'react-icons/fi';

function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'medium': return 'text-yellow-400';
    case 'low': return 'text-green-400';
    default: return 'text-[color:var(--text-muted)]';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PortalApprovalQueue() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    portalApi.listRequests(token, { status: 'pending_customer_approval' }).then((res) => {
      setLoading(false);
      if (res.success && res.data) {
        setRequests(res.data.requests || []);
      } else {
        setError((res as { message?: string }).message ?? 'Failed to load approval queue');
      }
    });
  }, [token]);

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">Approval Queue</h1>
        <p className="text-sm text-[color:var(--text-muted)] mt-1">
          Requests pending your organisation's approval
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-12 text-center text-[color:var(--text-muted)] animate-pulse">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">{error}</div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-12 text-center">
          <FiCheckSquare className="mx-auto text-4xl text-green-400 mb-3" />
          <p className="text-sm text-[color:var(--text-muted)]">No requests pending approval.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]">
            <span className="text-xs font-medium text-[color:var(--text-muted)]">
              {requests.length} request{requests.length !== 1 ? 's' : ''} pending approval
            </span>
          </div>
          <div className="md:hidden divide-y divide-[color:var(--border-subtle)]">
            {requests.map((req) => {
              const createdBy = typeof req.createdBy === 'object' ? req.createdBy.name : req.createdBy;
              return (
                <button
                  key={req._id}
                  type="button"
                  className="w-full text-left p-4 min-h-11"
                  onClick={() => navigate(`/portal/requests/${req._id}`)}
                >
                  <p className="font-medium">{req.title}</p>
                  <p className="text-xs text-[color:var(--text-muted)] mt-1">{createdBy} · {req.priority}</p>
                </button>
              );
            })}
          </div>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]">
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Requester</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {requests.map((req) => {
                  const createdBy = typeof req.createdBy === 'object' ? req.createdBy.name : req.createdBy;
                  return (
                    <tr
                      key={req._id}
                      className="hover:bg-[color:var(--bg-elevated)] transition cursor-pointer"
                      onClick={() => navigate(`/portal/requests/${req._id}`)}
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-[color:var(--text-primary)] truncate">{req.title}</p>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)]">{createdBy}</td>
                      <td className="px-4 py-3 capitalize text-[color:var(--text-muted)]">{req.type}</td>
                      <td className={`px-4 py-3 capitalize font-medium ${priorityColor(req.priority)}`}>
                        {req.priority}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)] whitespace-nowrap">
                        {formatDate(req.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/portal/requests/${req._id}`); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-yellow-500/40 bg-yellow-500/10 text-xs text-yellow-400 hover:bg-yellow-500/20 transition font-medium"
                        >
                          Review <FiArrowRight className="text-xs" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
