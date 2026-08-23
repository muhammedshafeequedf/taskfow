import { Link } from 'react-router-dom';

export type RelatedRecord = {
  label: string;
  text: string;
  to?: string;
};

export function RelatedRecords({ items }: { items: RelatedRecord[] }) {
  const visible = items.filter((i) => i.text);
  if (visible.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[color:var(--border-subtle)] p-5 mb-6">
      <h2 className="text-sm font-medium mb-3">Related</h2>
      <ul className="grid gap-2 sm:grid-cols-2 text-sm">
        {visible.map((item) => (
          <li key={`${item.label}-${item.text}`} className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-wide text-[color:var(--text-muted)]">{item.label}</span>
            {item.to ? (
              <Link to={item.to} className="text-[color:var(--accent)] hover:underline truncate">
                {item.text}
              </Link>
            ) : (
              <span className="truncate">{item.text}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
