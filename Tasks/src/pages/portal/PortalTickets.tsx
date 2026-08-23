import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { portalApi, type LinkedServiceTicket } from '../../lib/api';

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PortalTickets() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<LinkedServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    portalApi.listTickets(token).then((res) => {
      setLoading(false);
      if (res.success && res.data) setTickets(res.data.tickets || []);
      else setError((res as { message?: string }).message ?? 'Failed to load tickets');
    });
  }, [token]);

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">Tickets</h1>
      <p className="text-sm text-[color:var(--text-muted)] mt-1 mb-6">
        Track status and add public comments. Atrium staff work tickets in Service Desk.
      </p>
      {loading ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] p-12 text-center text-[color:var(--text-muted)]">Loading…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] p-12 text-center text-sm text-[color:var(--text-muted)]">
          No tickets yet. After Atrium approval you can track them here.
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {tickets.map((t) => (
              <button
                key={t._id}
                type="button"
                onClick={() => navigate(`/portal/tickets/${t._id}`)}
                className="w-full text-left rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-4 min-h-11"
              >
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-[color:var(--text-muted)] mt-1">{statusLabel(t.status)} · {t.priority}</p>
              </button>
            ))}
          </div>
          <div className="hidden md:block rounded-xl border border-[color:var(--border-subtle)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]">
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Subject</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {tickets.map((t) => (
                  <tr
                    key={t._id}
                    className="hover:bg-[color:var(--bg-elevated)] cursor-pointer"
                    onClick={() => navigate(`/portal/tickets/${t._id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{t.subject}</td>
                    <td className="px-4 py-3 capitalize">{statusLabel(t.status)}</td>
                    <td className="px-4 py-3 capitalize">{t.priority}</td>
                    <td className="px-4 py-3">
                      {t.workClassification === 'billable_change' ? 'Billable change' : t.workClassification === 'fix' ? 'Fix' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
