import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canAny } from '../../utils/moduleAccess';
import { crmApi, type CrmCampaign, type CrmLead } from '../../lib/api';
import { statusClass } from './leadCatalog';

const TYPES = ['inbound', 'outbound', 'event', 'partner', 'other'] as const;
const STATUSES = ['draft', 'active', 'paused', 'completed'] as const;
const inputClass =
  'w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm';

export default function CrmCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const canUpdate = canAny(user, 'taskflow.crm.campaign.update');
  const canDelete = canAny(user, 'taskflow.crm.campaign.delete');
  const [campaign, setCampaign] = useState<CrmCampaign | null>(null);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!token || !id) return;
    crmApi.getCampaign(id, token).then((res) => {
      if (res.success && res.data) setCampaign(res.data);
      else setError('Campaign not found');
    });
    crmApi.listLeads(token, { campaignId: id, limit: 50 }).then((res) => {
      if (res.success && res.data) setLeads(res.data.data ?? []);
    });
  };

  useEffect(() => {
    load();
  }, [token, id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id || !campaign || !canUpdate) return;
    setSaving(true);
    setError('');
    const res = await crmApi.updateCampaign(
      id,
      {
        name: campaign.name,
        code: campaign.code,
        type: campaign.type,
        status: campaign.status,
        channel: campaign.channel,
        utmSource: campaign.utmSource,
        utmMedium: campaign.utmMedium,
        utmCampaign: campaign.utmCampaign,
        notes: campaign.notes,
        budget: campaign.budget,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
      },
      token
    );
    setSaving(false);
    if (!res.success) setError((res as { message?: string }).message ?? 'Save failed');
    else load();
  }

  async function remove() {
    if (!token || !id || !canDelete) return;
    if (!confirm('Delete this campaign?')) return;
    const res = await crmApi.deleteCampaign(id, token);
    if (res.success) navigate('/crm/campaigns');
    else setError((res as { message?: string }).message ?? 'Delete failed');
  }

  if (!campaign) return <div className="p-8 text-[color:var(--text-muted)]">Loading campaign…</div>;

  return (
    <div className="p-8 w-full px-4 sm:px-6 lg:px-8 space-y-6">
      <div>
        <Link to="/crm/campaigns" className="text-sm text-[color:var(--accent)] hover:underline">
          ← Campaigns
        </Link>
        <h1 className="text-xl font-semibold mt-2">{campaign.name}</h1>
        <p className="text-[13px] text-[color:var(--text-muted)]">
          {campaign.openCount ?? 0} open · {campaign.convertedCount ?? 0} converted · {campaign.leadCount ?? 0} total
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <form onSubmit={save} className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-5 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs space-y-1">
          <span className="text-[color:var(--text-muted)]">Name</span>
          <input className={inputClass} value={campaign.name} disabled={!canUpdate} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-[color:var(--text-muted)]">Code</span>
          <input className={inputClass} value={campaign.code} disabled={!canUpdate} onChange={(e) => setCampaign({ ...campaign, code: e.target.value })} />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-[color:var(--text-muted)]">Type</span>
          <select className={inputClass} value={campaign.type} disabled={!canUpdate} onChange={(e) => setCampaign({ ...campaign, type: e.target.value })}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-[color:var(--text-muted)]">Status</span>
          <select className={inputClass} value={campaign.status} disabled={!canUpdate} onChange={(e) => setCampaign({ ...campaign, status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-[color:var(--text-muted)]">Channel</span>
          <input className={inputClass} value={campaign.channel ?? ''} disabled={!canUpdate} onChange={(e) => setCampaign({ ...campaign, channel: e.target.value })} />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-[color:var(--text-muted)]">UTM campaign</span>
          <input className={inputClass} value={campaign.utmCampaign ?? ''} disabled={!canUpdate} onChange={(e) => setCampaign({ ...campaign, utmCampaign: e.target.value })} />
        </label>
        <label className="block text-xs space-y-1 sm:col-span-2">
          <span className="text-[color:var(--text-muted)]">Notes</span>
          <textarea className={inputClass} rows={3} value={campaign.notes ?? ''} disabled={!canUpdate} onChange={(e) => setCampaign({ ...campaign, notes: e.target.value })} />
        </label>
        {canUpdate && (
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm">
              Save
            </button>
            {canDelete && (
              <button type="button" onClick={() => void remove()} className="text-sm text-red-400">
                Delete
              </button>
            )}
          </div>
        )}
      </form>

      <section>
        <h2 className="font-medium mb-3">Leads</h2>
        <ul className="space-y-2">
          {leads.map((l) => (
            <li key={l._id}>
              <Link to={`/crm/leads/${l._id}`} className="flex justify-between rounded-xl border border-[color:var(--border-subtle)] px-4 py-3 text-sm hover:border-[color:var(--accent)]/40">
                <span>{l.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded border ${statusClass(l.status)}`}>{l.status}</span>
              </Link>
            </li>
          ))}
          {leads.length === 0 && <p className="text-sm text-[color:var(--text-muted)]">No leads attributed yet.</p>}
        </ul>
      </section>
    </div>
  );
}
