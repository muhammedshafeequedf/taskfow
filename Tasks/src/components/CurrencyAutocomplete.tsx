import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { CoreCurrency } from '../lib/api';

export function CurrencyAutocomplete({
  currencies,
  value,
  disabled,
  triggerClass,
  onChange,
}: {
  currencies: CoreCurrency[];
  value: string;
  disabled?: boolean;
  triggerClass?: string;
  onChange: (code: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = currencies.find((c) => c.code === value);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currencies.slice(0, 12);
    return currencies
      .filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.symbol ?? '').toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [currencies, query]);

  useEffect(() => setHighlight(0), [suggestions, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(c: CoreCurrency) {
    onChange(c.code);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && suggestions[highlight]) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === 'Escape') setOpen(false);
  }

  const buttonClass =
    triggerClass ??
    'w-full flex items-center justify-between gap-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-3 py-2 text-sm text-left hover:border-[color:var(--accent)]/50 disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          setQuery('');
        }}
        className={buttonClass}
      >
        <span className="min-w-0 truncate">
          {selected ? (
            <>
              <span className="font-medium">{selected.code}</span>
              <span className="text-[color:var(--text-muted)]">
                {' '}
                · {selected.name}
                {selected.symbol ? ` (${selected.symbol})` : ''}
              </span>
            </>
          ) : value ? (
            <span className="font-medium">{value}</span>
          ) : (
            <span className="text-[color:var(--text-muted)]">Select currency…</span>
          )}
        </span>
        <span className="text-[color:var(--text-muted)] text-xs shrink-0">▾</span>
      </button>
      {open && !disabled && (
        <div className="absolute z-40 left-0 right-0 mt-1 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-xl overflow-hidden">
          <input
            autoFocus
            value={query}
            autoComplete="off"
            placeholder="Search code, name, or symbol…"
            className="w-full px-3 py-2.5 text-sm bg-[color:var(--bg-page)] border-b border-[color:var(--border-subtle)] focus:outline-none"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          <ul className="max-h-56 overflow-auto py-1">
            {suggestions.map((c, i) => (
              <li key={c.code}>
                <button
                  type="button"
                  className={
                    i === highlight || c.code === value
                      ? 'w-full text-left px-3 py-2 text-sm bg-[color:var(--accent)]/15'
                      : 'w-full text-left px-3 py-2 text-sm hover:bg-[color:var(--bg-page)]'
                  }
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(c);
                  }}
                >
                  <span className="font-medium tabular-nums">{c.code}</span>
                  <span className="text-[color:var(--text-muted)]">
                    {' '}
                    · {c.name}
                    {c.symbol ? ` · ${c.symbol}` : ''}
                  </span>
                </button>
              </li>
            ))}
            {suggestions.length === 0 && (
              <li className="px-3 py-3 text-sm text-[color:var(--text-muted)]">No currencies match</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
