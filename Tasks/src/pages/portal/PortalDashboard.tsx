import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { portalApi, type CustomerRequest, type LinkedServiceTicket } from '../../lib/api';
import { FiInbox, FiClock, FiCheckCircle, FiXCircle, FiFileText, FiArrowRight } from 'react-icons/fi';

function statusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-500/15 text-gray-400';
    case 'submitted':
    case 'pending_customer_approval':
    case 'pending_taskflow_approval':
      return 'bg-yellow-500/15 text-yellow-400';
    case 'approved':
    case 'ticket_created':
    case 'in_progress':
      return 'bg-blue-500/15 text-blue-400';
    case 'resolved':
    case 'closed':
      return 'bg-green-500/15 text-green-400';
    case 'rejected':
      return 'bg-red-500/15 text-red-400';
    default:
      return 'bg-gray-500/15 text-gray-400';
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function MetricCard({ label, value, icon, color }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[color:var(--text-primary)]">{value}</p>
        <p className="text-sm text-[color:var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}

export default function PortalDashboard() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [tickets, setTickets] = useState<LinkedServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([portalApi.listRequests(token), portalApi.listTickets(token)]).then(([reqRes, tRes]) => {
      setLoading(false);
      if (reqRes.success && reqRes.data) setRequests(reqRes.data.requests || []);
      else setError((reqRes as { message?: string }).message ?? 'Failed to load issues');
      if (tRes.success && tRes.data) setTickets(tRes.data.tickets || []);
    });
  }, [token]);

  const pending = requests.filter((r) =>
    ['submitted', 'pending_customer_approval', 'pending_taskflow_approval'].includes(r.status)
  ).length;
  const ticketCreated = requests.filter((r) =>
    ['ticket_created', 'in_progress', 'approved'].includes(r.status)
  ).length;
  const closed = requests.filter((r) => ['resolved', 'closed'].includes(r.status)).length;
  const openTickets = tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length;
  const recent = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[color:var(--text-muted)] mt-1">Overview of your customer portal activity</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-12 text-center text-[color:var(--text-muted)] animate-pulse">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">{error}</div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            <MetricCard label="Open issues" value={ticketCreated} icon={<FiFileText />} color="bg-blue-500/15 text-blue-400" />
            <MetricCard label="Pending approval" value={pending} icon={<FiClock />} color="bg-yellow-500/15 text-yellow-400" />
            <MetricCard label="Open tickets" value={openTickets} icon={<FiInbox />} color="bg-[color:var(--accent)]/15 text-[color:var(--accent)]" />
            <MetricCard label="Closed" value={closed} icon={<FiCheckCircle />} color="bg-green-500/15 text-green-400" />
          </div>

          {/* Recent requests */}
          <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border-subtle)]">
              <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">Recent issues</h2>
              <Link
                to="/portal/requests"
                className="flex items-center gap-1 text-xs text-[color:var(--accent)] hover:underline font-medium"
              >
                View all <FiArrowRight className="text-xs" />
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[color:var(--text-muted)]">
                No issues yet.{' '}
                <Link to="/portal/requests/new" className="text-[color:var(--accent)] hover:underline">
                  Submit your first issue
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--border-subtle)]">
                {recent.map((req) => {
                  const project = typeof req.projectId === 'object' ? req.projectId.name : req.projectId;
                  return (
                    <li key={req._id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[color:var(--bg-elevated)] transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[color:var(--text-primary)] truncate">{req.title}</p>
                        <p className="text-xs text-[color:var(--text-muted)] mt-0.5 truncate">
                          {project} · {formatDate(req.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColor(req.status)}`}
                      >
                        {statusLabel(req.status)}
                      </span>
                      <Link
                        to={`/portal/requests/${req._id}`}
                        className="shrink-0 text-xs text-[color:var(--accent)] hover:underline font-medium"
                      >
                        View
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Quick links */}
          {requests.length === 0 && (
            <div className="mt-6 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-8 text-center">
              <FiXCircle className="mx-auto text-4xl text-[color:var(--text-muted)] mb-3" />
              <p className="text-sm text-[color:var(--text-muted)] mb-4">You haven't submitted any issues yet.</p>
              <Link to="/portal/requests/new" className="btn-primary">
                New issue
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
