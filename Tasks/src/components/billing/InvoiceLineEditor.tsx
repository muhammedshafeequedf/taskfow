import type { BillingInvoiceLineType } from '../../lib/api';
import {
  INVOICE_CATEGORIES,
  INVOICE_LINE_PRESETS,
  invoiceLineAmount,
  qtyLabel,
  rateLabel,
  type InvoiceLineDraft,
} from '../../lib/billingLineUtils';

const inputClass =
  'w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-2 py-1.5 text-sm';

const BILLING_TYPES: BillingInvoiceLineType[] = [
  'hourly',
  'fixed',
  'milestone',
  'retainer',
  'amc',
  'support',
  'expense',
];

type Props = {
  lines: InvoiceLineDraft[];
  onChange: (lines: InvoiceLineDraft[]) => void;
  currency: string;
  defaultTaxRate?: number;
};

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export default function InvoiceLineEditor({ lines, onChange, currency, defaultTaxRate = 0 }: Props) {
  function updateLine(index: number, patch: Partial<InvoiceLineDraft>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine(preset?: Partial<InvoiceLineDraft>) {
    onChange([
      ...lines,
      {
        description: preset?.description ?? '',
        category: preset?.category ?? '',
        billingType: preset?.billingType ?? 'hourly',
        quantity: preset?.quantity ?? 8,
        unitPrice: preset?.unitPrice ?? 0,
        taxRate: preset?.taxRate ?? defaultTaxRate,
        discountPercent: 0,
        periodStart: preset?.periodStart ?? '',
        periodEnd: preset?.periodEnd ?? '',
        hsnSac: '',
      },
    ]);
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Service line items</h3>
        <div className="flex flex-wrap gap-2">
          {INVOICE_LINE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="text-xs px-2 py-1 rounded-lg border border-[color:var(--border-subtle)] hover:bg-[color:var(--bg-elevated)]"
              onClick={() => addLine({ ...p.line, taxRate: defaultTaxRate })}
            >
              + {p.label}
            </button>
          ))}
          <button type="button" className="text-xs text-[color:var(--accent)] hover:underline" onClick={() => addLine()}>
            + Blank line
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--border-subtle)]">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-[color:var(--bg-elevated)] text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Description</th>
              <th className="text-left px-3 py-2 font-medium w-24">Category</th>
              <th className="text-left px-3 py-2 font-medium w-28">Type</th>
              <th className="text-left px-3 py-2 font-medium w-28">Period from</th>
              <th className="text-left px-3 py-2 font-medium w-28">Period to</th>
              <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
              <th className="text-right px-3 py-2 font-medium w-24">Rate</th>
              <th className="text-right px-3 py-2 font-medium w-16">Disc %</th>
              <th className="text-right px-3 py-2 font-medium w-16">Tax %</th>
              <th className="text-right px-3 py-2 font-medium w-24">Amount</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-[color:var(--border-subtle)] align-top">
                <td className="px-3 py-2">
                  <input
                    className={inputClass}
                    value={line.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    placeholder="Service description"
                    required
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className={inputClass}
                    value={line.category}
                    onChange={(e) => updateLine(i, { category: e.target.value })}
                  >
                    <option value="">—</option>
                    {INVOICE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className={inputClass}
                    value={line.billingType}
                    onChange={(e) => updateLine(i, { billingType: e.target.value as BillingInvoiceLineType })}
                  >
                    {BILLING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    className={inputClass}
                    value={line.periodStart}
                    onChange={(e) => updateLine(i, { periodStart: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    className={inputClass}
                    value={line.periodEnd}
                    onChange={(e) => updateLine(i, { periodEnd: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    className={`${inputClass} text-right`}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                    title={qtyLabel(line.billingType)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`${inputClass} text-right`}
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })}
                    title={rateLabel(line.billingType)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`${inputClass} text-right`}
                    value={line.discountPercent}
                    onChange={(e) => updateLine(i, { discountPercent: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    className={`${inputClass} text-right`}
                    value={line.taxRate}
                    onChange={(e) => updateLine(i, { taxRate: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums pt-3">{money(invoiceLineAmount(line), currency)}</td>
                <td className="px-2 py-2">
                  <button type="button" className="text-xs text-red-400 hover:underline" onClick={() => removeLine(i)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-[color:var(--text-muted)]">
                  Add at least one service line item.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
