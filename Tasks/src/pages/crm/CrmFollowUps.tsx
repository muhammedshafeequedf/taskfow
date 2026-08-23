import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canAny } from '../../utils/moduleAccess';
import { crmApi, type CrmActivity } from '../../lib/api';
import { formatDateDDMMYYYY } from '../../lib/dateFormat';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export default function CrmFollowUps() {
  const { token, user } = useAuth();
  const canUpdate = canAny(user, 'taskflow.crm.activity.update');
  const [items, setItems] = useState<CrmActivity[]>([]);
  const [mine, setMine] = useState(false);

  const load = () => {
    if (!token) return;
    crmApi.listActivities(token, { type: 'follow_up', completed: '0', mine }).then((res) => {
      if (res.success && res.data) setItems(res.data);
    });
  };

  useEffect(() => {
    load();
  }, [token, mine]);

  const groups = useMemo(() => {
    const now = Date.now();
    const today = startOfDay(new Date());
    const overdue: CrmActivity[] = [];
    const dueToday: CrmActivity[] = [];
    const upcoming: CrmActivity[] = [];
    for (const a of items) {
      if (!a.dueAt) {
        upcoming.push(a);
        continue;
      }
      const t = new Date(a.dueAt).getTime();
      if (t < now && startOfDay(new Date(a.dueAt)) < today) overdue.push(a);
      else if (startOfDay(new Date(a.dueAt)) === today) dueToday.push(a);
      else upcoming.push(a);
    }
    return { overdue, dueToday, upcoming };
  }, [items]);

  async function complete(id: string) {
    if (!token || !canUpdate) return;
    await crmApi.completeActivity(id, token);
    load();
  }

  async function snooze(a: CrmActivity, days: number) {
    if (!token || !canUpdate) return;
    const base = a.dueAt ? new Date(a.dueAt) : new Date();
    base.setDate(base.getDate() + days);
    await crmApi.updateActivity(a._id, { dueAt: base.toISOString() }, token);
    load();
  }

  function relatedLink(a: CrmActivity) {
    if (a.relatedType === 'lead' && a.relatedId) return `/crm/leads/${a.relatedId}`;
    if (a.relatedType === 'deal') return '/crm/deals';
    if (a.relatedType === 'account' && a.relatedId) return `/crm/accounts/${a.relatedId}`;
    return '/crm/activities';
  }

  function Section({ title, rows }: { title: string; rows: CrmActivity[] }) {
    return (
      <section>
        <h2 className="font-medium mb-3">
          {title} <span className="text-[color:var(--text-muted)] font-normal">({rows.length})</span>
        </h2>
        <div className="space-y-2">
          {rows.map((a) => (
            <div
              key={a._id}
              className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-4 flex flex-wrap justify-between gap-3"
            >
              <div>
                <p className="font-medium text-sm">{a.subject}</p>
                <p className="text-xs text-[color:var(--text-muted)]">
                  {a.relatedType}
                  {a.relatedTitle ? ` · ${a.relatedTitle}` : ''}
                  {a.dueAt ? ` · due ${formatDateDDMMYYYY(a.dueAt)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm items-center">
                <Link to={relatedLink(a)} className="text-[color:var(--accent)] hover:underline">
                  Open
                </Link>
                {canUpdate && (
                  <>
                    <button type="button" className="text-[color:var(--accent)] hover:underline" onClick={() => void complete(a._id)}>
                      Complete
                    </button>
                    <button type="button" className="text-[color:var(--text-muted)] hover:underline" onClick={() => void snooze(a, 1)}>
                      +1d
                    </button>
                    <button type="button" className="text-[color:var(--text-muted)] hover:underline" onClick={() => void snooze(a, 7)}>
                      +7d
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-[color:var(--text-muted)]">None.</p>}
        </div>
      </section>
    );
  }

  return (
    <div className="p-8 w-full px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Follow-ups</h1>
          <p className="text-[13px] text-[color:var(--text-muted)]">Overdue and upcoming trackers from leads and logged follow-ups.</p>
        </div>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          Assigned to me
        </label>
      </div>
      <Section title="Overdue" rows={groups.overdue} />
      <Section title="Due today" rows={groups.dueToday} />
      <Section title="Upcoming" rows={groups.upcoming} />
    </div>
  );
}
