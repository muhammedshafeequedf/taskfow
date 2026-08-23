import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canAny } from '../../utils/moduleAccess';
import { crmApi, type CrmCampaign } from '../../lib/api';
import { formatDateDDMMYYYY } from '../../lib/dateFormat';

const TYPES = ['inbound', 'outbound', 'event', 'partner', 'other'] as const;
const STATUSES = ['draft', 'active', 'paused', 'completed'] as const;

export default function CrmCampaigns() {
  const { token, user } = useAuth();
  const canCreate = canAny(user, 'taskflow.crm.campaign.create');
  const [rows, setRows] = useState<CrmCampaign[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'inbound',
    status: 'active',
    channel: '',
    utmCampaign: '',
  });

  const load = () => {
    if (!token) return;
    crmApi.listCampaigns(token, { search: search || undefined, status: status || undefined }).then((res) => {
      if (res.success && res.data) setRows(res.data);
    });
  };

  useEffect(() => {
    load();
  }, [token, search, status]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.name.trim()) return;
    setError('');
    const res = await crmApi.createCampaign(
      {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        type: form.type,
        status: form.status,
        channel: form.channel.trim() || undefined,
        utmCampaign: form.utmCampaign.trim() || undefined,
      },
      token
    );
    if (!res.success) {
      setError((res as { message?: string }).message ?? 'Could not create campaign');
      return;
    }
    setModal(false);
    setForm({ name: '', code: '', type: 'inbound', status: 'active', channel: '', utmCampaign: '' });
    load();
  }

  return (
    <div className="p-8 w-full px-4 sm:px-6 lg:px-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Campaigns</h1>
          <p className="text-[13px] text-[color:var(--text-muted)]">Attribute leads and measure conversion by campaign.</p>
        </div>
        {canCreate && (
          <button type="button" className="btn-primary px-4 py-2 rounded-lg text-sm" onClick={() => setModal(true)}>
            + Add campaign
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaigns…"
          className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm min-w-[200px]"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead className="text-left text-[color:var(--text-muted)] border-b border-[color:var(--border-subtle)]">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Code</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Leads</th>
              <th className="p-3">Converted</th>
              <th className="p-3">Dates</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c._id} className="border-t border-[color:var(--border-subtle)]">
                <td className="p-3">
                  <Link to={`/crm/campaigns/${c._id}`} className="text-[color:var(--accent)] hover:underline font-medium">
                    {c.name}
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs">{c.code}</td>
                <td className="p-3 capitalize">{c.type}</td>
                <td className="p-3 capitalize">{c.status}</td>
                <td className="p-3">{c.leadCount ?? 0}</td>
                <td className="p-3">{c.convertedCount ?? 0}</td>
                <td className="p-3 text-[color:var(--text-muted)] text-xs">
                  {[c.startsAt && formatDateDDMMYYYY(c.startsAt), c.endsAt && formatDateDDMMYYYY(c.endsAt)]
                    .filter(Boolean)
                    .join(' → ') || '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[color:var(--text-muted)]">
                  No campaigns yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setModal(false)}>
          <form
            onSubmit={create}
            className="bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] rounded-2xl max-w-md w-full p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">New campaign</h2>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <label className="block text-xs space-y-1">
              <span className="text-[color:var(--text-muted)]">Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs space-y-1">
              <span className="text-[color:var(--text-muted)]">Code</span>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="Auto from name if empty"
                className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs space-y-1">
                <span className="text-[color:var(--text-muted)]">Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs space-y-1">
                <span className="text-[color:var(--text-muted)]">Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs space-y-1">
              <span className="text-[color:var(--text-muted)]">Channel</span>
              <input
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                placeholder="Webinar, ads, partner…"
                className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs space-y-1">
              <span className="text-[color:var(--text-muted)]">UTM campaign</span>
              <input
                value={form.utmCampaign}
                onChange={(e) => setForm((f) => ({ ...f, utmCampaign: e.target.value }))}
                className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary px-4 py-2 rounded-lg text-sm">
                Create
              </button>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="px-4 py-2 rounded-lg border border-[color:var(--border-subtle)] text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
