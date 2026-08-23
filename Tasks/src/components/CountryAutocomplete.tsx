import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export function CountryAutocomplete({
  value,
  countries,
  disabled,
  inputClass,
  placeholder = 'Type to search countries…',
  onChange,
  onPick,
}: {
  value: string;
  countries: string[];
  disabled?: boolean;
  inputClass: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onPick: (country: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return countries.slice(0, 12);
    return countries
      .map((name) => {
        const n = name.toLowerCase();
        let score = -1;
        if (n === q) score = 100;
        else if (n.startsWith(q)) score = 80;
        else if (n.includes(q)) score = 50;
        return { name, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 12)
      .map((x) => x.name);
  }, [countries, value]);

  useEffect(() => setHighlight(0), [suggestions, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(name: string) {
    onPick(name);
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

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input
        value={value}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={placeholder}
        className={inputClass}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && !disabled && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-lg py-1"
        >
          {suggestions.map((name, i) => (
            <li key={name} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={
                  i === highlight
                    ? 'w-full text-left px-3 py-2 text-sm bg-[color:var(--accent)]/15 text-[color:var(--text-primary)]'
                    : 'w-full text-left px-3 py-2 text-sm hover:bg-[color:var(--bg-page)] text-[color:var(--text-primary)]'
                }
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(name);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !disabled && value.trim() && suggestions.length === 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-lg px-3 py-2 text-[13px] text-[color:var(--text-muted)]">
          No matching countries
        </div>
      )}
    </div>
  );
}
