import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { portalApi, type LinkedServiceTicket } from '../../lib/api';
import { FiArrowLeft, FiSend } from 'react-icons/fi';

export default function PortalTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [ticket, setTicket] = useState<(LinkedServiceTicket & { description?: string }) | null>(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  function load() {
    if (!token || !id) return;
    portalApi.getTicket(id, token).then((res) => {
      if (res.success && res.data) setTicket(res.data.ticket);
      else setError((res as { message?: string }).message ?? 'Not found');
    });
  }

  useEffect(() => { load(); }, [token, id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id || !body.trim()) return;
    setSending(true);
    const res = await portalApi.addTicketComment(id, body.trim(), token);
    setSending(false);
    if (res.success && res.data) {
      setTicket(res.data.ticket);
      setBody('');
    }
  }

  const classLabel =
    ticket?.workClassification === 'billable_change'
      ? 'Billable change'
      : ticket?.workClassification === 'fix'
        ? 'Fix'
        : null;

  return (
    <div className="p-4 md:p-8 animate-fade-in max-w-3xl">
      <Link to="/portal/tickets" className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] mb-4 min-h-11">
        <FiArrowLeft /> Back to tickets
      </Link>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}
      {!ticket && !error && <p className="text-[color:var(--text-muted)]">Loading…</p>}
      {ticket && (
        <>
          <h1 className="text-xl font-semibold">{ticket.subject}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs rounded-full px-2 py-0.5 bg-blue-500/15 text-blue-400 capitalize">{ticket.status.replace(/_/g, ' ')}</span>
            <span className="text-xs rounded-full px-2 py-0.5 bg-[color:var(--bg-elevated)] capitalize">{ticket.priority}</span>
            {classLabel && (
              <span className="text-xs rounded-full px-2 py-0.5 bg-[color:var(--accent)]/15 text-[color:var(--accent)]">{classLabel}</span>
            )}
          </div>
          {ticket.description && (
            <p className="mt-4 text-sm whitespace-pre-wrap text-[color:var(--text-muted)]">{ticket.description}</p>
          )}
          <h2 className="mt-8 text-sm font-semibold">Public thread</h2>
          <p className="text-xs text-[color:var(--text-muted)] mt-1">Your comments are visible to the support team. Internal staff notes are not shown here.</p>
          <div className="mt-3 space-y-3">
            {(ticket.comments ?? []).length === 0 && (
              <p className="text-sm text-[color:var(--text-muted)]">No public comments yet.</p>
            )}
            {(ticket.comments ?? []).map((c, i) => (
              <div key={i} className="rounded-lg border border-[color:var(--border-subtle)] p-3">
                <p className="text-xs font-medium">{c.authorName ?? 'User'}</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
          <form onSubmit={submit} className="mt-4 sticky bottom-0 bg-[color:var(--bg-page)] py-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-3 text-base"
              placeholder="Public comment for the support team…"
            />
            <button type="submit" disabled={sending || !body.trim()} className="btn-primary mt-2 min-h-11 flex items-center gap-2">
              <FiSend /> {sending ? 'Sending…' : 'Comment'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
